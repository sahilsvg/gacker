import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Loader2, UserMinus, UserPlus, UserCheck, Clock } from 'lucide-react';
import {
  getFollowerList, getFollowingList, unfollowUser, removeFollower,
  followUser, getFollowing, getPendingOutgoing,
  SearchProfile, FollowStatus,
} from '@/lib/social';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { haptic } from '@/lib/haptics';

interface Props {
  userId: string;           // whose list we're viewing
  type: 'followers' | 'following';
  onClose: () => void;
  onProfileTap: (userId: string) => void;
  currentUserId: string;   // logged-in user
}

const FollowListSheet = ({ userId, type, onClose, onProfileTap, currentUserId }: Props) => {
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [followStatuses, setFollowStatuses] = useState<Map<string, FollowStatus>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOwnList = currentUserId === userId;

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };
  const { onTouchStart, onTouchEnd } = useSwipeToDismiss(handleClose, scrollRef);

  useEffect(() => {
    const fn = type === 'followers' ? getFollowerList : getFollowingList;
    fn(userId).then(data => { setProfiles(data); setLoading(false); });
  }, [userId, type]);

  // Load current user's follow status toward everyone in the list (for non-own lists)
  useEffect(() => {
    if (isOwnList || profiles.length === 0) return;
    Promise.all([
      getFollowing(currentUserId),
      getPendingOutgoing(currentUserId),
    ]).then(([following, pending]) => {
      const map = new Map<string, FollowStatus>();
      profiles.forEach(p => {
        if (p.id === currentUserId) return;
        if (following.has(p.id)) map.set(p.id, 'accepted');
        else if (pending.has(p.id)) map.set(p.id, 'pending');
        else map.set(p.id, 'none');
      });
      setFollowStatuses(map);
    });
  }, [profiles, isOwnList, currentUserId]);

  const handleRemove = async (targetId: string) => {
    setRemoving(targetId);
    if (type === 'following') await unfollowUser(currentUserId, targetId);
    else await removeFollower(targetId, currentUserId);
    setProfiles(prev => prev.filter(p => p.id !== targetId));
    setRemoving(null);
  };

  const handleFollowToggle = async (targetId: string) => {
    const status = followStatuses.get(targetId) ?? 'none';
    haptic.light();
    if (status === 'none') {
      setFollowStatuses(prev => new Map(prev).set(targetId, 'pending'));
      await followUser(currentUserId, targetId);
    } else {
      setFollowStatuses(prev => new Map(prev).set(targetId, 'none'));
      await unfollowUser(currentUserId, targetId);
    }
  };

  const title = type === 'followers' ? 'Followers' : 'Following';

  const sheet = (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onPointerDown={handleClose} />
      <div
        className={`relative bg-card rounded-t-3xl flex flex-col ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ maxHeight: '85vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onPointerDown={e => { e.preventDefault(); handleClose(); }} className="text-muted-foreground active:opacity-60 p-3 -mr-3">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 px-5 py-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-12">
              {type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            profiles.map(p => {
              const status = followStatuses.get(p.id);
              const isSelf = p.id === currentUserId;
              return (
                <div key={p.id} className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
                  <button
                    onPointerDown={e => { e.preventDefault(); onProfileTap(p.id); handleClose(); }}
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

                  {/* Own list: remove/unfollow */}
                  {isOwnList && (
                    <button
                      onPointerDown={e => { e.preventDefault(); handleRemove(p.id); }}
                      disabled={removing === p.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium active:scale-95 transition-all disabled:opacity-40 flex-shrink-0"
                    >
                      {removing === p.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <UserMinus size={12} />
                      }
                      {type === 'following' ? 'Unfollow' : 'Remove'}
                    </button>
                  )}

                  {/* Others' list: follow / requested / following */}
                  {!isOwnList && !isSelf && status !== undefined && (
                    <button
                      onPointerDown={e => { e.preventDefault(); handleFollowToggle(p.id); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all flex-shrink-0 ${
                        status === 'accepted'
                          ? 'bg-muted text-muted-foreground'
                          : status === 'pending'
                          ? 'bg-muted/60 text-muted-foreground border border-border'
                          : 'bg-clean text-clean-foreground'
                      }`}
                    >
                      {status === 'accepted' && <><UserCheck size={12} /> Following</>}
                      {status === 'pending' && <><Clock size={12} /> Requested</>}
                      {status === 'none' && <><UserPlus size={12} /> Follow</>}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(sheet, document.body);
};

export default FollowListSheet;
