import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Heart, Music, Target, CalendarDays, Grid3x3, LucideIcon } from 'lucide-react';
import { Entry, computeStats } from '@/lib/entries';
import { usePlayer } from '@/contexts/PlayerContext';
import { getLikedSongs, toggleLikedSong, onLikeChange } from '@/lib/likedSongs';
import { haptic } from '@/lib/haptics';
import { useTapList } from '@/hooks/useTap';
import { Goal, getGoalHistory } from '@/lib/goals';
import CalendarView from './CalendarView';
import EntryDetailSheet from './EntryDetailSheet';

type SubTab = 'history' | 'images' | 'music' | 'goals';

interface Props {
  entries: Record<string, Entry>;
  profileUserId: string;       // whose profile this is (for the Goals tab)
  currentUserId: string;       // logged-in user (for like buttons)
  canSeeContent: boolean;      // own profile or accepted follower
  lockedMessage?: string;      // shown when !canSeeContent
}

const ProfileTabs = ({ entries, profileUserId, currentUserId, canSeeContent, lockedMessage }: Props) => {
  const [subTab, setSubTab] = useState<SubTab>('history');
  const [entryDetail, setEntryDetail] = useState<{ dateKey: string; entry: Entry } | null>(null);
  const [likedUrls, setLikedUrls] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const { play, stop, currentSong, isPlaying } = usePlayer();

  // Goal history is only fetched when the tab is opened — most visits never do.
  useEffect(() => {
    if (subTab !== 'goals' || goals !== null || !canSeeContent) return;
    getGoalHistory(profileUserId).then(setGoals);
  }, [subTab, goals, canSeeContent, profileUserId]);

  // Load logged-in user's liked songs for the Music tab heart buttons
  useEffect(() => {
    getLikedSongs(currentUserId).then(songs => {
      setLikedUrls(new Set(songs.map(s => s.song_preview_url)));
    });
  }, [currentUserId]);

  // Sync liked state when changed from MiniPlayer or anywhere else
  useEffect(() => {
    return onLikeChange((previewUrl, liked) => {
      setLikedUrls(prev => {
        const next = new Set(prev);
        if (liked) next.add(previewUrl);
        else next.delete(previewUrl);
        return next;
      });
    });
  }, []);

  // Build sorted entry lists from the record
  const sortedEntries = Object.entries(entries)
    .map(([dateKey, entry]) => ({ dateKey, entry }))
    .sort((a, b) => (b.entry.created_at ?? b.dateKey).localeCompare(a.entry.created_at ?? a.dateKey));

  const imagePosts = sortedEntries.filter(({ entry }) => !!entry.image_url);
  const musicPosts = sortedEntries.filter(({ entry }) => !!entry.song_name && !!entry.song_preview_url);

  // Swipe-aware tap handlers for lists
  const tapList = useTapList();

  // Per-song last-tap timestamps for double-tap detection
  const lastTapMap = useRef<Map<string, number>>(new Map());

  const handleToggleLike = useCallback(async (previewUrl: string, name: string, artist: string, albumArt: string | null | undefined) => {
    haptic.light();
    const currentlyLiked = likedUrls.has(previewUrl);
    const next = new Set(likedUrls);
    if (currentlyLiked) next.delete(previewUrl);
    else next.add(previewUrl);
    setLikedUrls(next);
    await toggleLikedSong(
      currentUserId,
      { name, artist, albumArt: albumArt ?? null, previewUrl },
      currentlyLiked,
    );
  }, [currentUserId, likedUrls]);

  // Icons rather than labels, Instagram-style. label is kept for aria-label so
  // the tabs are still announced to VoiceOver.
  const TABS: { id: SubTab; label: string; Icon: LucideIcon }[] = [
    { id: 'history', label: 'History', Icon: CalendarDays },
    { id: 'images', label: 'Images', Icon: Grid3x3 },
    { id: 'music', label: 'Music', Icon: Music },
    { id: 'goals', label: 'Goals', Icon: Target },
  ];

  return (
    <>
      {/* Tab bar — underline indicator, no labels */}
      <div className="flex border-b border-border mb-6">
        {TABS.map(t => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              aria-label={t.label}
              aria-selected={active}
              role="tab"
              onPointerDown={e => { e.preventDefault(); setSubTab(t.id); }}
              // -mb-px pulls the indicator onto the container's border so the
              // active underline replaces it rather than sitting above it.
              className={`flex-1 h-12 -mb-px flex items-center justify-center border-b-2 transition-colors ${
                active
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground/50'
              }`}
            >
              <t.Icon size={20} strokeWidth={active ? 2.4 : 2} />
            </button>
          );
        })}
      </div>

      {/* Locked state */}
      {!canSeeContent ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-muted-foreground text-sm">{lockedMessage ?? 'Follow to see content.'}</p>
        </div>
      ) : (
        <>
          {/* HISTORY */}
          {subTab === 'history' && (
            <CalendarView entries={entries} onDayTap={(dateKey, entry) => setEntryDetail({ dateKey, entry })} />
          )}

          {/* IMAGES */}
          {subTab === 'images' && (
            imagePosts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">No images posted yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {imagePosts.map(({ dateKey, entry }) => (
                  <div
                    key={dateKey}
                    {...tapList(dateKey, () => setEntryDetail({ dateKey, entry }))}
                    className="aspect-square overflow-hidden active:opacity-80 transition-opacity"
                  >
                    <img
                      src={entry.image_url!}
                      alt=""
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  </div>
                ))}
              </div>
            )
          )}

          {/* MUSIC */}
          {subTab === 'music' && (
            musicPosts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">No songs logged yet.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {musicPosts.map(({ dateKey, entry }) => {
                  const previewUrl = entry.song_preview_url!;
                  const previewing = currentSong?.url === previewUrl && isPlaying;
                  const liked = likedUrls.has(previewUrl);

                  const rowTapHandlers = tapList(previewUrl, (e) => {
                    const now = Date.now();
                    const last = lastTapMap.current.get(previewUrl) ?? 0;
                    lastTapMap.current.set(previewUrl, now);

                    if (now - last < 350) {
                      // Double tap → like / unlike
                      haptic.medium();
                      handleToggleLike(previewUrl, entry.song_name!, entry.song_artist!, entry.song_album_art);
                    } else {
                      // Single tap → play / pause
                      haptic.light();
                      play({ url: previewUrl, name: entry.song_name!, artist: entry.song_artist!, albumArt: entry.song_album_art ?? null });
                    }
                  });

                  return (
                    <div
                      key={dateKey}
                      {...rowTapHandlers}
                      className="flex items-center gap-3 py-3 active:opacity-70 transition-opacity select-none"
                    >
                      <div className="relative flex-shrink-0">
                        {entry.song_album_art
                          ? <img src={entry.song_album_art} alt="" className="w-11 h-11 rounded-xl object-cover" />
                          : <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                              <Music size={16} className="text-muted-foreground" />
                            </div>
                        }
                        {previewing && (
                          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                            <Pause size={14} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${previewing ? 'text-clean' : 'text-foreground'}`}>{entry.song_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.song_artist}</p>
                      </div>
                      <button
                        {...(() => {
                          const h = tapList(`heart-${previewUrl}`, () => { haptic.light(); handleToggleLike(previewUrl, entry.song_name!, entry.song_artist!, entry.song_album_art); });
                          return {
                            onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); h.onPointerDown(e); },
                            onPointerMove: (e: React.PointerEvent) => { e.stopPropagation(); h.onPointerMove(e); },
                            onPointerUp:   (e: React.PointerEvent) => { e.stopPropagation(); h.onPointerUp(e); },
                          };
                        })()}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center active:scale-90 transition-all"
                      >
                        <Heart
                          size={16}
                          className={`transition-colors ${liked ? 'text-red' : 'text-muted-foreground/40'}`}
                          fill={liked ? 'currentColor' : 'none'}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
          {subTab === 'goals' && (() => {
            const activeGoal = goals?.find(g => g.status === 'active') ?? null;
            // Abandoned goals are just the residue of changing your mind, so
            // history shows what was actually finished, plus what's in flight.
            const completed = (goals ?? []).filter(g => g.status === 'completed');
            const { streak } = computeStats(entries);

            if (goals === null) {
              return <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>;
            }
            if (!activeGoal && completed.length === 0) {
              return (
                <div className="text-center py-12">
                  <Target size={28} className="text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-foreground font-semibold text-sm mb-1">No goals yet</p>
                  <p className="text-muted-foreground text-xs">Completed goals show up here.</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {activeGoal && (
                  <div className="bg-card border border-clean/30 rounded-2xl p-4">
                    <div className="flex items-baseline justify-between mb-2.5">
                      <span className="text-sm font-semibold text-foreground">
                        {activeGoal.target_days} day goal
                      </span>
                      <span className="text-xs text-clean font-semibold">In progress</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-clean rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(streak / activeGoal.target_days, 1) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {streak} / {activeGoal.target_days} days
                    </p>
                  </div>
                )}
                {completed.map(g => (
                  <div key={g.id} className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4">
                    <div className="w-9 h-9 rounded-full bg-clean/15 flex items-center justify-center flex-shrink-0">
                      <Target size={16} className="text-clean" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{g.target_days} day goal</p>
                      <p className="text-xs text-muted-foreground">
                        {g.completed_at
                          ? `Completed ${new Date(g.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'Completed'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {entryDetail && (
        <EntryDetailSheet
          dateKey={entryDetail.dateKey}
          entry={entryDetail.entry}
          onClose={() => setEntryDetail(null)}
        />
      )}
    </>
  );
};

export default ProfileTabs;
