import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Play, Pause, Music, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { getLikedSongs, LikedSong, toggleLikedSong } from '@/lib/likedSongs';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { haptic } from '@/lib/haptics';
import { SongSelection } from './SongPicker';

interface Props {
  onSelect: (selection: SongSelection) => void;
  onClose: () => void;
}

const LikedSongsSheet = ({ onSelect, onClose }: Props) => {
  const { user } = useAuth();
  const { play, stop, currentSong, isPlaying } = usePlayer();
  const [songs, setSongs] = useState<LikedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };
  const { onTouchStart, onTouchEnd } = useSwipeToDismiss(handleClose, scrollRef);

  useEffect(() => {
    if (!user) return;
    getLikedSongs(user.id).then(data => { setSongs(data); setLoading(false); });
  }, [user]);

  const handleUnlike = async (song: LikedSong) => {
    if (!user) return;
    haptic.light();
    setSongs(prev => prev.filter(s => s.id !== song.id));
    await toggleLikedSong(
      user.id,
      { name: song.song_name, artist: song.song_artist, albumArt: song.song_album_art, previewUrl: song.song_preview_url },
      true,
    );
  };

  const handleSelect = (song: LikedSong) => {
    stop();
    onSelect({
      track: {
        id: song.id,
        name: song.song_name,
        artist: song.song_artist,
        albumArt: song.song_album_art,
        previewUrl: song.song_preview_url,
      },
    });
    handleClose();
  };

  const togglePreview = (song: LikedSong) => {
    if (!song.song_preview_url) return;
    play({ url: song.song_preview_url, name: song.song_name, artist: song.song_artist, albumArt: song.song_album_art });
  };

  const sheet = (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div
        className={`relative bg-card rounded-t-3xl flex flex-col ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-foreground">Liked Songs</h3>
          <button onPointerDown={e => { e.preventDefault(); handleClose(); }} className="text-muted-foreground p-3 -mr-3">
            <X size={20} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-muted-foreground text-sm text-center py-10">Loading…</p>
          )}
          {!loading && songs.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-10 px-10">
              No liked songs yet. Hit the heart in the player while a song is playing.
            </p>
          )}
          {songs.map(song => {
            const previewing = currentSong?.url === song.song_preview_url && isPlaying;
            return (
              <div key={song.id} className="flex items-center gap-3 px-5 py-3 border-b border-border/40 last:border-0">
                {song.song_album_art
                  ? <img src={song.song_album_art} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Music size={16} className="text-muted-foreground" />
                    </div>
                }
                <button
                  onPointerDown={e => { e.preventDefault(); handleSelect(song); }}
                  className="flex-1 min-w-0 text-left active:opacity-60 transition-opacity"
                >
                  <p className="text-sm font-semibold text-foreground truncate">{song.song_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.song_artist}</p>
                </button>
                <button
                  onPointerDown={e => { e.preventDefault(); handleUnlike(song); }}
                  className="w-11 h-11 flex items-center justify-center text-red flex-shrink-0 active:scale-90 transition-all"
                >
                  <Heart size={17} fill="currentColor" />
                </button>
                {song.song_preview_url && (
                  <button
                    onPointerDown={e => { e.preventDefault(); togglePreview(song); }}
                    className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
                  >
                    {previewing
                      ? <Pause size={15} className="text-foreground" />
                      : <Play size={15} className="text-foreground ml-0.5" />
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(sheet, document.body);
};

export default LikedSongsSheet;
