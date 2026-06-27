import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getLikes, SearchProfile } from '@/lib/social';

interface Props {
  entryId: string;
  onClose: () => void;
  onProfileTap: (userId: string) => void;
}

const LikesSheet = ({ entryId, onClose, onProfileTap }: Props) => {
  const [likers, setLikers] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLikes(entryId).then(data => { setLikers(data); setLoading(false); });
  }, [entryId]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl flex flex-col" style={{ maxHeight: '70vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Liked by</h3>
          <button onClick={onClose} className="text-muted-foreground p-1"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>}
          {!loading && likers.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No likes yet.</p>
          )}
          {likers.map(profile => (
            <button
              key={profile.id}
              onClick={() => { onProfileTap(profile.id); onClose(); }}
              className="flex items-center gap-3 w-full text-left active:opacity-70 transition-opacity"
            >
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                : <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                    <span className="font-wordmark text-lg text-foreground">{profile.name?.[0]?.toUpperCase()}</span>
                  </div>
              }
              <div>
                <p className="font-semibold text-foreground text-sm">{profile.name}</p>
                <p className="text-xs text-muted-foreground">@{profile.handle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LikesSheet;
