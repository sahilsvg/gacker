import React, { createContext, useContext, useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface PlayerSong {
  url: string;
  name: string;
  artist: string;
  albumArt: string | null;
}

interface PlayerContextType {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  play: (song: PlayerSong) => void;
  togglePlay: () => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextType>({
  currentSong: null,
  isPlaying: false,
  play: () => {},
  togglePlay: () => {},
  stop: () => {},
});

// One Audio instance for the entire app — prevents simultaneous playback
const audio = new Audio();

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<PlayerSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    audio.onended = () => setIsPlaying(false);

    // Pause when user leaves the app
    if (Capacitor.isNativePlatform()) {
      let removeListener: (() => void) | undefined;
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          audio.pause();
          setIsPlaying(false);
        }
      }).then(handle => { removeListener = () => handle.remove(); });
      return () => { removeListener?.(); };
    }
  }, []);

  const play = (song: PlayerSong) => {
    if (currentSong?.url === song.url) {
      // Same song — just toggle
      if (audio.paused) {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }
    // New song — stop whatever is playing and start this one
    audio.pause();
    audio.src = song.url;
    audio.currentTime = 0;
    audio.play()
      .then(() => { setCurrentSong(song); setIsPlaying(true); })
      .catch(() => {});
  };

  const togglePlay = () => {
    if (!currentSong) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    setCurrentSong(null);
    setIsPlaying(false);
  };

  return (
    <PlayerContext.Provider value={{ currentSong, isPlaying, play, togglePlay, stop }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
