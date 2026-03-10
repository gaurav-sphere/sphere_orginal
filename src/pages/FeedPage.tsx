import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { fetchFeedPosts, type LivePost } from "../services/feedService";

const CATS = [
  { id: "top",           label: "🔥 Top" },
  { id: "city",          label: "🏙️ City" },
  { id: "sports",        label: "🏏 Sports" },
  { id: "science",       label: "🔬 Science" },
  { id: "entertainment", label: "🎬 Entertainment" },
  { id: "world",         label: "🌍 World" },
];

/* ── Skeleton ── */
function PostSkeleton() {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="flex gap-3">
        <div className="skeleton w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="skeleton h-3.5 w-28 rounded" />
            <div className="skeleton h-3.5 w-16 rounded" />
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
          <div className="flex gap-5 mt-3">
            {[0,1,2,3].map(i => <div key={i} className="skeleton h-5 w-12 rounded" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ category }: { category: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-5xl mb-4">
        {category === "top" ? "🌐" : category === "city" ? "🏙️" : "📭"}
      </div>
      <p className="font-bold text-gray-800 text-lg mb-1">No posts yet</p>
      <p className="text-gray-500 text-sm">
        {category === "top"
          ? "Be the first to post something!"
          : `No posts in ${category} yet. Switch to Top to see all posts.`}
      </p>
    </div>
  );
}

export function FeedPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("top");
  const [posts, setPosts] = useState<LivePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 15;

  /* Load posts when category changes */
  const loadPosts = useCallback(async (cat: string, pg: number, replace: boolean) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);

    const newPosts = await fetchFeedPosts(cat, pg, PAGE_SIZE, user?.id);

    if (replace) {
      setPosts(newPosts);
      setLoading(false);
    } else {
      setPosts(prev => [...prev, ...newPosts]);
      setLoadingMore(false);
    }

    setHasMore(newPosts.length === PAGE_SIZE);
  }, [user?.id]);

  /* Category change → reset and reload */
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    loadPosts(activeCategory, 0, true);
  }, [activeCategory]);

  /* Infinite scroll */
  useEffect(() => {
    if (loading || !hasMore) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingMore && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadPosts(activeCategory, nextPage, false);
      }
    }, { threshold: 0.5 });
    if (bottomRef.current) obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [loading, loadingMore, hasMore, page, activeCategory]);

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0">
        {/* Category tabs */}
        <div className="bg-white border-b border-gray-100 sticky top-14 lg:top-0 z-20">
          <div className="flex overflow-x-auto scrollbar-hide px-2 py-1 gap-1">
            {CATS.map((c) => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === c.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <PostSkeleton key={i} />)
        ) : posts.length === 0 ? (
          <EmptyState category={activeCategory} />
        ) : (
          <>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post as any}
                isLoggedIn={!!user}
                isOwn={post.user_id === user?.id}
              />
            ))}
            <div ref={bottomRef} className="py-4 flex justify-center">
              {loadingMore && <Loader2 size={20} className="animate-spin text-blue-400" />}
              {!hasMore && posts.length > 0 && (
                <p className="text-xs text-gray-400 font-medium">You're all caught up ✓</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
