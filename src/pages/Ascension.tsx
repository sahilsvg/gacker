import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MapPin, StickyNote, ExternalLink, Music } from 'lucide-react';
import SnippetPlayer from '@/components/SnippetPlayer';

const START_DATE = new Date(2026, 4, 13);
const END_DATE = new Date(2027, 4, 31);

type Owner = 'helium' | 'prize';
const OWNERS: { id: Owner; label: string }[] = [
  { id: 'helium', label: 'Helium' },
  { id: 'prize', label: 'Prize' },
];

interface DayRow {
  date: string;
  gooned: boolean;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  spotify_track_name: string | null;
  spotify_artist: string | null;
  spotify_album_art: string | null;
  spotify_preview_url: string | null;
  snippet_start_ms: number | null;
  snippet_end_ms: number | null;
}

const Ascension = ({ initialOwner = 'helium' }: { initialOwner?: Owner }) => {
  const [owner, setOwner] = useState<Owner>(initialOwner);
  const navigate = useNavigate();

  useEffect(() => { setOwner(initialOwner); }, [initialOwner]);

  const [entries, setEntries] = useState<Record<string, DayRow>>({});
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data } = await supabase
        .from('goon_tracker')
        .select('date, gooned, notes, latitude, longitude, location_name, spotify_track_name, spotify_artist, spotify_album_art, spotify_preview_url, snippet_start_ms, snippet_end_ms')
        .eq('owner', owner);

      const map: Record<string, DayRow> = {};
      (data || []).forEach((row: DayRow) => { map[row.date] = row; });
      setEntries(map);
      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel(`goon_tracker_changes_${owner}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goon_tracker' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [owner]);

  const statuses: Record<string, boolean> = Object.fromEntries(
    Object.entries(entries).map(([k, v]) => [k, v.gooned])
  );


  const allDates: Date[] = [];
  for (let d = new Date(START_DATE); d <= END_DATE; d.setDate(d.getDate() + 1)) {
    allDates.push(new Date(d));
  }

  const months: Record<string, Date[]> = {};
  allDates.forEach(d => {
    const key = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!months[key]) months[key] = [];
    months[key].push(new Date(d));
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const cleanDays = allDates.filter(d => {
    const key = formatDateKey(d);
    return d <= today && statuses[key] === false;
  }).length;
  const goonDays = allDates.filter(d => {
    const key = formatDateKey(d);
    return d <= today && statuses[key] === true;
  }).length;

  let streak = 0;
  let foundLogged = false;
  for (let i = allDates.length - 1; i >= 0; i--) {
    const d = allDates[i];
    if (d > today) continue;
    const key = formatDateKey(d);
    if (!(key in statuses)) {
      if (foundLogged) break;
      continue;
    }
    foundLogged = true;
    if (statuses[key] === false) {
      streak++;
    } else {
      break;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground/60 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <ThemeToggle />
      <div className="max-w-2xl mx-auto">

        <div className="text-center mb-8">
          <h1 className="font-cursive text-6xl sm:text-7xl text-foreground mb-2 tracking-tight animate-reveal-lr inline-block">
            The Gacker
          </h1>
          <p className="text-muted-foreground text-sm">
            May 13, 2026 → May 31, 2027
          </p>
        </div>

        {/* Owner Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border border-border bg-card/60 p-1">
            {OWNERS.map(o => (
              <button
                key={o.id}
                onClick={() => { setOwner(o.id); navigate(`/${o.id}`); }}
                className={`px-5 py-2 text-sm font-semibold rounded-md transition-colors ${
                  owner === o.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-card/80 rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-clean">{streak}</div>
            <div className="text-xs text-muted-foreground mt-1">Day Streak</div>
          </div>
          <div className="bg-card/80 rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-clean">{cleanDays}</div>
            <div className="text-xs text-muted-foreground mt-1">Clean Days</div>
          </div>
          <div className="bg-card/80 rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-goon">{goonDays}</div>
            <div className="text-xs text-muted-foreground mt-1">Goon Days</div>
          </div>
        </div>

        {/* Calendar */}
        {Object.entries(months).map(([monthName, dates]) => {
          const firstDow = dates[0].getDay();
          const blanks = Array.from({ length: firstDow }, (_, i) => i);

          return (
            <div key={monthName} className="mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">{monthName}</h2>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {blanks.map(i => <div key={`blank-${i}`} />)}
                {dates.map(d => {
                  const key = formatDateKey(d);
                  const isFuture = d > today;
                  const hasData = key in statuses;
                  const gooned = statuses[key];

                  return (
                    <div key={key} className="flex flex-col items-center py-1">
                      <span className="text-[10px] text-muted-foreground mb-0.5">{d.getDate()}</span>
                      <button
                        type="button"
                        onClick={() => hasData && setSelectedKey(key)}
                        disabled={!hasData}
                        aria-label={hasData ? `View details for ${key}` : undefined}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isFuture
                            ? 'bg-muted/30 border border-border/50 cursor-default'
                            : hasData
                              ? gooned
                                ? 'bg-goon/90 text-goon-foreground shadow-[0_0_8px_hsl(var(--goon-glow)/0.4)] cursor-pointer hover:scale-110'
                                : 'bg-clean/90 text-clean-foreground shadow-[0_0_8px_hsl(var(--clean-glow)/0.4)] cursor-pointer hover:scale-110'
                              : 'bg-muted/50 border border-border/50 cursor-default'
                        }`}
                      >
                        {isFuture ? '' : hasData ? (gooned ? '✗' : '✓') : '?'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-clean/90" />
            <span>Clean</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-goon/90" />
            <span>Gooned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-muted/50 border border-border/50" />
            <span>Not logged</span>
          </div>
        </div>

      </div>

      <Dialog open={!!selectedKey} onOpenChange={(o) => !o && setSelectedKey(null)}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[85vh]">
          {selectedKey && entries[selectedKey] && (() => {
            const row = entries[selectedKey];
            const [y, m, d] = selectedKey.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            const mapsUrl = row.latitude != null && row.longitude != null
              ? `https://www.google.com/maps/search/?api=1&query=${row.latitude},${row.longitude}`
              : null;
            const embedSrc = row.latitude != null && row.longitude != null
              ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}&z=14&output=embed`
              : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${row.gooned ? 'bg-goon/90 text-goon-foreground' : 'bg-clean/90 text-clean-foreground'}`}>
                      {row.gooned ? '✗' : '✓'}
                    </span>
                    {dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </DialogTitle>
                  <DialogDescription className={row.gooned ? 'text-goon' : 'text-clean'}>
                    {row.gooned ? 'Gooned 😔' : 'Clean 🙏'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <MapPin size={12} /> Location
                    </div>
                    {row.location_name || row.latitude != null ? (
                      <>
                        <div className="text-sm text-foreground break-words">
                          {row.location_name || `${row.latitude?.toFixed(5)}, ${row.longitude?.toFixed(5)}`}
                        </div>
                        {embedSrc && (
                          <div className="mt-2 rounded-md overflow-hidden border border-border">
                            <iframe
                              title="Map"
                              src={embedSrc}
                              width="100%"
                              height="180"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              style={{ border: 0 }}
                            />
                          </div>
                        )}
                        {mapsUrl && (
                          <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                            Open in Google Maps <ExternalLink size={11} />
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">No location recorded</div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <StickyNote size={12} /> Notes
                    </div>
                    {row.notes ? (
                      <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-3 border border-border">
                        {row.notes}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">No notes</div>
                    )}
                  </div>

                  {row.spotify_track_name && (
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        <Music size={12} /> Song
                      </div>
                      <SnippetPlayer
                        trackName={row.spotify_track_name}
                        artist={row.spotify_artist || ''}
                        albumArt={row.spotify_album_art}
                        previewUrl={row.spotify_preview_url}
                        snippetStartMs={row.snippet_start_ms}
                        snippetEndMs={row.snippet_end_ms}
                      />
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ascension;
