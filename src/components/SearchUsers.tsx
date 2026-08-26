import { dismissOnEnter } from '@/hooks/useKeyboardDismiss';
import React, { useState, useEffect } from 'react';
import { Search, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { searchUsers, getFollowing, getPendingOutgoing, followUser, unfollowUser, SearchProfile } from '@/lib/social';
import { useTapList, stopParentTap } from '@/hooks/useTap';

interface Props {
  onClose: () => void;
  onProfileTap: (userId: string) => void;
}

const Avatar = ({ profile }: { profile: SearchProfile }) => (
  profile.avatar_url
    ? <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
    : <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
        <span className="font-wordmark text-lg text-foreground">{profile.name?.[0]?.toUpperCase()}</span>
      </div>
);

const SearchUsers = ({ onClose, onProfileTap }: Props) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const tapList = useTapList();

  useEffect(() => {
    if (!user) return;
    Promise.all([getFollowing(user.id), getPendingOutgoing(user.id)]).then(([f, p]) => {
      setFollowing(f);
      setPending(p);
    });
  }, [user]);

  useEffect(() => {
    if (!query.trim() || !user) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const data = await searchUsers(query, user.id);
      setResults(data);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, user]);

  const handleFollow = async (targetId: string) => {
    if (!user) return;
    if (following.has(targetId)) {
      const next = new Set(following);
      next.delete(targetId);
      setFollowing(next);
      await unfollowUser(user.id, targetId);
    } else if (pending.has(targetId)) {
      // Cancel pending request
      const next = new Set(pending);
      next.delete(targetId);
      setPending(next);
      await unfollowUser(user.id, targetId);
    } else {
      const next = new Set(pending);
      next.add(targetId);
      setPending(next);
      await followUser(user.id, targetId);
    }
  };

  const getButtonState = (id: string) => {
    if (following.has(id)) return 'following';
    if (pending.has(id)) return 'pending';
    return 'none';
  };

  return (
    <div className="flex flex-col h-full tab-bar-padding">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 border-b border-border">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            enterKeyHint="search"
            onKeyDown={dismissOnEnter()}
            placeholder="Search by handle…"
            className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button onClick={onClose} className="text-muted-foreground font-medium text-sm">Cancel</button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading && <p className="text-muted-foreground text-sm text-center py-8">Searching…</p>}
        {!loading && query && results.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">No users found for "@{query}"</p>
        )}
        {!query && (
          <p className="text-muted-foreground text-sm text-center py-8">Type a handle to find your friends.</p>
        )}
        {results.map(profile => {
          const state = getButtonState(profile.id);
          return (
            // The whole row opens the profile — avatar, name, and the padding
            // between them. Follow stops propagation so it wins over the row.
            <div
              key={profile.id}
              // No onClose here: the parent's onProfileTap already leaves the
              // search view, and closing on top of it would land back on the feed.
              {...tapList(profile.id, () => onProfileTap(profile.id))}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3 select-none cursor-pointer active:bg-muted/30 transition-colors"
            >
              <Avatar profile={profile} />
              <div className="flex-1 min-w-0 text-left">
                <p className="font-semibold text-foreground text-sm truncate">{profile.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{profile.handle}</p>
              </div>
              <button
                {...stopParentTap(tapList(`follow-${profile.id}`, () => handleFollow(profile.id)))}
                className={`flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold flex-shrink-0 transition-all active:scale-95 ${
                  state === 'following'
                    ? 'bg-muted text-muted-foreground'
                    : state === 'pending'
                    ? 'bg-muted/60 text-muted-foreground border border-border'
                    : 'bg-clean text-clean-foreground'
                }`}
              >
                {state === 'following' && <><UserCheck size={13} /> Following</>}
                {state === 'pending' && <><Clock size={13} /> Requested</>}
                {state === 'none' && <><UserPlus size={13} /> Follow</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SearchUsers;
