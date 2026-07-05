import React, { useRef, useState } from 'react';
import { X, Music, Play, Pause } from 'lucide-react';
import { Entry } from '@/lib/entries';
import { timeAgo } from '@/lib/timeAgo';

interface Props {
  dateKey: string;
  entry: Entry;
  onClose: () => void;
}

const EntryDetailSheet = ({ dateKey, entry, onClose }: Props) => {
  const [playing, setPlaying] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClose = () => { stop(); setIsClosing(true); setTimeout(onClose, 210); };

  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const togglePlay = () => {
    if (!entry.song_preview_url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = entry.song_preview_url;
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const stop = () => { audioRef.current?.pause(); setPlaying(false); };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onPointerDown={handleClose} />
      <div
        className={`relative bg-card rounded-t-3xl flex flex-col ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ height: '72vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <p className="font-semibold text-foreground text-sm">{dateLabel}</p>
            {entry.created_at && <p className="text-[10px] text-muted-foreground/60 mt-0.5">logged {timeAgo(entry.created_at)}</p>}
          </div>
          <button onPointerDown={e => { e.preventDefault(); handleClose(); }} className="text-muted-foreground active:opacity-60">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Status */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            entry.clean ? 'bg-clean/15 text-clean' : 'bg-red/15 text-red'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${entry.clean ? 'bg-clean' : 'bg-red'}`} />
            {entry.clean ? 'Clean Day' : 'Red Day'}
          </div>

          {/* Song — shown first so it's always visible */}
          {entry.song_name && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Song</p>
              <div className="flex items-center gap-3 bg-background border border-border/50 rounded-2xl px-3 py-3">
                {entry.song_album_art
                  ? <img src={entry.song_album_art} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Music size={14} className="text-muted-foreground" />
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{entry.song_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{entry.song_artist}</p>
                </div>
                {entry.song_preview_url && (
                  <button
                    onPointerDown={e => { e.preventDefault(); togglePlay(); }}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
                  >
                    {playing
                      ? <Pause size={14} className="text-foreground" />
                      : <Play size={14} className="text-foreground ml-0.5" />
                    }
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {entry.notes ? (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
              <p className="text-sm text-foreground/90 leading-relaxed">{entry.notes}</p>
            </div>
          ) : (
            !entry.song_name && <p className="text-sm text-muted-foreground italic">No notes recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryDetailSheet;
