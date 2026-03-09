import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { mockStoriesUsers, currentUser } from "../mockData";
import { getFeedQuotes } from "../../services/feedService";

const CATS = [
  { id: "top", label: "🔥 Top" },
  { id: "city", label: "🏙️ City" },
  { id: "sports", label: "🏏 Sports" },
  { id: "science", label: "🔬 Science" },
  { id: "entertainment", label: "🎬 Entertainment" },
  { id: "world", label: "🌍 World" },
];

/* ── Skeleton Loader ── */
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
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-5 w-12 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stories Bar ── */
function StoriesBar() {
  const navigate = useNavigate();

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide">

        {/* Add Status */}
        <div
          className="flex flex-col items-center gap-1 shrink-0"
          onClick={() => navigate("/status")}
        >
          <div className="relative cursor-pointer">
            <img
              src={
                currentUser?.avatar ||
                "https://images.unsplash.com/photo-1639149888905-fb39731f2e6c?w=60&h=60&fit=crop"
              }
              alt="me"
              className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-200"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-white text-xs font-bold">+</span>
            </div>
          </div>

          <span className="text-[10px] text-gray-500 font-medium">
            Add
          </span>
        </div>

        {/* User Status */}
        {mockStoriesUsers.map((s: any) => (
          <div
            key={s.id}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            onClick={() => navigate(`/status/${s.user.id}`)}
          >
            <div
              className={`p-[2.5px] rounded-full ${
                s.seen ? "story-ring-seen" : "story-ring"
              }`}
            >
              <img
                src={s.user.avatar}
                alt={s.user.name}
                className="w-12 h-12 rounded-full object-cover ring-[2px] ring-white"
              />
            </div>

            <span className="text-[10px] text-gray-500 font-medium max-w-[52px] truncate text-center">
              {s.user.name.split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeedPage() {

  const [activeCategory, setActiveCategory] = useState("top");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const bottomRef = useRef<HTMLDivElement>(null);

  /* Load feed from Supabase */
  useEffect(() => {
    async function loadFeed() {
      try {
        setLoading(true);

        const data = await getFeedQuotes();

        if (data) {
          setPosts(data);
        } else {
          setPosts([]);
        }

      } catch (err) {
        console.error("Feed load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, []);

  /* Reset visible posts when category changes */
  useEffect(() => {
    setVisibleCount(10);
  }, [activeCategory]);

  /* Infinite Scroll */
  useEffect(() => {
    if (loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) {
          setLoadingMore(true);

          setTimeout(() => {
            setVisibleCount((prev) => prev + 5);
            setLoadingMore(false);
          }, 800);
        }
      },
      { threshold: 0.5 }
    );

    if (bottomRef.current) observer.observe(bottomRef.current);

    return () => observer.disconnect();
  }, [loading, loadingMore]);

  /* Category filter */
  const filteredPosts =
    activeCategory === "top"
      ? posts
      : posts.filter(
          (p: any) => p.category?.toLowerCase() === activeCategory
        );

  return (
    <AppShell>

      <div className="page-enter mt-14 lg:mt-0">

        {/* Category Tabs */}
        <div className="bg-white border-b border-gray-100 sticky top-14 lg:top-0 z-20">
          <div className="flex overflow-x-auto scrollbar-hide px-2 py-1 gap-1">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === c.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <StoriesBar />

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <PostSkeleton key={i} />
          ))
        ) : (
          <>
            {filteredPosts.slice(0, visibleCount).map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                isLoggedIn={true}
                isOwn={post.user?.id === "u1"}
              />
            ))}

            {/* Infinite scroll loader */}
            <div ref={bottomRef} className="py-4 flex justify-center">
              {loadingMore && (
                <Loader2
                  size={20}
                  className="animate-spin text-blue-400"
                />
              )}
            </div>
          </>
        )}

      </div>

    </AppShell>
  );
}