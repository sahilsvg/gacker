import React, { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toggleLike, FeedItem } from '@/lib/social';
import CommentsSheet from './CommentsSheet';
import LikesSheet from './LikesSheet';

interface Props {
  item: FeedItem;
  onProfileTap: (userId: string) => void;
  onUpdate: (id: string, iLiked: boolean, likeCount: number) => void;
}

const Avatar = ({ profile }: { profile: FeedItem['profile'] }) => (
  profile?.avatar_url
    ? <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
    : <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
        <span className="font-wordmark text-lg text-foreground">{profile?.name?.[0]?.toUpperCase()}</span>
      </div>
);

const FeedCard = ({ item, onProfileTap, onUpdate }: Props) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [showLikes, setShowLikes] = useState(false);

  const [y, m, d] = item.date.split('-').map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const handleLike = async () => {
    if (!user) return;
    const newLiked = !item.iLiked;
    onUpdate(item.id, newLiked, item.likeCount + (newLiked ? 1 : -1));
    await toggleLike(user.id, item.id, item.iLiked);
  };

  return (
    <>
      <div className="bg-card border border-border rounded-2xl p-4">
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
          <span className="text-xs text-muted-foreground flex-shrink-0">{dateLabel}</span>
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

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t border-border/50 mt-1">
          <button
            onPointerDown={e => { e.preventDefault(); handleLike(); }}
            className={`flex items-center gap-1.5 text-sm transition-all active:scale-95 ${
              item.iLiked ? 'text-red' : 'text-muted-foreground'
            }`}
          >
            <Heart size={16} fill={item.iLiked ? 'currentColor' : 'none'} />
          </button>
          {item.likeCount > 0 && (
            <button
              onPointerDown={e => { e.preventDefault(); setShowLikes(true); }}
              className="text-sm text-muted-foreground font-medium -ml-3 active:opacity-60"
            >
              {item.likeCount}
            </button>
          )}
          <button
            onPointerDown={e => { e.preventDefault(); setShowComments(true); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-all active:scale-95"
          >
            <MessageCircle size={16} />
            {item.commentCount > 0 && <span className="font-medium">{item.commentCount}</span>}
          </button>
        </div>
      </div>

      {showComments && (
        <CommentsSheet entryId={item.id} onClose={() => setShowComments(false)} />
      )}
      {showLikes && (
        <LikesSheet entryId={item.id} onClose={() => setShowLikes(false)} onProfileTap={onProfileTap} />
      )}
    </>
  );
};

export default FeedCard;
