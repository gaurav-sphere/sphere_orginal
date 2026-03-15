import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { GuestShell } from "../components/GuestShell";
import { PostCard } from "../components/PostCard";
import { LoginGateSheet } from "../components/LoginGateSheet";
import { getCategoryById, isValidCategory } from "../config/categories";
import { fetchFeedPosts, type LivePost } from "../services/feedService";

/* ── Guest post limit ── */
const GUEST_POST_LIMIT = 20;

/* ── Inline skeleton — temporary until PostCard phase ──
   Remove this and import PostSkeleton once PostCard is rewritten.
── */
function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-32 w-full rounded-xl bg-gray-200 dark:bg-gray-700 mt-2" />
        </div>
      </div>
    </div>
  );
}

/* ── Guest gate — shown after GUEST_POST_LIMIT posts ── */
function GuestGate({ count }: { count: number }) {
  const navigate = useNavigate();
  return (
    <div className="bg-gradient-to-b from-white dark:from-gray-900 to-blue-50 dark:to-blue-950 p-8 text-center border-b border-gray-100 dark:border-gray-800">
      <p className="font-bold text-gray-900 dark:text-white text-base mb-1">
        You've seen {count} quotes 👀
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Sign up free to get your personalised feed and see more.
      </p>
      <button onClick={() => navigate("/login")}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
        Join Sphere — It's Free →
      </button>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ categoryLabel }: { categoryLabel: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-6">
      <span className="text-4xl mb-3">📭</span>
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
        No quotes in {categoryLabel} yet
      </p>
      <p className="text-xs text-center">Be the first — sign up and post something!</p>
      <button onClick={() => navigate("/login")}
        className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
        Join Sphere
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CategoryPage
   Route: /category/:id
   One file handles every category route.
   Phase 2: add useAuth() here, swap GuestShell → AppShell,
            remove guest limit.
══════════════════════════════════════════════════════════════ */
export function CategoryPage() {
  const { id = "top" } = useParams<{ id: string }>();
  const navigate        = useNavigate();

  /* Redirect unknown category ids to home */
  useEffect(() => {
    if (!isValidCategory(id)) navigate("/", { replace: true });
  }, [id, navigate]);

  const category = getCategoryById(id);

  const [posts,      setPosts]      = useState<LivePost[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [gateAction, setGateAction] = useState<string | null>(null);

  const loadPosts = useCallback(async (catId: string) => {
    setLoading(true);
    setPosts([]);
    const data = await fetchFeedPosts(catId, 0, GUEST_POST_LIMIT + 5);
    setPosts(data);
    setLoading(false);
  }, []);

  /* Reload on category change */
  useEffect(() => {
    if (isValidCategory(id)) loadPosts(id);
  }, [id, loadPosts]);

  /* Scroll to top on category change */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  return (
    <>
      <GuestShell activeCategory={id}>

        {/* Category banner */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
            <category.Icon size={17} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
              {category.label}
            </h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
              {id === "top" ? "Top quotes right now" : `Best quotes in ${category.label}`}
            </p>
          </div>
        </div>

        {/* Feed */}
        <div className="page-enter">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
          ) : posts.length === 0 ? (
            <EmptyState categoryLabel={category.label} />
          ) : (
            <>
              {posts.slice(0, GUEST_POST_LIMIT).map(post => (
                <PostCard
                  key={post.id}
                  post={post as any}
                  isLoggedIn={false}
                />
              ))}
              {posts.length >= GUEST_POST_LIMIT && <GuestGate count={GUEST_POST_LIMIT} />}
            </>
          )}
        </div>

      </GuestShell>

      {gateAction && (
        <LoginGateSheet action={gateAction as any} onClose={() => setGateAction(null)} />
      )}
    </>
  );
}
