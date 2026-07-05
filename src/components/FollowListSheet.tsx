import React, { useEffect, useState } from 'react';
import { X, Loader2, UserMinus } from 'lucide-react';
import { getFollowerList, getFollowingList, unfollowUser, removeFollower, SearchProfile } from '@/lib/social';

interface Props {
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
  onProfileTap: (userId: string) => void;
  currentUserId?: string; // if provided, show unfollow/remove actions
}

const FollowListSheet = ({ userId, type, onClose, onProfileTap, currentUserId }: Props) => {
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };

  const isOwnList = currentUserId === userId;

  useEffect(() => {
    const fn = type === 'followers' ? getFollowerList : getFollowingList;
    fn(userId).then(data => { setProfiles(data); setLoading(false); });
  }, [userId, type]);

  const handleAction = async (targetId: string) => {
    setRemoving(targetId);
    if (type === 'following') {
      // Unfollow: I am currentUserId, target is who I'm following
      await unfollowUser(currentUserId!, targetId);
    } else {
      // Remove follower: target is following me
      await removeFollower(targetId, currentUserId!);
    }
    setProfiles(prev => prev.filter(p => p.id !== targetId));
    setRemoving(null);
  };

  const title = type === 'followers' ? 'Followers' : 'Following';

  return (
    <div className="fixed inset-0 z-[200] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onPointerDown={handleClose} />

      {/* Sheet */}
      <div className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl flex flex-col ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} style={{ minHeight: '40vh', maxHeight: '75vh' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onPointerDown={e => { e.preventDefault(); handleClose(); }} className="text-muted-foreground active:opacity-60">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">
              {type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            <div className="space-y-1">
              {profiles.map(p => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <button
                    onPointerDown={e => { e.preventDefault(); onProfileTap(p.id); onClose(); }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-60 transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden flex-shrink-0">
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <span className="font-wordmark text-lg text-foreground">{p.name?.[0]?.toUpperCase()}</span>
                          </div>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{p.handle}</p>
                    </div>
                  </button>

                  {isOwnList && (
                    <button
                      onPointerDown={e => { e.preventDefault(); handleAction(p.id); }}
                      disabled={removing === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium active:scale-95 transition-all disabled:opacity-40"
                    >
                      {removing === p.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <UserMinus size={12} />
                      }
                      {type === 'following' ? 'Unfollow' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowListSheet;
