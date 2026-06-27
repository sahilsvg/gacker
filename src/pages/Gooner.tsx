import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, ArrowLeft, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import RequireAuth, { AdminSession } from '@/components/RequireAuth';
import LocationPicker, { LocationValue } from '@/components/LocationPicker';
import SongPicker, { SongSelection } from '@/components/SongPicker';

const triggerCleanConfetti = () => {
  const end = Date.now() + 1200;
  const colors = ['#22c55e', '#16a34a', '#86efac', '#ffffff'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, startVelocity: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, startVelocity: 55, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors });
};

const triggerGoonAnimation = () => {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(container);
  const COUNT = 28;
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div');
    const fromLeft = i % 2 === 0;
    const size = 32 + Math.random() * 32;
    const startY = 10 + Math.random() * 50;
    const endY = 90 + Math.random() * 8;
    const startX = fromLeft ? -10 : 110;
    const midX = fromLeft ? 20 + Math.random() * 30 : 50 + Math.random() * 30;
    const rot = (Math.random() * 720 - 360) | 0;
    const delay = Math.random() * 400;
    const duration = 1600 + Math.random() * 900;
    el.textContent = '👎';
    el.style.cssText = `position:absolute;left:${startX}vw;top:${startY}vh;font-size:${size}px;line-height:1;will-change:transform,opacity;`;
    container.appendChild(el);
    const anim = el.animate(
      [
        { transform: `translate(0,0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${(midX - startX)}vw, ${((startY + endY) / 2 - startY)}vh) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${(50 + Math.random() * 30 - startX)}vw, ${(endY - startY)}vh) rotate(${rot}deg)`, opacity: 0.85 },
      ],
      { duration, delay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }
    );
    anim.onfinish = () => el.remove();
  }
  setTimeout(() => container.remove(), 3500);
};

const GoonerContent = ({ session, onLogout }: { session: AdminSession; onLogout: () => void }) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [song, setSong] = useState<SongSelection | null>(null);
  const { toast } = useToast();

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  const handleSubmit = async (gooned: boolean) => {
    if (!date) return;
    setLoading(true);
    const dateKey = formatDateKey(date);

    const payload = {
      gooned,
      notes: notes.trim() || null,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      location_name: location?.name || null,
      spotify_track_id: song?.track.id ?? null,
      spotify_track_name: song?.track.name ?? null,
      spotify_artist: song?.track.artist ?? null,
      spotify_album_art: song?.track.albumArt ?? null,
      spotify_preview_url: song?.track.previewUrl ?? null,
      snippet_start_ms: song?.snippetStartMs ?? null,
      snippet_end_ms: song?.snippetEndMs ?? null,
    };

    const { data: existing } = await supabase
      .from('goon_tracker')
      .select('id')
      .eq('date', dateKey)
      .eq('owner', session.owner)
      .maybeSingle();

    if (existing) {
      await supabase.from('goon_tracker').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('goon_tracker').insert({ date: dateKey, owner: session.owner, ...payload });
    }

    if (gooned) triggerGoonAnimation();
    else triggerCleanConfetti();

    toast({
      title: gooned ? '😔 Logged as gooned' : '🙏 Logged as clean!',
      description: `${session.label} · ${format(date, 'MMMM d, yyyy')}`,
    });

    setNotes('');
    setLocation(null);
    setSong(null);
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">Back to Tracker</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut size={14} className="mr-1" /> Sign out
          </Button>
        </div>

        <div className="bg-card/80 border border-border rounded-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground">📝 Log Status</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Signed in as <span className="text-foreground font-semibold">{session.username}</span> · Portal: <span className="text-foreground font-semibold">{session.label}</span>
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Select Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Location</label>
              <LocationPicker value={location} onChange={setLocation} />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Song</label>
              <SongPicker value={song} onChange={setSong} />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to remember about today…"
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => handleSubmit(false)} disabled={loading || !date} className="h-16 text-lg bg-primary hover:bg-primary/80">
                🙏 Clean
              </Button>
              <Button onClick={() => handleSubmit(true)} disabled={loading || !date} variant="destructive" className="h-16 text-lg">
                😔 Gooned
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Gooner = () => (
  <RequireAuth title="Admin Login">
    {(session) => (
      <GoonerContent
        session={session}
        onLogout={() => {
          sessionStorage.removeItem('ascension_admin');
          window.location.reload();
        }}
      />
    )}
  </RequireAuth>
);

export default Gooner;
