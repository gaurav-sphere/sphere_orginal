import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { GuestShell } from "../components/GuestShell";
import { supabase } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   GuestPostPage
   Route: /post/:id

   MOBILE  — full screen page, no GuestShell chrome
             "Quote" heading + login button top-right
             post content → up to 3 comments → gate

   DESKTOP — inside GuestShell layout (header + sidebar + promo)
             no extra login button (already in header/sidebar)
             same content restrictions as mobile

   GUEST RESTRICTIONS:
   ✗ Cannot praise (like)
   ✗ Cannot forward (repost)
   ✗ Cannot bookmark
   ✗ Cannot reply
   ✗ Cannot visit profiles (name/avatar → login page)
   ✗ Can read max 3 comments then gate
   ✓ Can read post content fully
   ✓ Can see comment count preview
══════════════════════════════════════════════════════════════ */

const COMMENT_LIMIT = 3;

/* ── Types ── */
interface Post {
  id:          string;
  content:     string;
  media_url:   string | null;
  created_at:  string;
  likes_count: number;
  reposts_count: number;
  comments_count: number;
  user_id:     string;
  profile: {
    name:       string;
    username:   string;
    avatar_url: string | null;
  };
}

interface Comment {
  id:         string;
  content:    string;
  created_at: string;
  user_id:    string;
  profile: {
    name:      string;
    username:  string;
    avatar_url: string | null;
  };
}

/* ── Time formatting ── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ── Avatar circle ── */
function Avatar({
  name, avatarUrl, size = 40, onClick,
}: { name: string; avatarUrl: string | null; size?: number; onClick?: () => void }) {
  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-blue-600 text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : initials}
    </button>
  );
}

/* ── Skeleton for loading state ── */
function PostSkeleton() {
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
      <div className="h-56 w-full rounded-xl bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

/* ── Comment gate — shown after COMMENT_LIMIT comments ── */
function CommentGate({ total }: { total: number }) {
  const navigate = useNavigate();
  return (
    <div className="mx-4 my-3 bg-gradient-to-br from-blue-50 dark:from-blue-950 to-indigo-50 dark:to-indigo-950 rounded-2xl p-5 text-center border border-blue-100 dark:border-blue-900">
      <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
        {total > COMMENT_LIMIT
          ? `${total - COMMENT_LIMIT} more replies hidden`
          : "Join to see all replies"}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Sign up free to read all replies and join the conversation.
      </p>
      <button
        onClick={() => navigate("/login")}
        className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
      >
        Join Sphere — It's Free →
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Inner content — shared between mobile and desktop
══════════════════════════════════════════════════════════════ */
function PostContent({
  post,
  comments,
  loading,
}: {
  post:     Post | null;
  comments: Comment[];
  loading:  boolean;
}) {
  const navigate = useNavigate();
  const goLogin  = () => navigate("/login");

  if (loading) return <PostSkeleton />;
  if (!post)   return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-6">
      <span className="text-4xl mb-3">🔍</span>
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Quote not found</p>
      <button onClick={() => navigate("/")}
        className="mt-4 text-sm text-blue-600 font-bold hover:underline">
        Back to home
      </button>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full">

      {/* ── Post header ── */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Avatar → login */}
        <Avatar
          name={post.profile.name}
          avatarUrl={post.profile.avatar_url}
          size={44}
          onClick={goLogin}
        />
        <div className="flex-1 min-w-0">
          {/* Name → login */}
          <button onClick={goLogin} className="text-left">
            <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight hover:underline">
              {post.profile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              @{post.profile.username} · {timeAgo(post.created_at)}
            </p>
          </button>
        </div>
      </div>

      {/* ── Post content (allow-copy for quote text) ── */}
      <div className="allow-copy px-4 pb-3">
        <p className="text-gray-900 dark:text-white text-[15px] leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
      </div>

      {/* ── Post media ── */}
      {post.media_url && (
        <div className="px-4 pb-3">
          <img
            src={post.media_url}
            alt="Quote media"
            className="w-full rounded-2xl object-cover max-h-[480px]"
          />
        </div>
      )}

      {/* ── Action row — all gated ── */}
      <div className="flex items-center gap-5 px-4 py-3 border-t border-b border-gray-100 dark:border-gray-800">
        {/* Comments count — gated */}
        <button
          onClick={() => goLogin()}
          className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span className="text-xs font-semibold">{post.comments_count}</span>
        </button>

        {/* Forward — gated */}
        <button
          onClick={() => goLogin()}
          className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
          </svg>
          <span className="text-xs font-semibold">{post.reposts_count}</span>
        </button>

        {/* Praise — gated */}
        <button
          onClick={() => goLogin()}
          className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
            <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
          </svg>
          <span className="text-xs font-semibold">{post.likes_count}</span>
        </button>

        <div className="flex-1" />

        {/* Bookmark — gated */}
        <button
          onClick={() => goLogin()}
          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>

      {/* ── Comments section ── */}
      <div className="pt-2">
        <p className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
          Replies
        </p>

        {comments.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-600">No replies yet</p>
            <button
              onClick={() => goLogin()}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              Be the first to reply →
            </button>
          </div>
        ) : (
          <>
            {comments.slice(0, COMMENT_LIMIT).map(comment => (
              <div key={comment.id}
                className="flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                {/* Comment avatar → login */}
                <Avatar
                  name={comment.profile.name}
                  avatarUrl={comment.profile.avatar_url}
                  size={34}
                  onClick={goLogin}
                />
                <div className="flex-1 min-w-0">
                  <button onClick={goLogin} className="text-left mb-0.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-white hover:underline">
                      {comment.profile.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1.5">
                      · {timeAgo(comment.created_at)}
                    </span>
                  </button>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}

            {/* Gate after COMMENT_LIMIT */}
            {post.comments_count > COMMENT_LIMIT && (
              <CommentGate total={post.comments_count} />
            )}
          </>
        )}
      </div>

      {/* Reply input — gated */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        <button
          onClick={() => goLogin()}
          className="w-full flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 text-left hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <span>Write a reply…</span>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main GuestPostPage
══════════════════════════════════════════════════════════════ */
export function GuestPostPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();

  const [post,     setPost]     = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading,  setLoading]  = useState(true);

  /* Fetch post + top comments */
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const fetchData = async () => {
      const { data: postData } = await supabase
        .from("posts")
        .select(`
          id, content, media_url, created_at,
          likes_count, reposts_count, comments_count, user_id,
          profile:profiles!posts_user_id_fkey (
            name, username, avatar_url
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (postData) setPost(postData as any);

      const { data: commentData } = await supabase
        .from("thoughts")
        .select(`
          id, content, created_at, user_id,
          profile:profiles!thoughts_user_id_fkey (
            name, username, avatar_url
          )
        `)
        .eq("post_id", id)
        .order("created_at", { ascending: true })
        .limit(COMMENT_LIMIT + 1);

      if (commentData) setComments(commentData as any);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  return (
    <>
      {/* MOBILE — full screen */}
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
                  {post.comments_count} {post.comments_count === 1 ? "reply" : "replies"}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
            Login
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PostContent post={post} comments={comments} loading={loading} />
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
                  {post.comments_count} {post.comments_count === 1 ? "reply" : "replies"}
                </p>
              )}
            </div>
          </div>
          <PostContent post={post} comments={comments} loading={loading} />
        </GuestShell>
      </div>
    </>
  );
}
