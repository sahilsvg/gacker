import { supabase } from '@/integrations/supabase/client';

const LIKE_EVENT = 'gacker:like-changed';

export function emitLikeChange(previewUrl: string, liked: boolean) {
  window.dispatchEvent(new CustomEvent(LIKE_EVENT, { detail: { previewUrl, liked } }));
}

export function onLikeChange(cb: (previewUrl: string, liked: boolean) => void): () => void {
  const handler = (e: Event) => {
    const { previewUrl, liked } = (e as CustomEvent<{ previewUrl: string; liked: boolean }>).detail;
    cb(previewUrl, liked);
  };
  window.addEventListener(LIKE_EVENT, handler);
  return () => window.removeEventListener(LIKE_EVENT, handler);
}

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
  const newLiked = !currentlyLiked;
  emitLikeChange(song.previewUrl, newLiked);
  if (currentlyLiked) {
    await supabase
      .from('liked_songs')
      .delete()
      .eq('user_id', userId)
      .eq('song_preview_url', song.previewUrl);
  } else {
    await supabase.from('liked_songs').upsert({
      user_id: userId,
      song_name: song.name,
      song_artist: song.artist,
      song_album_art: song.albumArt,
      song_preview_url: song.previewUrl,
    });
  }
  return newLiked;
}
