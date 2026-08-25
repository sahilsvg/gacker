import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getFeedItem, FeedItem, TargetKind } from '@/lib/social';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { useTap } from '@/hooks/useTap';
import FeedCard from './FeedCard';

interface Props {
  id: string;
  kind: TargetKind;
  /** Open straight into the comment thread. */
  openComments?: boolean;
  onClose: () => void;
  onProfileTap: (userId: string) => void;
}

/**
 * Shows a single post — entry or goal event — over whatever is underneath.
 * Renders the real FeedCard rather than a second post renderer, so likes,
 * comments, profile taps and double-tap-to-like all behave identically here.
 */
const PostDetailSheet = ({ id, kind, openComments = false, onClose, onProfileTap }: Props) => {
  const { user } = useAuth();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };
  const { onTouchStart, onTouchEnd } = useSwipeToDismiss(handleClose);
  const closeTap = useTap(handleClose);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getFeedItem(id, kind, user.id).then(res => {
      if (cancelled) return;
      setItem(res);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, kind, user?.id]);

  // Local like state so the card stays responsive without a parent feed to own it.
  const handleUpdate = (_id: string, iLiked: boolean, likeCount: number) =>
    setItem(prev => (prev ? { ...prev, iLiked, likeCount } : prev));

  const sheet = (
    <div className="fixed inset-0 z-[320] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onPointerDown={handleClose} />
      <div
        className={`relative w-full max-h-[88%] overflow-y-auto bg-background rounded-t-3xl px-4 pt-4 ${
          isClosing ? 'animate-slide-down' : 'animate-slide-up'
        }`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-1 rounded-full bg-border mx-auto" />
          <button {...closeTap.props} className="absolute right-4 top-3 text-muted-foreground p-2">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <p className="text-muted-foreground text-sm text-center py-12">Loading…</p>
        )}
        {!loading && !item && (
          <p className="text-muted-foreground text-sm text-center py-12">This post is no longer available.</p>
        )}
        {item && (
          <FeedCard
            item={item}
            onProfileTap={onProfileTap}
            onUpdate={handleUpdate}
            isTabActive
            initialShowComments={openComments}
          />
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(sheet, document.body);
};

export default PostDetailSheet;
