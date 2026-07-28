import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Heart, Music } from 'lucide-react';
import { Entry } from '@/lib/entries';
import { usePlayer } from '@/contexts/PlayerContext';
import { getLikedSongs, toggleLikedSong, onLikeChange } from '@/lib/likedSongs';
import { haptic } from '@/lib/haptics';
import CalendarView from './CalendarView';
import EntryDetailSheet from './EntryDetailSheet';

type SubTab = 'history' | 'images' | 'music';

interface Props {
  entries: Record<string, Entry>;
  currentUserId: string;       // logged-in user (for like buttons)
  canSeeContent: boolean;      // own profile or accepted follower
  lockedMessage?: string;      // shown when !canSeeContent
}

const ProfileTabs = ({ entries, currentUserId, canSeeContent, lockedMessage }: Props) => {
  const [subTab, setSubTab] = useState<SubTab>('history');
  const [entryDetail, setEntryDetail] = useState<{ dateKey: string; entry: Entry } | null>(null);
  const [likedUrls, setLikedUrls] = useState<Set<string>>(new Set());
  const { play, stop, currentSong, isPlaying } = usePlayer();

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

  const TABS: { id: SubTab; label: string }[] = [
    { id: 'history', label: 'History' },
    { id: 'images', label: 'Images' },
    { id: 'music', label: 'Music' },
  ];

  return (
    <>
      {/* Tab slider */}
      <div className="flex bg-card border border-border rounded-2xl p-1 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onPointerDown={e => { e.preventDefault(); setSubTab(t.id); }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              subTab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
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
                  <button
                    key={dateKey}
                    onPointerDown={e => { e.preventDefault(); setEntryDetail({ dateKey, entry }); }}
                    className="aspect-square overflow-hidden active:opacity-80 transition-opacity"
                  >
                    <img
                      src={entry.image_url!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
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

                  const handleRowTap = (e: React.PointerEvent) => {
                    e.preventDefault();
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
                  };

                  return (
                    <div
                      key={dateKey}
                      onPointerDown={handleRowTap}
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
                        onPointerDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          haptic.light();
                          handleToggleLike(previewUrl, entry.song_name!, entry.song_artist!, entry.song_album_art);
                        }}
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
