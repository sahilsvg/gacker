import { supabase } from '@/integrations/supabase/client';
import type { LocationValue } from '@/components/LocationPicker';
import type { SongSelection } from '@/components/SongPicker';

export interface Entry {
  date: string;
  clean: boolean;
  notes: string | null;
  created_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  song_name?: string | null;
  song_artist?: string | null;
  song_album_art?: string | null;
  song_preview_url?: string | null;
  image_url?: string | null;
}

export const formatDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fetchEntries = async (userId: string): Promise<Record<string, Entry>> => {
  const { data } = await supabase
    .from('entries')
    .select('date, clean, notes, created_at, latitude, longitude, location_name, song_name, song_artist, song_album_art, song_preview_url, image_url')
    .eq('user_id', userId);
  const map: Record<string, Entry> = {};
  (data ?? []).forEach((row: Entry) => { map[row.date] = row; });
  return map;
};

export const upsertEntry = async (
  userId: string,
  date: string,
  clean: boolean,
  notes: string,
  location?: LocationValue | null,
  song?: SongSelection | null,
  imageUrl?: string | null,
) => {
  await supabase.from('entries').upsert(
    {
      user_id: userId,
      date,
      clean,
      notes: notes || null,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      location_name: location?.name ?? null,
      song_name: song?.track.name ?? null,
      song_artist: song?.track.artist ?? null,
      song_album_art: song?.track.albumArt ?? null,
      song_preview_url: song?.track.previewUrl ?? null,
      image_url: imageUrl !== undefined ? imageUrl : null,
    },
    { onConflict: 'user_id,date' }
  );
  const { data } = await supabase
    .from('entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  return data as { id: string } | null;
};

export const computeStats = (entries: Record<string, Entry>) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cleanDays = 0;
  let redDays = 0;

  const logged: { date: Date; clean: boolean }[] = [];
  for (const key of Object.keys(entries)) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date > today) continue;
    logged.push({ date, clean: entries[key].clean });
    if (entries[key].clean) cleanDays++;
    else redDays++;
  }

  // Streak is the number of clean days *logged* since the last red day.
  //
  // A day that was never logged neither counts toward the streak nor breaks it.
  // Counting calendar days instead would credit days the user never reported;
  // breaking on a gap (the original behaviour) reset a streak to zero after two
  // quiet days even though nothing was relapsed on.
  const lastRed = logged.reduce<Date | null>(
    (acc, r) => (!r.clean && (!acc || r.date > acc) ? r.date : acc),
    null,
  );
  const streak = logged.filter(r => r.clean && (!lastRed || r.date > lastRed)).length;

  return { streak, cleanDays, redDays };
};

export interface MonthlyStats {
  /** "2026-08" */
  month: string;
  /** "Aug '26", for chart axes */
  label: string;
  cleanDays: number;
  redDays: number;
  /** Percentage, same formula as computeStats' fireRate. null when nothing
   *  was logged that month, so the chart can show a gap instead of a false 0. */
  fireRate: number | null;
}

/**
 * Entries bucketed by calendar month, one point per month from the first
 * entry through today -- including months with nothing logged, so a chart
 * reads as a continuous timeline rather than skipping gaps.
 */
export const computeMonthlyStats = (entries: Record<string, Entry>): MonthlyStats[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byMonth = new Map<string, { clean: number; red: number }>();
  let earliest: string | null = null;

  for (const key of Object.keys(entries)) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date > today) continue;

    const monthKey = key.slice(0, 7); // "YYYY-MM"
    if (!earliest || monthKey < earliest) earliest = monthKey;

    const bucket = byMonth.get(monthKey) ?? { clean: 0, red: 0 };
    if (entries[key].clean) bucket.clean++; else bucket.red++;
    byMonth.set(monthKey, bucket);
  }

  if (!earliest) return [];

  const [startY, startM] = earliest.split('-').map(Number);
  const months: MonthlyStats[] = [];
  const cursor = new Date(startY, startM - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 1);

  while (cursor <= end) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const bucket = byMonth.get(monthKey);
    const total = (bucket?.clean ?? 0) + (bucket?.red ?? 0);
    months.push({
      month: monthKey,
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '"),
      cleanDays: bucket?.clean ?? 0,
      redDays: bucket?.red ?? 0,
      fireRate: total > 0 ? Math.round((bucket!.red / total) * 1000) / 10 : null,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

export interface CumulativeFireRatePoint {
  /** "2026-09-05" */
  date: string;
  /** "Sep 5", for chart axes */
  label: string;
  /** Percentage: all red entries through this day / all entries through this
   *  day. Never null -- on a day with nothing logged, this repeats the last
   *  value rather than being undefined, so the line reads as flat rather than
   *  broken during a gap. */
  fireRate: number;
  /** Whether this specific calendar day had an entry, vs. carrying a prior
   *  day's value forward. Used to draw a dot only on days actually logged. */
  hasEntry: boolean;
}

/**
 * Cumulative fire rate as it stood on each calendar day from the first entry
 * through today -- the same running number the FIRE RATE stat card shows,
 * evaluated at every point along the way rather than only at the end.
 *
 * One point per calendar day, not per logged day: a category axis spaces
 * points evenly regardless of the real gap between them, so skipping straight
 * from logged day to logged day would make a 1-day gap and a 3-week gap look
 * identical. Filling every day keeps the axis time-proportional and turns a
 * gap into a visible flat stretch instead of a misrepresented non-event.
 *
 * The ratio itself only ever moves on a day with an entry -- an unlogged day
 * neither counts toward it nor against it, same convention as the streak.
 */
export const computeCumulativeFireRate = (entries: Record<string, Entry>): CumulativeFireRatePoint[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validKeys = Object.keys(entries)
    .filter(key => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d) <= today;
    })
    .sort();

  if (validKeys.length === 0) return [];

  const [startY, startM, startD] = validKeys[0].split('-').map(Number);
  const cursor = new Date(startY, startM - 1, startD);

  let clean = 0;
  let red = 0;
  const points: CumulativeFireRatePoint[] = [];

  while (cursor <= today) {
    const key = formatDateKey(cursor);
    const entry = entries[key];
    const hasEntry = !!entry;
    if (entry) { if (entry.clean) clean++; else red++; }

    const total = clean + red;
    points.push({
      date: key,
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fireRate: total > 0 ? Math.round((red / total) * 1000) / 10 : 0,
      hasEntry,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
};
