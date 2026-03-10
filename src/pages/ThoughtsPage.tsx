import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Send, Heart, Shield, Loader2 } from "lucide-react";
import { PostCard } from "../components/PostCard";
import { LoginGateSheet } from "../components/LoginGateSheet";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchPostById,
  fetchThoughts,
  addThought,
  toggleThoughtPraise,
  type LivePost,
  type LiveThought,
} from "../services/feedService";

const GUEST_THOUGHT_LIMIT = 3;

/* ── Single thought item ─────────────────────────────────────────────────── */
function ThoughtItem({
  thought,
  isLoggedIn,
  userId,
  isReply = false,
}: {
  thought: LiveThought;
  isLoggedIn: boolean;
  userId?: string;
  isReply?: boolean;
}) {
  const [liked, setLiked]       = useState(thought.isLiked || false);
  const [likeCount, setLikeCount] = useState(thought.likes);
  const [showGate, setShowGate] = useState(false);

  const handleLike = async () => {
    if (!isLoggedIn || !userId) { setShowGate(true); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => next ? c + 1 : Math.max(0, c - 1));
    await toggleThoughtPraise(thought.id, userId, liked);
  };

  const displayName = thought.is_anon ? "Anonymous" : thought.user?.name;
  const displayAvatar = thought.is_anon ? null : thought.user?.avatar;

  return (
    <>
      <div className={`flex gap-3 py-3 ${isReply ? "pl-12" : ""}`}>
        {thought.is_anon ? (
          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
            <Shield size={16} className="text-gray-300" />
          </div>
        ) : displayAvatar ? (
          <img
            src={displayAvatar}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-blue-600 font-bold text-sm">
              {(displayName || "U")[0].toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-bold text-gray-900">{displayName}</span>
            {thought.user?.isVerified && !thought.is_anon && (
              <span className="text-blue-500 text-xs">✓</span>
            )}
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{thought.timestamp}</span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{thought.content}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-xs transition-colors ${
                liked ? "text-red-500" : "text-gray-400 hover:text-red-400"
              }`}
            >
              <Heart size={13} fill={liked ? "currentColor" : "none"} />
              {likeCount > 0 && <span className="font-semibold">{likeCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {thought.replies?.map((r) => (
        <ThoughtItem
          key={r.id}
          thought={r}
          isLoggedIn={isLoggedIn}
          userId={userId}
          isReply
        />
      ))}

      {showGate && (
        <LoginGateSheet action="praise" onClose={() => setShowGate(false)} />
      )}
    </>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export function ThoughtsPage() {
  const navigate             = useNavigate();
  const { id }               = useParams<{ id: string }>();
  const { user }             = useAuth();           // ← real auth, NOT hardcoded
  const isLoggedIn           = !!user;

  const [post, setPost]           = useState<LivePost | null>(null);
  const [thoughts, setThoughts]   = useState<LiveThought[]>([]);
  const [loading, setLoading]     = useState(true);
  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const [gateAction, setGateAction] = useState<string | null>(null);
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

  /* Send a new thought */
  const handleSend = async () => {
    if (!isLoggedIn) { setGateAction("thought"); return; }
    if (!reply.trim() || !id || !user?.id) return;

    setSending(true);
    const newThought = await addThought(id, user.id, reply.trim());
    if (newThought) {
      setThoughts((prev) => [newThought, ...prev]);
      setReply("");
    }
    setSending(false);
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  /* ── Post not found ── */
  if (!post) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Post not found</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-bold">
          ← Go back
        </button>
      </div>
    );
  }

  const visibleThoughts  = isLoggedIn ? thoughts : thoughts.slice(0, GUEST_THOUGHT_LIMIT);
  const hasHiddenThoughts = !isLoggedIn && thoughts.length > GUEST_THOUGHT_LIMIT;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Thoughts</h1>
        <span className="text-sm text-gray-400 ml-0.5">({thoughts.length})</span>
      </div>

      {/* Original post */}
      <PostCard post={post as any} isLoggedIn={isLoggedIn} isOwn={post.user_id === user?.id} />

      {/* Thoughts list */}
      <div className="px-4 py-2 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gray-100" />
          <span className="text-xs text-gray-400 font-semibold">{thoughts.length} Thoughts</span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        {thoughts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">No thoughts yet. Be the first!</p>
          </div>
        ) : (
          <>
            {visibleThoughts.map((t) => (
              <div key={t.id} className="border-b border-gray-50 last:border-0">
                <ThoughtItem
                  thought={t}
                  isLoggedIn={isLoggedIn}
                  userId={user?.id}
                />
              </div>
            ))}

            {/* Guest blur gate */}
            {hasHiddenThoughts && (
              <div className="relative mt-2">
                <div className="blur-sm pointer-events-none select-none">
                  <ThoughtItem
                    thought={thoughts[GUEST_THOUGHT_LIMIT]}
                    isLoggedIn={false}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent flex flex-col items-center justify-end pb-4 gap-3">
                  <p className="text-sm font-bold text-gray-900">
                    Sign up to read all {thoughts.length} thoughts
                  </p>
                  <button
                    onClick={() => navigate("/login")}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Join Sphere — It's Free
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reply input — locked for guests */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        {isLoggedIn ? (
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
            {(user?.email?.[0] || "U").toUpperCase()}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-gray-400" />
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isLoggedIn ? "Add your thought…" : "Log in to add a thought…"}
          onClick={() => { if (!isLoggedIn) setGateAction("thought"); }}
          readOnly={!isLoggedIn}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder-gray-400 cursor-text"
        />

        <button
          onClick={handleSend}
          disabled={(!reply.trim() && isLoggedIn) || sending}
          className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {sending
            ? <Loader2 size={15} className="text-white animate-spin" />
            : <Send size={15} className="text-white ml-0.5" />
          }
        </button>
      </div>

      {gateAction && (
        <LoginGateSheet action={gateAction as any} onClose={() => setGateAction(null)} />
      )}
    </div>
  );
}
