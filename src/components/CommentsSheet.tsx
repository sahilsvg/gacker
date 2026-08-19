import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Send, Trash2, Heart, CornerDownRight } from 'lucide-react';
import { Keyboard } from '@capacitor/keyboard';
import { useAuth } from '@/contexts/AuthContext';
import {
  getComments, postComment, deleteComment, toggleCommentLike,
  searchFollowedByHandle, resolveHandles, Comment, SearchProfile, TargetKind,
} from '@/lib/social';
import { timeAgo } from '@/lib/timeAgo';
import { haptic } from '@/lib/haptics';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

interface Props {
  entryId: string;
  kind?: TargetKind;
  entryOwnerId?: string;
  onClose: () => void;
  onProfileTap: (userId: string) => void;
}

const Avatar = ({ profile, size = 8 }: { profile: { name: string; avatar_url: string | null }; size?: number }) => (
  profile.avatar_url
    ? <img src={profile.avatar_url} alt="" className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0`}>
        <span className="font-wordmark text-sm text-foreground">{profile.name?.[0]?.toUpperCase()}</span>
      </div>
);

// Extract @handles from text
const extractHandles = (text: string): string[] => {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map(m => m.slice(1).toLowerCase());
};

interface ReplyingTo {
  commentId: string;
  commentOwnerId: string;
  handle: string;
}

const CommentsSheet = ({ entryId, kind = 'entry', entryOwnerId, onClose, onProfileTap }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<SearchProfile[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };
  const { onTouchStart, onTouchEnd } = useSwipeToDismiss(handleClose, scrollRef);

  useEffect(() => {
    let showL: any, hideL: any;
    Keyboard.addListener('keyboardWillShow', info => setKbHeight(info.keyboardHeight)).then(l => { showL = l; });
    Keyboard.addListener('keyboardWillHide', () => setKbHeight(0)).then(l => { hideL = l; });
    return () => { showL?.remove(); hideL?.remove(); };
  }, []);

  const load = useCallback(async () => {
    const data = await getComments(entryId, user?.id, kind);
    setComments(data);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [entryId, kind, user?.id]);

  useEffect(() => { load(); }, [load]);

  // @mention autocomplete
  useEffect(() => {
    if (!user || mentionQuery === null) { setMentionSuggestions([]); return; }
    if (mentionQuery === '') { setMentionSuggestions([]); return; }
    searchFollowedByHandle(user.id, mentionQuery).then(setMentionSuggestions);
  }, [mentionQuery, user]);

  const handleBodyChange = (val: string) => {
    setBody(val);
    // Detect active @mention at cursor end
    const atMatch = val.match(/@([a-zA-Z0-9_]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (profile: SearchProfile) => {
    const replaced = body.replace(/@([a-zA-Z0-9_]*)$/, `@${profile.handle} `);
    setBody(replaced);
    setMentionQuery(null);
    setMentionSuggestions([]);
    inputRef.current?.focus();
  };

  const handleReply = (comment: Comment) => {
    haptic.light();
    setReplyingTo({ commentId: comment.id, commentOwnerId: comment.user_id, handle: comment.profile?.handle });
    setBody(`@${comment.profile?.handle} `);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setBody('');
    setMentionQuery(null);
  };

  const handlePost = async () => {
    if (!user || !body.trim() || posting) return;
    haptic.light();
    setPosting(true);
    const text = body.trim();
    const handles = extractHandles(text);
    const handleMap = await resolveHandles(handles);
    const mentionedIds = Object.values(handleMap);

    await postComment(user.id, entryId, text, {
      kind,
      entryOwnerId,
      parentCommentId: replyingTo?.commentId ?? null,
      parentCommentOwnerId: replyingTo?.commentOwnerId ?? null,
      mentionedUserIds: mentionedIds,
    });

    setBody('');
    setReplyingTo(null);
    setMentionQuery(null);
    await load();
    setPosting(false);
  };

  const handleToggleLike = async (comment: Comment) => {
    if (!user) return;
    haptic.light();
    // Optimistic update
    const toggle = (list: Comment[]): Comment[] => list.map(c => {
      if (c.id === comment.id) return { ...c, i_liked: !c.i_liked, like_count: c.like_count + (c.i_liked ? -1 : 1) };
      if (c.replies.length > 0) return { ...c, replies: toggle(c.replies) };
      return c;
    });
    setComments(prev => toggle(prev));
    await toggleCommentLike(user.id, comment.id, comment.user_id, comment.i_liked);
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    const remove = (list: Comment[]): Comment[] =>
      list.filter(c => c.id !== commentId).map(c => ({ ...c, replies: remove(c.replies) }));
    setComments(prev => remove(prev));
  };

  const renderComment = (c: Comment, isReply = false) => {
    const canDelete = c.user_id === user?.id;
    return (
      <div key={c.id} className={isReply ? 'ml-10 mt-2' : ''}>
        <div className="flex gap-3">
          <button
            onPointerDown={e => { e.preventDefault(); onProfileTap(c.user_id); handleClose(); }}
            className="flex-shrink-0 mt-0.5"
          >
            <Avatar profile={c.profile} size={isReply ? 7 : 8} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{c.profile?.name}</span>
              <span className="text-xs text-muted-foreground">@{c.profile?.handle}</span>
              <span className="text-[10px] text-muted-foreground/50">· {timeAgo(c.created_at)}</span>
            </div>

            {/* Body with highlighted @mentions */}
            <p className="text-sm text-foreground/90 leading-relaxed">
              {c.body.split(/(@[a-zA-Z0-9_]+)/g).map((part, i) =>
                part.startsWith('@')
                  ? <span key={i} className="text-clean font-medium">{part}</span>
                  : part
              )}
            </p>

            {/* Actions row */}
            <div className="flex items-center gap-4 mt-1.5">
              {!isReply && (
                <button
                  onPointerDown={e => { e.preventDefault(); handleReply(c); }}
                  className="flex items-center gap-1 text-muted-foreground/60 active:opacity-60"
                >
                  <CornerDownRight size={11} />
                  <span className="text-[11px]">Reply</span>
                </button>
              )}
              <button
                onPointerDown={e => { e.preventDefault(); handleToggleLike(c); }}
                className={`flex items-center gap-1 transition-colors active:scale-95 ${c.i_liked ? 'text-red' : 'text-muted-foreground/60'}`}
              >
                <Heart size={11} fill={c.i_liked ? 'currentColor' : 'none'} />
                {c.like_count > 0 && <span className="text-[11px]">{c.like_count}</span>}
              </button>
              {canDelete && (
                <button
                  onPointerDown={e => { e.preventDefault(); handleDelete(c.id); }}
                  className="text-muted-foreground/40 active:text-red transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Replies (one level) */}
        {c.replies.length > 0 && (
          <div className="mt-2 space-y-3">
            {c.replies.map(r => renderComment(r, true))}
          </div>
        )}
      </div>
    );
  };

  const sheetMaxHeight = kbHeight > 0 ? `calc(100dvh - ${kbHeight}px - 40px)` : '75vh';
  const sheetPadding = kbHeight > 0 ? '8px' : 'env(safe-area-inset-bottom)';

  const sheet = (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/60" onPointerDown={handleClose} />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl flex flex-col ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ maxHeight: sheetMaxHeight, paddingBottom: sheetPadding, transition: 'max-height 0.25s ease, padding-bottom 0.25s ease' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-foreground">Comments</h3>
          <button onPointerDown={e => { e.preventDefault(); handleClose(); }} className="text-muted-foreground p-3 -mr-3">
            <X size={20} />
          </button>
        </div>

        {/* Comment list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-3 pb-2 space-y-4">
          {loading && <p className="text-muted-foreground text-sm text-center py-4">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No comments yet. Be the first.</p>
          )}
          {comments.map(c => renderComment(c))}
          <div ref={bottomRef} />
        </div>

        {/* @mention autocomplete */}
        {mentionSuggestions.length > 0 && (
          <div className="mx-5 mb-1 bg-background border border-border rounded-xl overflow-hidden flex-shrink-0">
            {mentionSuggestions.map(p => (
              <button
                key={p.id}
                onPointerDown={e => { e.preventDefault(); insertMention(p); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 active:bg-muted transition-colors border-b border-border/30 last:border-0"
              >
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="font-wordmark text-xs text-foreground">{p.name?.[0]?.toUpperCase()}</span>
                    </div>
                }
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">@{p.handle}</span>
              </button>
            ))}
          </div>
        )}

        {/* Replying-to chip */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-5 py-1.5 flex-shrink-0">
            <CornerDownRight size={12} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1">Replying to <span className="text-foreground font-medium">@{replyingTo.handle}</span></span>
            <button onPointerDown={e => { e.preventDefault(); cancelReply(); }} className="text-muted-foreground active:opacity-60 p-1">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-3 border-t border-border flex gap-3 items-center flex-shrink-0">
          <input
            ref={inputRef}
            value={body}
            onChange={e => handleBodyChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePost(); } }}
            placeholder={replyingTo ? `Reply to @${replyingTo.handle}…` : 'Add a comment…'}
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

  return ReactDOM.createPortal(sheet, document.body);
};

export default CommentsSheet;
