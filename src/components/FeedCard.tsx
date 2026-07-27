import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, MapPin, Music, Play, Pause } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { toggleLike, FeedItem } from '@/lib/social';
import { timeAgo } from '@/lib/timeAgo';
import { haptic } from '@/lib/haptics';
import CommentsSheet from './CommentsSheet';
import LikesSheet from './LikesSheet';

interface Props {
  item: FeedItem;
  onProfileTap: (userId: string) => void;
  onUpdate: (id: string, iLiked: boolean, likeCount: number) => void;
  isTabActive?: boolean;
}

const Avatar = ({ profile }: { profile: FeedItem['profile'] }) => (
  profile?.avatar_url
    ? <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
    : <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
        <span className="font-wordmark text-lg text-foreground">{profile?.name?.[0]?.toUpperCase()}</span>
      </div>
);

const FeedCard = ({ item, onProfileTap, onUpdate, isTabActive }: Props) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [showLikes, setShowLikes] = useState(false);

  useEffect(() => {
    if (!isTabActive) { setShowComments(false); setShowLikes(false); }
  }, [isTabActive]);
  const { play, currentSong, isPlaying } = usePlayer();
  const songPlaying = currentSong?.url === item.song_preview_url && isPlaying;

  // Double-tap to like
  const lastTapRef = useRef<number>(0);

  // Long-press on like button to open likes sheet
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const toggleSong = () => {
    if (!item.song_preview_url) return;
    play({ url: item.song_preview_url, name: item.song_name ?? '', artist: item.song_artist ?? '', albumArt: item.song_album_art ?? null });
  };

  const [y, m, d] = item.date.split('-').map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const handleLike = async () => {
    if (!user) return;
    haptic.light();
    const newLiked = !item.iLiked;
    onUpdate(item.id, newLiked, item.likeCount + (newLiked ? 1 : -1));
    await toggleLike(user.id, item.id, item.iLiked, item.user_id);
  };

  const handleCardTap = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!item.iLiked) {
        haptic.medium();
        handleLike();
      }
    }
    lastTapRef.current = now;
  };

  const handleLikePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      haptic.medium();
      setShowLikes(true);
    }, 500);
  };

  const handleLikePointerUp = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    if (!isLongPressRef.current) handleLike();
  };

  const handleLikePointerLeave = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-2xl p-4" onPointerDown={handleCardTap}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => onProfileTap(item.user_id)} className="flex-shrink-0">
            <Avatar profile={item.profile} />
          </button>
          <div className="flex-1 min-w-0">
            <button onClick={() => onProfileTap(item.user_id)} className="text-left">
              <p className="font-semibold text-foreground text-sm leading-tight">{item.profile?.name}</p>
              <p className="text-xs text-muted-foreground">@{item.profile?.handle}</p>
            </button>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-xs text-muted-foreground">{dateLabel}</span>
            {item.created_at && <span className="text-[10px] text-muted-foreground/60">{timeAgo(item.created_at)}</span>}
          </div>
        </div>

        {/* Status */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
          item.clean ? 'bg-clean/15 text-clean' : 'bg-red/15 text-red'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.clean ? 'bg-clean' : 'bg-red'}`} />
          {item.clean ? 'Clean Day' : 'Red Day'}
        </div>

        {/* Notes */}
        {item.notes && (
          <p className="text-sm text-foreground/80 leading-relaxed mb-3">{item.notes}</p>
        )}

        {/* Photo */}
        {item.image_url && (
          <div className="rounded-xl overflow-hidden mb-3">
            <img
              src={item.image_url}
              alt=""
              className="w-full object-cover"
              style={{ maxHeight: 240 }}
            />
          </div>
        )}

        {/* Song */}
        {item.song_name && (
          <div className="flex items-center gap-3 bg-background border border-border/50 rounded-xl px-3 py-2.5 mb-3">
            {item.song_album_art
              ? <img src={item.song_album_art} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              : <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Music size={13} className="text-muted-foreground" /></div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.song_name}</p>
              <p className="text-xs text-muted-foreground truncate">{item.song_artist}</p>
            </div>
            {item.song_preview_url && (
              <button
                onPointerDown={e => { e.preventDefault(); toggleSong(); }}
                className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
              >
                {songPlaying ? <Pause size={14} className="text-foreground" /> : <Play size={14} className="text-foreground ml-0.5" />}
              </button>
            )}
          </div>
        )}

        {/* Location */}
        {item.location_name && (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={11} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{item.location_name}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-border/50 mt-1">
          <button
            onPointerDown={handleLikePointerDown}
            onPointerUp={handleLikePointerUp}
            onPointerLeave={handleLikePointerLeave}
            onPointerCancel={handleLikePointerLeave}
            className={`flex items-center gap-1.5 text-sm transition-all active:scale-95 py-3 px-2 ${
              item.iLiked ? 'text-red' : 'text-muted-foreground'
            }`}
          >
            <Heart size={18} fill={item.iLiked ? 'currentColor' : 'none'} />
            {item.likeCount > 0 && <span className="font-medium">{item.likeCount}</span>}
          </button>
          <button
            onPointerDown={e => { e.preventDefault(); haptic.light(); setShowComments(true); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-all active:scale-95 py-3 px-2"
          >
            <MessageCircle size={18} />
            {item.commentCount > 0 && <span className="font-medium">{item.commentCount}</span>}
          </button>
        </div>
      </div>

      {showComments && (
        <CommentsSheet entryId={item.id} entryOwnerId={item.user_id} onClose={() => setShowComments(false)} onProfileTap={onProfileTap} />
      )}
      {showLikes && (
        <LikesSheet entryId={item.id} onClose={() => setShowLikes(false)} onProfileTap={onProfileTap} />
      )}
    </>
  );
};

export default FeedCard;
