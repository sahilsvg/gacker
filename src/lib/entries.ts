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
  let lastRed: Date | null = null;
  let firstLogged: Date | null = null;

  for (const key of Object.keys(entries)) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date > today) continue;
    if (entries[key].clean) cleanDays++;
    else redDays++;

    if (!firstLogged || date < firstLogged) firstLogged = date;
    if (!entries[key].clean && (!lastRed || date > lastRed)) lastRed = date;
  }

  // Streak is days since the last red day, not consecutive logged days. Only
  // an explicit red day resets it: someone who stays clean but forgets to log
  // for a week has not broken anything, and previously would have been shown a
  // zero. Because of this the streak advances with the calendar rather than
  // with logging, so anything that fires on a threshold has to track its own
  // high-water mark instead of comparing before/after a log.
  const DAY_MS = 86_400_000;
  const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY_MS);

  let streak = 0;
  if (lastRed) {
    streak = daysBetween(today, lastRed);
  } else if (firstLogged) {
    // Never had a red day — clean for as long as they have been tracking.
    streak = daysBetween(today, firstLogged) + 1;
  }

  return { streak, cleanDays, redDays };
};
