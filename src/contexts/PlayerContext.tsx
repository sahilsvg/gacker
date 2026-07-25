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
// Lazily created so it initialises after the DOM is ready
let audio: HTMLAudioElement | null = null;
const getAudio = (): HTMLAudioElement => {
  if (!audio) audio = new Audio();
  return audio;
};

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<PlayerSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    getAudio().onended = () => setIsPlaying(false);

    // Pause when user leaves the app
    if (Capacitor.isNativePlatform()) {
      let removeListener: (() => void) | undefined;
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          getAudio().pause();
          setIsPlaying(false);
        }
      }).then(handle => { removeListener = () => handle.remove(); });
      return () => { removeListener?.(); };
    }
  }, []);

  const play = (song: PlayerSong) => {
    const a = getAudio();
    if (currentSong?.url === song.url) {
      if (a.paused) {
        a.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        a.pause();
        setIsPlaying(false);
      }
      return;
    }
    a.pause();
    a.src = song.url;
    a.currentTime = 0;
    a.play()
      .then(() => { setCurrentSong(song); setIsPlaying(true); })
      .catch(() => {});
  };

  const togglePlay = () => {
    if (!currentSong) return;
    const a = getAudio();
    if (a.paused) {
      a.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setIsPlaying(false);
    }
  };

  const stop = () => {
    const a = getAudio();
    a.pause();
    a.currentTime = 0;
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
