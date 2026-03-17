import React, { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchFeedPosts, type LivePost } from "../services/feedService";

/*const CATS = [
  { id: "top",           label: "🔥 Top" },
  { id: "city",          label: "🏙️ City" },
  { id: "sports",        label: "🏏 Sports" },
  { id: "science",       label: "🔬 Science & Tech" },
  { id: "entertainment", label: "🎬 Entertainment" },
  { id: "national",      label: "🇮🇳 National" },
  { id: "world",         label: "🌍 World" },
];
*/
/* ─────────────────────── Stories Bar ───────────────────────────────────── */
interface StoryItem {
  id: string;
  user_id: string;
  story_type: string;
  text_body: string | null;
  media_url: string | null;
  gradient_idx: number;
  created_at: string;
  profile: { name: string; username: string; avatar_url: string | null };
  viewed: boolean;
}

const GRAD_PAIRS = [
  ["#1D4ED8","#06B6D4"], ["#F97316","#EF4444"], ["#16A34A","#059669"],
  ["#7C3AED","#DB2777"], ["#D97706","#F59E0B"], ["#1E1B4B","#4338CA"],
  ["#BE185D","#9333EA"], ["#0F766E","#0D9488"], ["#B91C1C","#D97706"],
  ["#0EA5E9","#6366F1"], ["#84CC16","#10B981"], ["#F43F5E","#FB923C"],
];

function StoriesBar({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [myStory, setMyStory] = useState<StoryItem | null>(null);
  const [myProfile, setMyProfile] = useState<{ name: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Fetch own profile
    supabase.from("profiles").select("name, avatar_url").eq("id", userId).single()
      .then(({ data }) => { if (data) setMyProfile(data); });

    // Fetch stories from people I follow + my own, not expired
    const fetchStories = async () => {
      // Get followed IDs
      const { data: followData } = await supabase
        .from("follows").select("following_id").eq("follower_id", userId);
      const followedIds = (followData || []).map((r: any) => r.following_id);

      // Fetch stories
      const allIds = [userId, ...followedIds];
      const { data: storiesData } = await supabase
        .from("stories")
        .select("id, user_id, story_type, text_body, media_url, gradient_idx, created_at")
        .in("user_id", allIds)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (!storiesData?.length) return;

      // Fetch which ones I've viewed
      const { data: viewData } = await supabase
        .from("story_views").select("story_id").eq("viewer_id", userId);
      const viewedSet = new Set((viewData || []).map((v: any) => v.story_id));

      // Fetch profiles for each unique user_id (deduplicate by user_id, show only latest per user)
      const seenUsers = new Set<string>();
      const deduped: any[] = [];
      storiesData.forEach((s: any) => {
        if (!seenUsers.has(s.user_id)) { seenUsers.add(s.user_id); deduped.push(s); }
      });

      const userIds = [...new Set(deduped.map((s: any) => s.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles").select("id, name, username, avatar_url").in("id", userIds);
      const profileMap: Record<string, any> = {};
      (profilesData || []).forEach((p: any) => { profileMap[p.id] = p; });

      const result: StoryItem[] = deduped.map((s: any) => ({
        ...s,
        profile: profileMap[s.user_id] || { name: "User", username: "user", avatar_url: null },
        viewed: viewedSet.has(s.id),
      }));

      // Separate own story vs others
      const own = result.find(s => s.user_id === userId) || null;
      const others = result.filter(s => s.user_id !== userId);
      setMyStory(own);
      setStories(others);
    };

    fetchStories();
  }, [userId]);

  const getGrad = (idx: number) => {
    const [a, b] = GRAD_PAIRS[Math.abs(idx ?? 0) % GRAD_PAIRS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  };

  const AvatarCircle = ({
    avatarUrl, name, gradIdx, viewed, size = 66, onClick,
  }: { avatarUrl: string | null; name: string; gradIdx?: number; viewed?: boolean; size?: number; onClick: () => void }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 shrink-0">
      <div
        className="rounded-full p-[3px]"
        style={{
          background: viewed ? "#e5e7eb" : "linear-gradient(135deg, #f97316, #ef4444, #7c3aed)",
          width: size + 6, height: size + 6,
        }}
      >
        <div className="rounded-full p-[2.5px] bg-white" style={{ width: size, height: size }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name}
              className="rounded-full object-cover w-full h-full" />
          ) : (
            <div className="rounded-full w-full h-full flex items-center justify-center text-white font-bold text-xl"
              style={{ background: getGrad(gradIdx ?? 0) }}>
              {name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
      </div>
      <span className="text-[11px] font-medium text-gray-600 max-w-[72px] truncate text-center">
        {name.split(" ")[0]}
      </span>
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-3 py-3">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-0.5">
        {/* Add Story — same size as other circles, + badge top-right */}
        <button
          onClick={() => navigate("/status")}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative" style={{ width: 72, height: 72 }}>
            {/* Ring */}
            <div className="absolute inset-0 rounded-full"
              style={{ background: "#e5e7eb", padding: 3 }}>
              <div className="rounded-full bg-white w-full h-full p-[2.5px]">
                {myProfile?.avatar_url ? (
                  <img src={myProfile.avatar_url} alt=""
                    className="rounded-full object-cover w-full h-full" />
                ) : (
                  <div className="rounded-full w-full h-full bg-blue-50 flex items-center justify-center text-blue-400 font-bold text-xl">
                    {myProfile?.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
            </div>
            {/* + badge — top-right corner, above ring */}
            <div className="absolute -top-0.5 -right-0.5 z-10 w-6 h-6 rounded-full bg-blue-600 border-[2.5px] border-white flex items-center justify-center shadow-sm">
              <Plus size={12} className="text-white" strokeWidth={3} />
            </div>
          </div>
          <span className="text-[11px] font-medium text-gray-500 max-w-[72px] truncate text-center">
            {myStory ? "My Story" : "Add Story"}
          </span>
        </button>

        {/* Own story (if exists, show it beside add button) */}
        {myStory && (
          <AvatarCircle
            avatarUrl={myProfile?.avatar_url ?? null}
            name="My Story"
            gradIdx={myStory.gradient_idx}
            viewed={myStory.viewed}
            onClick={() => navigate(`/status/${myStory.user_id}`)}
          />
        )}

        {/* Followed users' stories */}
        {stories.map((s) => (
          <AvatarCircle
            key={s.id}
            avatarUrl={s.profile.avatar_url}
            name={s.profile.name}
            gradIdx={s.gradient_idx}
            viewed={s.viewed}
            onClick={() => navigate(`/status/${s.user_id}`)}
          />
        ))}

        {/* Placeholder circles if no stories yet (demo) */}
        {stories.length === 0 && !myStory && (
          <div className="flex items-center justify-center flex-1 py-2">
            <p className="text-xs text-gray-400 font-medium">No stories yet — be the first!</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Skeleton ── */
/* ── Inline skeleton (until PostCard phase) ── */
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

/* ── Empty state ── */
function EmptyState({ category }: { category: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-5xl mb-4">{category === "top" ? "🌐" : "📭"}</div>
      <p className="font-bold text-gray-800 text-lg mb-1">No quotes yet</p>
      <p className="text-gray-500 text-sm">
        {category === "top" ? "Be the first to post something!" : "Switch to Top to see all posts."}
      </p>
    </div>
  );
}

/* ═══════════════════════ FeedPage ═══════════════════════════════════════════ */
export function FeedPage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("top");
  const [posts, setPosts] = useState<LivePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 15;

  /* Fetch followed user IDs once */
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("follows").select("following_id").eq("follower_id", user.id)
      .then(({ data }) => {
        if (data) setFollowedIds(new Set(data.map((r: any) => r.following_id)));
      });
  }, [user?.id]);

  /* Load posts */
  const loadPosts = useCallback(async (cat: string, pg: number, replace: boolean) => {
    if (replace) setLoading(true); else setLoadingMore(true);
    const newPosts = await fetchFeedPosts(cat, pg, PAGE_SIZE, user?.id);
    if (replace) { setPosts(newPosts); setLoading(false); }
    else { setPosts(prev => [...prev, ...newPosts]); setLoadingMore(false); }
    setHasMore(newPosts.length === PAGE_SIZE);
  }, [user?.id]);

  useEffect(() => {
    setPage(0); setHasMore(true);
    loadPosts(activeCategory, 0, true);
  }, [activeCategory]);

  /* Infinite scroll */
  useEffect(() => {
    if (loading || !hasMore) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingMore && hasMore) {
        const next = page + 1;
        setPage(next);
        loadPosts(activeCategory, next, false);
      }
    }, { threshold: 0.5 });
    if (bottomRef.current) obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [loading, loadingMore, hasMore, page, activeCategory]);

  return (
    <AppShell>
      <div className="page-enter">

        {/* Stories bar — logged-in only */}
        {user?.id && <StoriesBar userId={user.id} />}

        {/* Category tabs removed for logged-in users */}

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
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
                isFollowing={followedIds.has(post.user_id)}
                currentUserId={user?.id}
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
