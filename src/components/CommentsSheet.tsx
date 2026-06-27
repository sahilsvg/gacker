import React, { useEffect, useState, useRef } from 'react';
import { X, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getComments, postComment, deleteComment, Comment } from '@/lib/social';

interface Props {
  entryId: string;
  onClose: () => void;
}

const Avatar = ({ profile }: { profile: { name: string; avatar_url: string | null } }) => (
  profile.avatar_url
    ? <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
    : <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0">
        <span className="font-wordmark text-sm text-foreground">{profile.name?.[0]?.toUpperCase()}</span>
      </div>
);

const CommentsSheet = ({ entryId, onClose }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const data = await getComments(entryId);
    setComments(data);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  useEffect(() => { load(); }, [entryId]);

  const handlePost = async () => {
    if (!user || !body.trim() || posting) return;
    setPosting(true);
    setError('');
    const err = await postComment(user.id, entryId, body.trim());
    if (err) {
      setError('Failed to post. Try again.');
      setPosting(false);
      return;
    }
    setBody('');
    await load();
    setPosting(false);
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl flex flex-col" style={{ maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Comments</h3>
          <button onClick={onClose} className="text-muted-foreground p-1"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && <p className="text-muted-foreground text-sm text-center py-4">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No comments yet. Be the first.</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <Avatar profile={c.profile} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{c.profile?.name}</span>
                  <span className="text-xs text-muted-foreground">@{c.profile?.handle}</span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{c.body}</p>
              </div>
              {c.user_id === user?.id && (
                <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-red transition-colors flex-shrink-0 p-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-red text-xs text-center pb-1">{error}</p>}

        <div className="px-5 py-3 border-t border-border flex gap-3 items-center">
          <input
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePost(); } }}
            placeholder="Add a comment…"
            maxLength={500}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            onPointerDown={e => { e.preventDefault(); handlePost(); }}
            disabled={!body.trim() || posting}
            className="w-10 h-10 rounded-xl bg-clean flex items-center justify-center disabled:opacity-40 transition-all active:scale-95 flex-shrink-0"
          >
            <Send size={16} className="text-clean-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentsSheet;
