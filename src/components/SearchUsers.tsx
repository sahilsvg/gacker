import React, { useState, useEffect } from 'react';
import { Search, UserPlus, UserCheck, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { searchUsers, getFollowing, followUser, unfollowUser, SearchProfile } from '@/lib/social';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) getFollowing(user.id).then(setFollowing);
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
    const isFollowing = following.has(targetId);
    const next = new Set(following);
    if (isFollowing) {
      next.delete(targetId);
      await unfollowUser(user.id, targetId);
    } else {
      next.add(targetId);
      await followUser(user.id, targetId);
    }
    setFollowing(next);
  };

  return (
    <div className="flex flex-col h-full" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4 border-b border-border">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
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
        {results.map(profile => (
          <div key={profile.id} className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3">
            <button onClick={() => { onProfileTap(profile.id); onClose(); }}>
              <Avatar profile={profile} />
            </button>
            <button onClick={() => { onProfileTap(profile.id); onClose(); }} className="flex-1 min-w-0 text-left">
              <p className="font-semibold text-foreground text-sm">{profile.name}</p>
              <p className="text-xs text-muted-foreground">@{profile.handle}</p>
            </button>
            <button
              onClick={() => handleFollow(profile.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                following.has(profile.id)
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-clean text-clean-foreground'
              }`}
            >
              {following.has(profile.id)
                ? <><UserCheck size={13} /> Following</>
                : <><UserPlus size={13} /> Follow</>
              }
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchUsers;
