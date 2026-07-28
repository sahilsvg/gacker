import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, X, Heart } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/lib/haptics';
import { isLikedSong, toggleLikedSong, onLikeChange } from '@/lib/likedSongs';

const MiniPlayer = () => {
  const { currentSong, isPlaying, togglePlay, stop } = usePlayer();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [displaySong, setDisplaySong] = useState(currentSong);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setDisplaySong(currentSong);
      setIsClosing(false);
      setVisible(true);
      if (user && currentSong.url) {
        isLikedSong(user.id, currentSong.url).then(setLiked);
      }
    }
  }, [currentSong, user]);

  // Sync liked state when changed from another component
  useEffect(() => {
    return onLikeChange((previewUrl, liked) => {
      if (previewUrl === displaySong?.url) setLiked(liked);
    });
  }, [displaySong?.url]);

  const handleToggleLike = useCallback(async () => {
    if (!user || !displaySong?.url) return;
    haptic.light();
    const next = !liked;
    setLiked(next);
    await toggleLikedSong(
      user.id,
      { name: displaySong.name, artist: displaySong.artist, albumArt: displaySong.albumArt, previewUrl: displaySong.url },
      !next,
    );
  }, [user, displaySong, liked]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      stop();
      setVisible(false);
    }, 400);
  };

  if (!visible || !displaySong) return null;

  return (
    <div
      className={`fixed left-3 right-3 z-[90] ${isClosing ? 'animate-cloud-out' : 'animate-slide-up'}`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}
    >
      <div className="bg-[hsl(220,28%,14%)] backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2.5 flex items-center gap-3 shadow-2xl shadow-black/40">
        {/* Album art */}
        {displaySong.albumArt
          ? <img src={displaySong.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
        }

        {/* Song info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{displaySong.name}</p>
          <p className="text-xs text-white/50 truncate">{displaySong.artist}</p>
        </div>

        {/* Like song */}
        <button
          onPointerDown={e => { e.preventDefault(); handleToggleLike(); }}
          className={`w-11 h-11 flex items-center justify-center transition-all flex-shrink-0 active:scale-90 ${liked ? 'text-red' : 'text-white/40'}`}
        >
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
        </button>

        {/* Play / Pause — bright green circle, dark icon */}
        <button
          onPointerDown={e => { e.preventDefault(); haptic.light(); togglePlay(); }}
          className="w-11 h-11 rounded-full bg-clean flex items-center justify-center flex-shrink-0 active:scale-90 transition-all shadow-lg shadow-clean/30"
        >
          {isPlaying
            ? <Pause size={17} fill="hsl(220,33%,6%)" className="text-[hsl(220,33%,6%)]" />
            : <Play size={17} fill="hsl(220,33%,6%)" className="text-[hsl(220,33%,6%)] ml-0.5" />
          }
        </button>

        {/* Close — stops the song entirely */}
        <button
          onPointerDown={e => { e.preventDefault(); handleClose(); }}
          className="w-11 h-11 flex items-center justify-center text-white/40 active:opacity-60 transition-opacity flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
