import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, X, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface SongTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  albumArt: string | null;
  previewUrl: string | null;
  durationMs: number;
}

export interface SongSelection {
  track: SongTrack;
  snippetStartMs: number;
  snippetEndMs: number;
}

interface Props {
  value: SongSelection | null;
  onChange: (v: SongSelection | null) => void;
}

const PREVIEW_LEN_MS = 30_000;
const MIN_SNIPPET = 3_000;
const MAX_SNIPPET = 30_000;

const SongPicker: React.FC<Props> = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [snippetPlaying, setSnippetPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const base = import.meta.env.VITE_SUPABASE_URL;
        const url = `${base}/functions/v1/itunes-search?term=${encodeURIComponent(query.trim())}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const json = await res.json();
        const tracks: SongTrack[] = (json?.results || []).map((r: any) => ({
          id: String(r.trackId),
          name: r.trackName,
          artist: r.artistName,
          album: r.collectionName,
          albumArt: (r.artworkUrl100 || r.artworkUrl60 || '').replace('100x100', '200x200') || null,
          previewUrl: r.previewUrl || null,
          durationMs: r.trackTimeMillis || 30_000,
        }));
        setResults(tracks);
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') {
          console.error('itunes search failed', e);
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [query]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const playPreview = (track: SongTrack) => {
    if (!track.previewUrl) return;
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.src = track.previewUrl;
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setPlayingId(track.id)).catch(() => setPlayingId(null));
  };

  const selectTrack = (track: SongTrack) => {
    audioRef.current?.pause();
    setPlayingId(null);
    onChange({ track, snippetStartMs: 0, snippetEndMs: PREVIEW_LEN_MS });
    setResults([]);
    setQuery('');
  };

  const playSnippet = () => {
    if (!value?.track.previewUrl) return;
    if (snippetPlaying) {
      audioRef.current?.pause();
      setSnippetPlaying(false);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = value.track.previewUrl;
    audioRef.current.currentTime = value.snippetStartMs / 1000;
    const onTime = () => {
      if (audioRef.current && audioRef.current.currentTime * 1000 >= value.snippetEndMs) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', onTime);
        setSnippetPlaying(false);
      }
    };
    audioRef.current.addEventListener('timeupdate', onTime);
    audioRef.current.play().then(() => setSnippetPlaying(true)).catch(() => setSnippetPlaying(false));
  };

  const onRangeChange = (vals: number[]) => {
    if (!value) return;
    let [s, e] = vals;
    if (e - s < MIN_SNIPPET) e = s + MIN_SNIPPET;
    if (e - s > MAX_SNIPPET) e = s + MAX_SNIPPET;
    if (e > PREVIEW_LEN_MS) { e = PREVIEW_LEN_MS; s = Math.max(0, e - MAX_SNIPPET); }
    onChange({ ...value, snippetStartMs: s, snippetEndMs: e });
  };

  const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="space-y-2">
      {value ? (
        <div className="border border-border rounded-md p-3 bg-card/50 space-y-3">
          <div className="flex items-start gap-3">
            {value.track.albumArt && (
              <img src={value.track.albumArt} alt="" className="w-14 h-14 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{value.track.name}</div>
              <div className="text-xs text-muted-foreground truncate">{value.track.artist}</div>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => { audioRef.current?.pause(); setSnippetPlaying(false); onChange(null); }}>
              <X size={14} />
            </Button>
          </div>
          {value.track.previewUrl ? (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Snippet: {fmt(value.snippetStartMs)} – {fmt(value.snippetEndMs)} ({fmt(value.snippetEndMs - value.snippetStartMs)})</span>
                <Button type="button" size="sm" variant="outline" onClick={playSnippet} className="h-7">
                  {snippetPlaying ? <Pause size={12} /> : <Play size={12} />}
                  <span className="ml-1">{snippetPlaying ? 'Stop' : 'Preview'}</span>
                </Button>
              </div>
              <Slider
                min={0}
                max={PREVIEW_LEN_MS}
                step={100}
                value={[value.snippetStartMs, value.snippetEndMs]}
                onValueChange={onRangeChange}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0s</span><span>30s</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">No preview available for this track</div>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a song…"
              className="pl-7"
            />
            {searching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={14} />}
          </div>
          {results.length > 0 && (
            <div className="border border-border rounded-md max-h-72 overflow-y-auto divide-y divide-border">
              {results.map((t) => {
                const disabled = !t.previewUrl;
                return (
                  <div key={t.id} className={`flex items-center gap-2 p-2 ${disabled ? 'opacity-50' : 'hover:bg-accent/50'}`}>
                    {t.albumArt
                      ? <img src={t.albumArt} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded bg-muted flex-shrink-0" />
                    }
                    <button
                      type="button"
                      onClick={() => !disabled && selectTrack(t)}
                      disabled={disabled}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-sm text-foreground truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.artist}</div>
                      {disabled && <div className="text-[10px] text-muted-foreground">no preview available</div>}
                    </button>
                    {!disabled && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => playPreview(t)} className="h-8 w-8">
                        {playingId === t.id ? <Pause size={14} /> : <Play size={14} />}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SongPicker;
