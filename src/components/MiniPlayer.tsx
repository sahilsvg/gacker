import React, { useState, useEffect } from 'react';
import { Play, Pause, X, Heart } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

const MiniPlayer = () => {
  const { currentSong, isPlaying, togglePlay, stop } = usePlayer();
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setIsClosing(false);
      setVisible(true);
    }
  }, [currentSong]);

  const handleClose = () => {
    stop();
    setIsClosing(true);
    setTimeout(() => setVisible(false), 400);
  };

  if (!visible || !currentSong) return null;

  return (
    <div
      className={`fixed left-3 right-3 z-[90] ${isClosing ? 'animate-cloud-out' : 'animate-slide-up'}`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}
    >
      <div className="bg-[hsl(220,28%,14%)] backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2.5 flex items-center gap-3 shadow-2xl shadow-black/40">
        {/* Album art */}
        {currentSong.albumArt
          ? <img src={currentSong.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
        }

        {/* Song info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{currentSong.name}</p>
          <p className="text-xs text-white/50 truncate">{currentSong.artist}</p>
        </div>

        {/* Add to liked — placeholder for now */}
        <button
          onPointerDown={e => e.preventDefault()}
          className="w-8 h-8 flex items-center justify-center text-white/40 active:opacity-60 transition-opacity flex-shrink-0"
        >
          <Heart size={17} />
        </button>

        {/* Play / Pause — bright green circle, dark icon */}
        <button
          onPointerDown={e => { e.preventDefault(); togglePlay(); }}
          className="w-9 h-9 rounded-full bg-clean flex items-center justify-center flex-shrink-0 active:scale-90 transition-all shadow-lg shadow-clean/30"
        >
          {isPlaying
            ? <Pause size={16} fill="hsl(220,33%,6%)" className="text-[hsl(220,33%,6%)]" />
            : <Play size={16} fill="hsl(220,33%,6%)" className="text-[hsl(220,33%,6%)] ml-0.5" />
          }
        </button>

        {/* Close — stops the song entirely */}
        <button
          onPointerDown={e => { e.preventDefault(); handleClose(); }}
          className="w-8 h-8 flex items-center justify-center text-white/40 active:opacity-60 transition-opacity flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
