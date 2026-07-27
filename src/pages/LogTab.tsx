import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ChevronDown, ImagePlus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateKey, upsertEntry, fetchEntries, computeStats, Entry } from '@/lib/entries';
import { getFollowerIds } from '@/lib/social';
import { createNotificationsForMany } from '@/lib/notifications';
import { supabase } from '@/integrations/supabase/client';
import SongPicker, { SongSelection } from '@/components/SongPicker';
import DatePickerSheet from '@/components/DatePickerSheet';
import ImageCropper from '@/components/ImageCropper';
import LikedSongsSheet from '@/components/LikedSongsSheet';
import { haptic } from '@/lib/haptics';

const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 60, 90, 180, 365]);

const triggerCleanConfetti = () => {
  const colors = ['#22C55E', '#16a34a', '#86efac', '#ffffff'];
  const end = Date.now() + 1000;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, startVelocity: 50, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, startVelocity: 50, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const LogTab = ({ resetKey: _, isActive }: { resetKey: number; isActive?: boolean }) => {
  const { user } = useAuth();
  const todayKey = formatDateKey(new Date());

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [notes, setNotes] = useState('');
  const [song, setSong] = useState<SongSelection | null>(null);
  const [animating, setAnimating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showLikedSongs, setShowLikedSongs] = useState(false);

  // Image state
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null); // triggers cropper UI
  const [newImageBlob, setNewImageBlob] = useState<Blob | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false); // user explicitly removed existing image

  useEffect(() => {
    if (!isActive) { setShowPicker(false); setShowLikedSongs(false); }
  }, [isActive]);

  useEffect(() => {
    if (!user) return;
    fetchEntries(user.id).then(setEntries);
  }, [user]);

  // Reset image state when date changes
  useEffect(() => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageBlob(null);
    setNewImagePreview(null);
    setImageRemoved(false);
    const entry = entries[selectedDate];
    setNotes(entry?.notes ?? '');
    setSong(null);
  }, [selectedDate, entries]);

  const existingEntry = entries[selectedDate];
  const submitted = existingEntry ? (existingEntry.clean ? 'clean' : 'red') : null;
  const isToday = selectedDate === todayKey;

  // The image URL to actually display (new preview takes priority, then existing entry, unless removed)
  const displayImageUrl = newImagePreview ?? (imageRemoved ? null : (existingEntry?.image_url ?? null));

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropperSrc(objectUrl);
    e.target.value = ''; // reset so same file can re-trigger
  };

  const handleCropComplete = (blob: Blob) => {
    if (cropperSrc) URL.revokeObjectURL(cropperSrc);
    setCropperSrc(null);
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    const preview = URL.createObjectURL(blob);
    setNewImageBlob(blob);
    setNewImagePreview(preview);
    setImageRemoved(false);
  };

  const handleCropCancel = () => {
    if (cropperSrc) URL.revokeObjectURL(cropperSrc);
    setCropperSrc(null);
  };

  const removeImage = () => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageBlob(null);
    setNewImagePreview(null);
    setImageRemoved(true);
  };

  const handleLog = async (clean: boolean) => {
    if (!user || animating) return;
    clean ? haptic.success() : haptic.medium();
    setAnimating(true);

    // Upload new image if selected, otherwise keep/clear existing
    let imageUrl: string | null = null;
    if (newImageBlob) {
      const path = `${user.id}/${selectedDate}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('post-images')
        .upload(path, newImageBlob, { contentType: 'image/jpeg', upsert: true });
      if (!error) {
        imageUrl = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
      }
    } else if (!imageRemoved) {
      imageUrl = existingEntry?.image_url ?? null;
    }

    await upsertEntry(user.id, selectedDate, clean, notes.trim(), null, song, imageUrl);
    const updated = await fetchEntries(user.id);
    setEntries(updated);

    if (!clean) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:-200px;left:-200px;right:-200px;bottom:-200px;background:rgb(210,0,0);z-index:999999;pointer-events:none;opacity:0;transition:opacity 0.2s ease-in;';
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = '1';
        setTimeout(() => {
          el.style.transition = 'opacity 1s ease-out';
          el.style.opacity = '0';
          setTimeout(() => el.remove(), 1100);
        }, 1800);
      }));
    }
    if (clean) {
      triggerCleanConfetti();
      const { streak } = computeStats(updated);
      if (STREAK_MILESTONES.has(streak)) {
        getFollowerIds(user.id).then(ids => {
          createNotificationsForMany(ids, 'streak_milestone', user.id, { streak_count: streak });
        });
      }
    }
    setTimeout(() => setAnimating(false), 1200);
  };

  const [y, m, d] = selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      {cropperSrc && (
        <ImageCropper
          src={cropperSrc}
          shape="square"
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      <div className="flex flex-col h-full tab-bar-padding">
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">

          <div className="mb-8">
            <h1 className="font-wordmark text-5xl text-foreground mb-3">The Gacker</h1>
            <button
              onPointerDown={e => { e.preventDefault(); setShowPicker(true); }}
              className="flex items-center gap-1.5 active:opacity-60 transition-opacity"
            >
              <span className="text-muted-foreground text-sm font-medium">{dateLabel}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
            {!isToday && (
              <button
                onPointerDown={e => { e.preventDefault(); setSelectedDate(todayKey); }}
                className="mt-1.5 text-xs text-clean font-medium active:opacity-60"
              >
                Back to today
              </button>
            )}
          </div>

          {submitted && (
            <div className={`rounded-2xl p-4 mb-6 border animate-fade-in ${
              submitted === 'clean'
                ? 'bg-clean/10 border-clean/30 text-clean'
                : 'bg-red/10 border-red/30 text-red'
            }`}>
              <p className="font-semibold text-sm">
                {submitted === 'clean' ? 'Clean day logged.' : 'Red day logged.'}
              </p>
              <p className="text-xs opacity-70 mt-0.5">
                {submitted === 'clean' ? 'Nothing to see here.' : "That's a mark — keep it moving."}
              </p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {/* Song */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Song <span className="font-normal normal-case">(optional)</span>
                </label>
                <button
                  onPointerDown={e => { e.preventDefault(); setShowLikedSongs(true); }}
                  className="text-xs font-semibold text-clean active:opacity-60 transition-opacity py-1 pl-2"
                >
                  Liked Songs
                </button>
              </div>
              <SongPicker value={song} onChange={setSong} />
            </div>

            {/* Photo — between Song and Notes */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Photo <span className="font-normal normal-case">(optional)</span>
              </label>
              {displayImageUrl ? (
                <div className="relative rounded-2xl overflow-hidden">
                  <img
                    src={displayImageUrl}
                    alt=""
                    className="w-full h-56 object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onPointerDown={e => { e.preventDefault(); imageInputRef.current?.click(); }}
                      className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-xl active:opacity-60"
                    >
                      Change
                    </button>
                    <button
                      onPointerDown={e => { e.preventDefault(); removeImage(); }}
                      className="bg-black/60 text-white w-8 h-8 rounded-xl flex items-center justify-center active:opacity-60"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onPointerDown={e => { e.preventDefault(); imageInputRef.current?.click(); }}
                  className="w-full h-28 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground active:border-foreground/30 transition-colors"
                >
                  <ImagePlus size={22} />
                  <span className="text-xs font-medium">Add Photo</span>
                </button>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Notes <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything to note about today…"
                rows={4}
                maxLength={2000}
                className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleLog(true)}
              disabled={animating}
              className="w-full h-16 rounded-2xl bg-clean text-clean-foreground font-semibold text-lg tracking-wide transition-all active:scale-95 disabled:opacity-60 shadow-[0_0_24px_hsl(142_71%_45%/0.25)]"
            >
              Clean Day
            </button>
            <button
              onClick={() => handleLog(false)}
              disabled={animating}
              className="w-full h-16 rounded-2xl bg-red text-red-foreground font-semibold text-lg tracking-wide transition-all active:scale-95 disabled:opacity-60 shadow-[0_0_24px_hsl(0_84%_60%/0.2)]"
            >
              Red Day
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            {isToday ? 'Tap again to update today\'s entry.' : 'Logging for a past date.'}
          </p>
        </div>

        {showPicker && (
          <DatePickerSheet
            selected={selectedDate}
            entries={entries}
            onSelect={date => setSelectedDate(date)}
            onClose={() => setShowPicker(false)}
          />
        )}
        {showLikedSongs && (
          <LikedSongsSheet
            onSelect={selection => { setSong(selection); setShowLikedSongs(false); }}
            onClose={() => setShowLikedSongs(false)}
          />
        )}
      </div>
    </>
  );
};

export default LogTab;
