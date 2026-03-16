import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { GuestShell } from "../components/GuestShell";
import { fetchPostById, fetchThoughts, type LivePost, type LiveThought } from "../services/feedService";
import { Loader2, Shield, Check, ThumbsUp, MessageCircle, RefreshCw, Bookmark } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   GuestPostPage — Route: /post/:id
   Isolated guest view. All interactive actions → /login.
   Max 3 visible thoughts then gate.
   Security: completely separate from LoginPostPage.
══════════════════════════════════════════════════════════════ */

const THOUGHT_LIMIT = 3;

/* ── Avatar ── */
function Avatar({ src, name, size = 40, onClick }: {
  src?: string | null; name: string; size?: number; onClick?: () => void;
}) {
  const [err, setErr] = useState(false);
  const initials = (name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="shrink-0 rounded-full overflow-hidden"
      style={{ width: size, height: size }}>
      {src && !err
        ? <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
        : <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold"
            style={{ fontSize: size * 0.36 }}>{initials}</div>}
    </Tag>
  );
}

/* ── Thought gate ── */
function ThoughtGate({ total }: { total: number }) {
  const navigate = useNavigate();
  return (
    <div className="mx-4 my-4 bg-gradient-to-br from-blue-50 dark:from-blue-950 to-indigo-50 dark:to-indigo-950 rounded-2xl p-5 text-center border border-blue-100 dark:border-blue-900">
      <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
        {total > THOUGHT_LIMIT ? `${total - THOUGHT_LIMIT} more thoughts hidden` : "Join to see all thoughts"}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Sign up free to read all replies and join the conversation.
      </p>
      <button onClick={() => navigate("/login")}
        className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
        Join Sphere — It's Free →
      </button>
    </div>
  );
}

/* ── Skeleton ── */
function Skeleton() {
  return (
    <div className="animate-pulse p-4 space-y-3">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-56 w-full rounded-2xl bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

/* ── Post content ── */
function PostContent({ post, thoughts, loading }: {
  post: LivePost | null; thoughts: LiveThought[]; loading: boolean;
}) {
  const navigate = useNavigate();
  const goLogin  = () => navigate("/login");

  if (loading) return <Skeleton />;
  if (!post) return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-gray-400">
      <span className="text-4xl mb-3">🔍</span>
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Quote not found</p>
      <button onClick={() => navigate("/")} className="mt-4 text-sm text-blue-600 font-bold">Back to home</button>
    </div>
  );

  const displayName     = post.is_anon ? "Anonymous" : post.user?.name;
  const displayUsername = post.is_anon ? "" : post.user?.username;

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full">

      {/* Post header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        {post.is_anon ? (
          <div className="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
            <Shield size={18} className="text-gray-300" />
          </div>
        ) : (
          <Avatar src={post.user?.avatar} name={displayName || "User"} size={44} onClick={goLogin} />
        )}
        <div className="flex-1 min-w-0">
          <button onClick={goLogin} className="text-left">
            <div className="flex items-center gap-1">
              <p className="font-bold text-gray-900 dark:text-white text-sm hover:underline">{displayName}</p>
              {post.user?.isVerified && !post.is_anon && (
                <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-500 rounded-full">
                  <Check size={9} className="text-white" strokeWidth={3} />
                </span>
              )}
            </div>
            {!post.is_anon && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{displayUsername} · {post.timestamp}</p>
            )}
            {post.is_anon && <p className="text-xs text-gray-400">{post.timestamp}</p>}
          </button>
        </div>
      </div>

      {/* Post text — allow-copy for quote text */}
      <div className="allow-copy px-4 pb-3">
        <p className="text-gray-900 dark:text-white text-[15px] leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
      </div>

      {/* Media */}
      {post.mediaItems && post.mediaItems.length > 0 && (
        <div className="px-4 pb-3">
          <img src={post.mediaItems[0].url} alt="media"
            className="w-full rounded-2xl object-cover max-h-96"
            onContextMenu={e => e.preventDefault()}
          />
        </div>
      )}
      {!post.mediaItems?.length && post.images?.length > 0 && (
        <div className="px-4 pb-3">
          <img src={post.images[0]} alt="media"
            className="w-full rounded-2xl object-cover max-h-96"
            onContextMenu={e => e.preventDefault()}
          />
        </div>
      )}

      {/* Action row — all gated */}
      <div className="flex items-center gap-5 px-4 py-3 border-t border-b border-gray-100 dark:border-gray-800">
        <button onClick={goLogin} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
          <MessageCircle size={17} /><span className="text-xs font-medium">{post.thoughts ?? 0}</span>
        </button>
        <button onClick={goLogin} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 transition-colors">
          <RefreshCw size={17} /><span className="text-xs font-medium">{post.reposts ?? 0}</span>
        </button>
        <button onClick={goLogin} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">
          <ThumbsUp size={17} /><span className="text-xs font-medium">{post.likes ?? 0}</span>
        </button>
        <div className="flex-1" />
        <button onClick={goLogin} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 transition-colors">
          <Bookmark size={17} />
        </button>
      </div>

      {/* Thoughts section */}
      <div className="pt-2">
        <p className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
          Thoughts
        </p>

        {thoughts.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-600">No thoughts yet</p>
            <button onClick={goLogin} className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
              Be the first to share a thought →
            </button>
          </div>
        ) : (
          <>
            {thoughts.slice(0, THOUGHT_LIMIT).map(t => {
              const tName   = t.is_anon ? "Anonymous" : t.user?.name || "User";
              const tAvatar = t.is_anon ? null : t.user?.avatar;
              return (
                <div key={t.id} className="flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                  {t.is_anon ? (
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                      <Shield size={13} className="text-gray-400" />
                    </div>
                  ) : (
                    <Avatar src={tAvatar} name={tName} size={32} onClick={goLogin} />
                  )}
                  <div className="flex-1 min-w-0">
                    <button onClick={goLogin} className="flex items-center gap-1 mb-0.5 hover:underline">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{tName}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">· {t.timestamp}</span>
                    </button>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{t.content}</p>
                  </div>
                </div>
              );
            })}
            {post.thoughts > THOUGHT_LIMIT && <ThoughtGate total={post.thoughts} />}
          </>
        )}
      </div>

      {/* Reply input — gated */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        <button onClick={goLogin}
          className="w-full flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 text-left hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          Write a thought…
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GuestPostPage
══════════════════════════════════════════════════════════════ */
export function GuestPostPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();

  const [post,     setPost]     = useState<LivePost | null>(null);
  const [thoughts, setThoughts] = useState<LiveThought[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchPostById(id),
      fetchThoughts(id),
    ]).then(([p, t]) => {
      setPost(p);
      setThoughts(t);
      setLoading(false);
    });
  }, [id]);

  return (
    <>
      {/* MOBILE — full screen, no shell */}
      <div className="lg:hidden h-[100dvh] flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Quote</p>
              {post && !loading && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                  {post.thoughts ?? 0} thoughts
                </p>
              )}
            </div>
          </div>
          <button onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-blue-700 transition-colors">
            Login
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PostContent post={post} thoughts={thoughts} loading={loading} />
        </div>
      </div>

      {/* DESKTOP — inside GuestShell */}
      <div className="hidden lg:block">
        <GuestShell>
          <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Quote</p>
              {post && !loading && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                  {post.thoughts ?? 0} thoughts
                </p>
              )}
            </div>
          </div>
          <PostContent post={post} thoughts={thoughts} loading={loading} />
        </GuestShell>
      </div>
    </>
  );
}
