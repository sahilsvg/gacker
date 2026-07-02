import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingRequests, approveRequest, denyRequest, FollowRequest } from '@/lib/social';
import { createNotification } from '@/lib/notifications';

interface Props {
  onClose: () => void;
}

const FollowRequestsPage = ({ onClose }: Props) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getPendingRequests(user.id).then(data => { setRequests(data); setLoading(false); });
  }, [user]);

  const handleApprove = async (followerId: string) => {
    if (!user) return;
    setRequests(prev => prev.filter(r => r.follower_id !== followerId));
    await approveRequest(followerId, user.id);
    createNotification(followerId, 'follow_accepted', user.id);
  };

  const handleDeny = async (followerId: string) => {
    if (!user) return;
    setRequests(prev => prev.filter(r => r.follower_id !== followerId));
    await denyRequest(followerId, user.id);
  };

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col z-[300] animate-slide-up"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center px-5 py-4 border-b border-border">
        <button
          onPointerDown={e => { e.preventDefault(); onClose(); }}
          className="flex items-center gap-1.5 text-muted-foreground text-sm active:opacity-60 transition-opacity mr-4"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="font-semibold text-foreground text-base">Follow Requests</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <p className="text-muted-foreground text-sm text-center py-12">Loading…</p>
        )}
        {!loading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-foreground font-semibold text-sm">No pending requests</p>
            <p className="text-muted-foreground text-xs text-center">When someone requests to follow you, they'll appear here.</p>
          </div>
        )}
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.follower_id} className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3">
              {req.profile.avatar_url
                ? <img src={req.profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                : <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                    <span className="font-wordmark text-lg text-foreground">{req.profile.name?.[0]?.toUpperCase()}</span>
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{req.profile.name}</p>
                <p className="text-xs text-muted-foreground">@{req.profile.handle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onPointerDown={e => { e.preventDefault(); handleDeny(req.follower_id); }}
                  className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-all"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
                <button
                  onPointerDown={e => { e.preventDefault(); handleApprove(req.follower_id); }}
                  className="w-9 h-9 rounded-xl bg-clean flex items-center justify-center active:scale-95 transition-all"
                >
                  <Check size={16} className="text-clean-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FollowRequestsPage;
