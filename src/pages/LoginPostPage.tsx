import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Send, Shield, Loader2, ThumbsUp, MessageCircle, Check, CornerDownRight } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchPostById, fetchThoughts, addThought,
  toggleThoughtPraise,
  type LivePost, type LiveThought,
} from "../services/feedService";

/* ══════════════════════════════════════════════════════════════
   LoginPostPage — full post + thoughts view for logged-in users
   Route: /thoughts/:id

   Features:
   • Full PostCard at top (with isOwn detection)
   • Thoughts listed below with nested replies
   • Each thought: Praise + Reply buttons
   • Profile picture + name clickable → /user/:id
   • Reply opens inline input under that thought
   • Sticky compose bar at bottom
   • Dark mode throughout
══════════════════════════════════════════════════════════════ */

/* ── Avatar ── */
function Avatar({ src, name, size = 36, onClick }: {
  src?: string | null; name: string; size?: number; onClick?: () => void;
}) {
  const [err, setErr] = useState(false);
  const initials = (name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="shrink-0 rounded-full overflow-hidden"
      style={{ width: size, height: size }}>
      {src && !err ? (
        <img src={src} alt={name} className="w-full h-full object-cover"
          onError={() => setErr(true)} />
      ) : (
        <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold"
          style={{ fontSize: size * 0.36 }}>{initials}</div>
      )}
    </Tag>
  );
}

/* ── Single thought item ── */
function ThoughtItem({
  thought, userId, depth = 0, onReply, onPraiseToggle,
}: {
  thought:        LiveThought;
  userId?:        string;
  depth?:         number;
  onReply:        (id: string, username: string) => void;
  onPraiseToggle: (id: string, current: boolean) => void;
}) {
  const navigate    = useNavigate();
  const [liked,     setLiked]     = useState(thought.isLiked || false);
  const [likeCount, setLikeCount] = useState(thought.likes   || 0);

  const handlePraise = async () => {
    if (!userId) { navigate("/login"); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : Math.max(0, c - 1));
    await toggleThoughtPraise(thought.id, userId, liked);
    onPraiseToggle(thought.id, liked);
  };

  const goProfile = () => {
    if (!thought.is_anon && thought.user?.id) navigate(`/user/${thought.user.id}`);
  };

  const displayName   = thought.is_anon ? "Anonymous" : thought.user?.name || "User";
  const displayAvatar = thought.is_anon ? null : thought.user?.avatar;

  return (
    <div className={`${depth > 0 ? "ml-10 border-l-2 border-gray-100 dark:border-gray-800 pl-3" : ""}`}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        {thought.is_anon ? (
          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
            <Shield size={15} className="text-gray-400" />
          </div>
        ) : (
          <Avatar src={displayAvatar} name={displayName} size={36} onClick={goProfile} />
        )}

        <div className="flex-1 min-w-0">
          {/* Name + timestamp */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <button onClick={goProfile} className="flex items-center gap-1 hover:underline">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {displayName}
              </span>
              {thought.user?.isVerified && !thought.is_anon && (
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-blue-500 rounded-full">
                  <Check size={8} className="text-white" strokeWidth={3} />
                </span>
              )}
            </button>
            {!thought.is_anon && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {thought.user?.username}
              </span>
            )}
            <span className="text-gray-300 dark:text-gray-700 text-xs">·</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{thought.timestamp}</span>
          </div>

          {/* Content */}
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed break-words">
            {thought.content}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-4 mt-2">
            {/* Praise */}
            <button
              onClick={handlePraise}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                liked ? "text-orange-500" : "text-gray-400 dark:text-gray-500 hover:text-orange-500"
              }`}
            >
              <ThumbsUp size={13} className={liked ? "fill-orange-500" : ""} />
              {likeCount > 0 && <span className="font-semibold">{likeCount}</span>}
            </button>

            {/* Reply */}
            <button
              onClick={() => onReply(thought.id, thought.user?.username || displayName)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
            >
              <MessageCircle size={13} />
              <span>Reply</span>
            </button>
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {thought.replies?.map(r => (
        <ThoughtItem
          key={r.id}
          thought={r}
          userId={userId}
          depth={depth + 1}
          onReply={onReply}
          onPraiseToggle={onPraiseToggle}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main LoginPostPage
══════════════════════════════════════════════════════════════ */
export function LoginPostPage() {
  const navigate           = useNavigate();
  const { id }             = useParams<{ id: string }>();
  const { user, profile }  = useAuth();
  const isLoggedIn         = !!user;

  const [post,     setPost]     = useState<LivePost | null>(null);
  const [thoughts, setThoughts] = useState<LiveThought[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [reply,    setReply]    = useState("");
  const [sending,  setSending]  = useState(false);

  /* Reply-to state: which thought are we replying to */
  const [replyToId,       setReplyToId]       = useState<string | null>(null);
  const [replyToUsername, setReplyToUsername] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);

  /* Load post + thoughts */
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchPostById(id, user?.id),
      fetchThoughts(id, user?.id),
    ]).then(([p, t]) => {
      setPost(p);
      setThoughts(t);
      setLoading(false);
    });
  }, [id, user?.id]);

  /* When reply-to changes, focus and prefill @mention */
  const handleSetReply = (thoughtId: string, username: string) => {
    setReplyToId(thoughtId);
    setReplyToUsername(username);
    const mention = username.startsWith("@") ? username : `@${username}`;
    setReply(mention + " ");
    setTimeout(() => {
      inputRef.current?.focus();
      // Put cursor at end
      const len = (mention + " ").length;
      inputRef.current?.setSelectionRange(len, len);
    }, 50);
  };

  const cancelReply = () => {
    setReplyToId(null);
    setReplyToUsername("");
    setReply("");
  };

  /* Send thought */
  const handleSend = async () => {
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!reply.trim() || !id || !user?.id) return;
    setSending(true);
    const newThought = await addThought(id, user.id, reply.trim(), replyToId || undefined);
    if (newThought) {
      if (replyToId) {
        /* Nest under parent */
        setThoughts(prev => prev.map(t => {
          if (t.id === replyToId) return { ...t, replies: [...(t.replies || []), newThought] };
          return t;
        }));
      } else {
        setThoughts(prev => [...prev, newThought]);
      }
      setReply("");
      setReplyToId(null);
      setReplyToUsername("");
    }
    setSending(false);
  };

  /* Loading */
  if (loading) return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  /* Not found */
  if (!post) return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 dark:text-gray-400">Quote not found</p>
      <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-bold">← Go back</button>
    </div>
  );

  /* Total thoughts count (top-level + all replies) */
  const countAllThoughts = (list: LiveThought[]): number =>
    list.reduce((acc, t) => acc + 1 + countAllThoughts(t.replies || []), 0);
  const totalCount = countAllThoughts(thoughts);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Quote</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
            {totalCount} {totalCount === 1 ? "thought" : "thoughts"}
          </p>
        </div>
      </div>

      {/* Post at top — full PostCard */}
      <PostCard
        post={post as any}
        isLoggedIn={isLoggedIn}
        isOwn={post.user_id === user?.id}
      />

      {/* Divider + count */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
        <span className="text-xs text-gray-400 dark:text-gray-600 font-semibold">
          {totalCount} Thoughts
        </span>
        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
      </div>

      {/* Thoughts list */}
      <div className="flex-1 px-4">
        {thoughts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 dark:text-gray-600 text-sm">No thoughts yet. Be the first!</p>
          </div>
        ) : (
          thoughts.map(t => (
            <div key={t.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
              <ThoughtItem
                thought={t}
                userId={user?.id}
                onReply={handleSetReply}
                onPraiseToggle={() => {}}
              />
            </div>
          ))
        )}
        {/* Bottom padding so last thought isn't hidden behind sticky bar */}
        <div className="h-24" />
      </div>

      {/* ── Sticky compose bar ── */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3">

        {/* Reply-to indicator */}
        {replyToId && (
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <CornerDownRight size={13} className="text-blue-500" />
              <span>Replying to <span className="font-semibold text-blue-500">{replyToUsername}</span></span>
            </div>
            <button onClick={cancelReply} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* My avatar */}
          {profile?.avatar_url ? (
            <Avatar src={profile.avatar_url} name={profile.name || "Me"} size={36} />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
              {(profile?.name?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Add your thought…"
            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 placeholder-gray-400 dark:placeholder-gray-600 text-gray-900 dark:text-white transition-all"
          />

          <button
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            {sending
              ? <Loader2 size={15} className="text-white animate-spin" />
              : <Send size={15} className="text-white ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
