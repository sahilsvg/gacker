import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface Props {
  trackName: string;
  artist: string;
  albumArt: string | null;
  previewUrl: string | null;
  snippetStartMs: number | null;
  snippetEndMs: number | null;
}

const SnippetPlayer: React.FC<Props> = ({ trackName, artist, albumArt, previewUrl, snippetStartMs, snippetEndMs }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = () => {
    if (!previewUrl) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = previewUrl;
    const start = (snippetStartMs ?? 0) / 1000;
    const end = (snippetEndMs ?? 30_000) / 1000;
    audioRef.current.currentTime = start;
    const onTime = () => {
      if (audioRef.current && audioRef.current.currentTime >= end) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', onTime);
        setPlaying(false);
      }
    };
    audioRef.current.addEventListener('timeupdate', onTime);
    audioRef.current.onended = () => setPlaying(false);
    audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-md border border-border bg-muted/30">
      {albumArt
        ? <img src={albumArt} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
        : <div className="w-12 h-12 rounded bg-muted flex-shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{trackName}</div>
        <div className="text-xs text-muted-foreground truncate">{artist}</div>
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={toggle}
        disabled={!previewUrl}
        title={previewUrl ? 'Play snippet' : 'No preview available'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </Button>
    </div>
  );
};

export default SnippetPlayer;
