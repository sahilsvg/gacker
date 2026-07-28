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

  let streak = 0;
  let cleanDays = 0;
  let redDays = 0;

  for (const key of Object.keys(entries)) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date > today) continue;
    if (entries[key].clean) cleanDays++;
    else redDays++;
  }

  const check = new Date(today);
  while (true) {
    const key = formatDateKey(check);
    if (!(key in entries)) break;
    if (!entries[key].clean) break;
    streak++;
    check.setDate(check.getDate() - 1);
  }

  return { streak, cleanDays, redDays };
};
