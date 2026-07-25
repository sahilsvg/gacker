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
    setTimeout(() => setVisible(false), 220);
  };

  if (!visible || !currentSong) return null;

  return (
    <div
      className={`fixed left-3 right-3 z-[90] ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}
    >
      <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl px-3 py-2.5 flex items-center gap-3 shadow-xl">
        {/* Album art */}
        {currentSong.albumArt
          ? <img src={currentSong.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
        }

        {/* Song info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{currentSong.name}</p>
          <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
        </div>

        {/* Add to liked — placeholder for now */}
        <button
          onPointerDown={e => e.preventDefault()}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground active:opacity-60 transition-opacity flex-shrink-0"
        >
          <Heart size={17} />
        </button>

        {/* Play / Pause */}
        <button
          onPointerDown={e => { e.preventDefault(); togglePlay(); }}
          className="w-8 h-8 flex items-center justify-center text-foreground active:opacity-60 transition-opacity flex-shrink-0"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        {/* Close — stops the song entirely */}
        <button
          onPointerDown={e => { e.preventDefault(); handleClose(); }}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground active:opacity-60 transition-opacity flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
