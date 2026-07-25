import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

interface Props {
  trackName: string;
  artist: string;
  albumArt: string | null;
  previewUrl: string | null;
  snippetStartMs: number | null;
  snippetEndMs: number | null;
}

const SnippetPlayer: React.FC<Props> = ({ trackName, artist, albumArt, previewUrl }) => {
  const { play, currentSong, isPlaying } = usePlayer();
  const playing = currentSong?.url === previewUrl && isPlaying;

  const toggle = () => {
    if (!previewUrl) return;
    play({ url: previewUrl, name: trackName, artist, albumArt });
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
