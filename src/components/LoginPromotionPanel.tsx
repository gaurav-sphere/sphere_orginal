import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   LoginPromotionPanel
   Shown in the right panel (w-64) on /feed and /feed/search only.
   Replaces the guest PromotionPanel for logged-in users.

   Contains:
   1. Who to follow — users not yet followed, ordered by followers_count
   2. Trending — from hashtag_stats table, fallback to post aggregation
   3. Footer links

   All data is real from Supabase.
══════════════════════════════════════════════════════════════ */

interface SuggestedUser {
  id:              string;
  username:        string;
  name:            string;
  avatar_url:      string | null;
  is_verified:     boolean;
  followers_count: number;
}

interface TrendingTag {
  tag:         string;
  posts_count: number;
}

export function LoginPromotionPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [trendingTags,   setTrendingTags]   = useState<TrendingTag[]>([]);
  const [following,      setFollowing]      = useState<Set<string>>(new Set());
  const [loadingUsers,   setLoadingUsers]   = useState(true);
  const [loadingTrends,  setLoadingTrends]  = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchSuggested();
    fetchTrending();
  }, [user?.id]);

  /* ── Suggested users ── */
  const fetchSuggested = async () => {
    if (!user?.id) return;
    setLoadingUsers(true);

    /* Get IDs the user already follows */
    const { data: followData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const followedIds = (followData || []).map((f: any) => f.following_id as string);
    followedIds.push(user.id); // exclude self

    /* Build query — exclude already-followed + self */
    let query = supabase
      .from("profiles")
      .select("id, username, name, avatar_url, is_verified, followers_count")
      .order("followers_count", { ascending: false })
      .limit(5);

    if (followedIds.length > 0) {
      query = query.not("id", "in", `(${followedIds.join(",")})`);
    }

    const { data } = await query;
    setSuggestedUsers(data || []);
    setLoadingUsers(false);
  };

  /* ── Trending hashtags ── */
  const fetchTrending = async () => {
    setLoadingTrends(true);

    /* Try hashtag_stats table first (populated by DB trigger) */
    const { data: statsData } = await supabase
      .from("hashtag_stats")
      .select("tag, posts_count")
      .order("posts_count", { ascending: false })
      .limit(8);

    if (statsData && statsData.length > 0) {
      setTrendingTags(statsData);
      setLoadingTrends(false);
      return;
    }

    /* Fallback: aggregate hashtags from 200 recent posts */
    const { data: posts } = await supabase
      .from("posts")
      .select("hashtags")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (posts) {
      const tagCount: Record<string, number> = {};
      posts.forEach((p: any) => {
        (p.hashtags as string[] || []).forEach(tag => {
          const clean = tag.replace(/^#/, "").toLowerCase();
          if (clean) tagCount[clean] = (tagCount[clean] || 0) + 1;
        });
      });
      const sorted = Object.entries(tagCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([tag, posts_count]) => ({ tag, posts_count }));
      setTrendingTags(sorted);
    }

    setLoadingTrends(false);
  };

  /* ── Follow / unfollow ── */
  const handleFollow = async (targetId: string) => {
    if (!user?.id) return;
    const isFollowing = following.has(targetId);

    /* Optimistic update */
    setFollowing(prev => {
      const next = new Set(prev);
      isFollowing ? next.delete(targetId) : next.add(targetId);
      return next;
    });

    if (isFollowing) {
      await supabase.from("follows").delete()
        .eq("follower_id", user.id).eq("following_id", targetId);
    } else {
      await supabase.from("follows").insert({
        follower_id: user.id, following_id: targetId,
      });
    }
  };

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4">

      {/* ── Who to follow ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-sm font-bold text-gray-900 dark:text-white">
          Who to follow
        </p>

        {loadingUsers ? (
          /* Skeleton */
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
              <div className="h-7 w-16 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
            </div>
          ))
        ) : suggestedUsers.length === 0 ? (
          <p className="px-4 pb-3 text-xs text-gray-400 dark:text-gray-600">
            You're following everyone! 🎉
          </p>
        ) : (
          suggestedUsers.map(u => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Avatar */}
              <button
                onClick={() => navigate(`/user/${u.id}`)}
                className="shrink-0"
              >
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {u.name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
              </button>

              {/* Name + username */}
              <button
                onClick={() => navigate(`/user/${u.id}`)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                  {u.name}
                  {u.is_verified && (
                    <span className="ml-1 text-blue-500 text-xs">✓</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  @{u.username}
                </p>
              </button>

              {/* Follow button */}
              <button
                onClick={() => handleFollow(u.id)}
                className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
                  following.has(u.id)
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {following.has(u.id) ? "Following" : "Follow"}
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Trending ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-sm font-bold text-gray-900 dark:text-white">
          Trending
        </p>

        {loadingTrends ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-4 h-3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-2 w-12 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
            </div>
          ))
        ) : trendingTags.length === 0 ? (
          <p className="px-4 pb-3 text-xs text-gray-400 dark:text-gray-600">
            No trending topics yet
          </p>
        ) : (
          trendingTags.map((t, i) => (
            <button
              key={t.tag}
              onClick={() => navigate(`/feed/search?q=${encodeURIComponent("#" + t.tag)}`)}
              className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <span className="text-xs text-gray-400 dark:text-gray-600 w-4 text-right font-medium shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  #{t.tag}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t.posts_count.toLocaleString("en-IN")} posts
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <p className="text-[10px] text-gray-400 dark:text-gray-600 px-2 leading-relaxed">
        © 2026 Sphere · Privacy · Terms · Help
      </p>
    </div>
  );
}
