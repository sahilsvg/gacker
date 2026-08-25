import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { getLikes, SearchProfile, TargetKind } from '@/lib/social';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

interface Props {
  entryId: string;
  kind?: TargetKind;
  onClose: () => void;
  onProfileTap: (userId: string) => void;
}

const LikesSheet = ({ entryId, kind = 'entry', onClose, onProfileTap }: Props) => {
  const [likers, setLikers] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };
  const { onTouchStart, onTouchEnd } = useSwipeToDismiss(handleClose, scrollRef);

  useEffect(() => {
    getLikes(entryId, kind).then(data => { setLikers(data); setLoading(false); });
  }, [entryId, kind]);

  const sheet = (
    <div className="fixed inset-0 z-[400] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div
        className={`relative bg-card rounded-t-3xl flex flex-col ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ maxHeight: '70vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-foreground">Liked by</h3>
          <button onClick={handleClose} className="text-muted-foreground p-3 -mr-3"><X size={20} /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-2 pb-3 space-y-1">
          {loading && <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>}
          {!loading && likers.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No likes yet.</p>
          )}
          {likers.map(profile => (
            <button
              key={profile.id}
              onClick={() => { onProfileTap(profile.id); handleClose(); }}
              className="flex items-center gap-3 w-full text-left py-2.5 active:opacity-70 transition-opacity"
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

  return ReactDOM.createPortal(sheet, document.body);
};

export default LikesSheet;
