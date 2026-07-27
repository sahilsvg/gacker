import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, X, Search, Loader2, Music, Square } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';
import { usePlayer } from '@/contexts/PlayerContext';

export interface SongTrack {
  id: string;
  name: string;
  artist: string;
  albumArt: string | null;
  previewUrl: string | null;
}

export interface SongSelection {
  track: SongTrack;
}

interface Props {
  value: SongSelection | null;
  onChange: (v: SongSelection | null) => void;
}

const searchItunes = async (query: string): Promise<SongTrack[]> => {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20&country=us`;
  console.log('[SongPicker] fetching:', url);
  const response = await CapacitorHttp.get({ url });
  console.log('[SongPicker] status:', response.status, 'data type:', typeof response.data);

  // CapacitorHttp may return data as a string or already-parsed object
  const json = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  console.log('[SongPicker] resultCount:', json?.resultCount, 'first:', JSON.stringify(json?.results?.[0])?.slice(0, 100));

  const results = json?.results ?? [];
  return results.map((r: any) => ({
    id: String(r.trackId),
    name: r.trackName ?? '',
    artist: r.artistName ?? '',
    albumArt: r.artworkUrl100
      ? r.artworkUrl100.replace('100x100bb', '300x300bb')
      : null,
    previewUrl: r.previewUrl ?? null,
  }));
};

const SongPicker = ({ value, onChange }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const { play: globalPlay, stop: globalStop, currentSong, isPlaying } = usePlayer();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setError(''); return; }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const tracks = await searchItunes(query);
        setResults(tracks);
        if (tracks.length === 0) setError('No results found.');
      } catch (e: any) {
        setError('Search failed — check your connection.');
        setResults([]);
      }
      setSearching(false);
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  // Stop preview when picker unmounts
  useEffect(() => () => { globalStop(); }, []);

  const togglePreview = (track: SongTrack) => {
    if (!track.previewUrl) return;
    globalPlay({ url: track.previewUrl, name: track.name, artist: track.artist, albumArt: track.albumArt });
  };

  const selectTrack = (track: SongTrack) => {
    globalStop();
    onChange({ track });
    setResults([]);
    setQuery('');
  };

  const clear = () => {
    globalStop();
    onChange(null);
  };

  if (value) {
    const selectedPlaying = currentSong?.url === value.track.previewUrl && isPlaying;
    return (
      <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3">
        {value.track.albumArt
          ? <img src={value.track.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Music size={16} className="text-muted-foreground" />
            </div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{value.track.name}</p>
          <p className="text-xs text-muted-foreground truncate">{value.track.artist}</p>
        </div>
        {value.track.previewUrl && (
          <button
            onPointerDown={e => { e.preventDefault(); togglePreview(value.track); }}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
          >
            {selectedPlaying
              ? <Pause size={13} className="text-foreground" />
              : <Play size={13} className="text-foreground ml-0.5" />
            }
          </button>
        )}
        <button onPointerDown={e => { e.preventDefault(); clear(); }} className="text-muted-foreground p-1 flex-shrink-0">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-3 focus-within:ring-1 focus-within:ring-ring transition-all">
        {searching
          ? <Loader2 size={15} className="animate-spin text-muted-foreground flex-shrink-0" />
          : <Search size={15} className="text-muted-foreground flex-shrink-0" />
        }
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for a song…"
          className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onPointerDown={e => { e.preventDefault(); setQuery(''); setResults([]); setError(''); }}>
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {error && !searching && (
        <p className="text-xs text-muted-foreground px-1">{error}</p>
      )}

      {results.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {results.map(track => (
            <div key={track.id} className="flex items-center gap-3 px-4 py-3">
              {track.albumArt
                ? <img src={track.albumArt} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-9 h-9 rounded-lg bg-muted flex-shrink-0" />
              }
              <button onPointerDown={e => { e.preventDefault(); selectTrack(track); }} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate">{track.name}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
              </button>
              {track.previewUrl && (
                <button
                  onPointerDown={e => { e.preventDefault(); togglePreview(track); }}
                  className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
                >
                  {currentSong?.url === track.previewUrl && isPlaying
                    ? <Pause size={15} className="text-foreground" />
                    : <Play size={15} className="text-foreground ml-0.5" />
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SongPicker;
