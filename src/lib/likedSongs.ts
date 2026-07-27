import { supabase } from '@/integrations/supabase/client';

export interface LikedSong {
  id: string;
  song_name: string;
  song_artist: string;
  song_album_art: string | null;
  song_preview_url: string;
  liked_at: string;
}

export async function getLikedSongs(userId: string): Promise<LikedSong[]> {
  const { data } = await supabase
    .from('liked_songs')
    .select('*')
    .eq('user_id', userId)
    .order('liked_at', { ascending: false });
  return data ?? [];
}

export async function isLikedSong(userId: string, previewUrl: string): Promise<boolean> {
  const { data } = await supabase
    .from('liked_songs')
    .select('id')
    .eq('user_id', userId)
    .eq('song_preview_url', previewUrl)
    .maybeSingle();
  return !!data;
}

export async function toggleLikedSong(
  userId: string,
  song: { name: string; artist: string; albumArt: string | null; previewUrl: string },
  currentlyLiked: boolean,
): Promise<boolean> {
  if (currentlyLiked) {
    await supabase
      .from('liked_songs')
      .delete()
      .eq('user_id', userId)
      .eq('song_preview_url', song.previewUrl);
    return false;
  } else {
    await supabase.from('liked_songs').upsert({
      user_id: userId,
      song_name: song.name,
      song_artist: song.artist,
      song_album_art: song.albumArt,
      song_preview_url: song.previewUrl,
    });
    return true;
  }
}
