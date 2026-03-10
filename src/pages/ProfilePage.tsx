import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Settings, Edit3, Grid3X3, FileText, Bookmark, MapPin, Link2, Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { LivePost } from "../services/feedService";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"quotes" | "media" | "saves">("quotes");
  const [posts, setPosts]         = useState<LivePost[]>([]);
  const [saved, setSaved]         = useState<LivePost[]>([]);
  const [loading, setLoading]     = useState(true);

  /* Load user's posts */
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    supabase
      .from("posts")
      .select(`
        id, body, category, is_anon, created_at,
        likes_count, forwards_count, thoughts_count,
        is_forward, city, hashtags, user_id,
        profiles!posts_user_id_fkey (
          id, name, username, anon_username, avatar_url, is_verified, is_org
        ),
        post_media (url, media_type, position)
      `)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPosts(data as unknown as LivePost[]);
        setLoading(false);
      });
  }, [user?.id]);

  /* Load saved posts */
  useEffect(() => {
    if (activeTab !== "saves" || !user?.id) return;
    supabase
      .from("bookmarks")
      .select(`
        posts (
          id, body, category, is_anon, created_at,
          likes_count, forwards_count, thoughts_count,
          is_forward, city, hashtags, user_id,
          profiles!posts_user_id_fkey (
            id, name, username, anon_username, avatar_url, is_verified, is_org
          ),
          post_media (url, media_type, position)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSaved(data.map((b: Record<string, unknown>) => b.posts as unknown as LivePost).filter(Boolean));
      });
  }, [activeTab, user?.id]);

  if (!profile) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      </AppShell>
    );
  }

  const mediaPosts = posts.filter((p: LivePost) =>
    (p as unknown as Record<string, unknown[]>).post_media &&
    ((p as unknown as Record<string, unknown[]>).post_media as unknown[]).length > 0
  );

  const mapPost = (p: LivePost) => ({
    ...p,
    content: p.body || (p as unknown as Record<string, string>).body,
    timestamp: p.created_at
      ? (() => {
          const diff = Date.now() - new Date(p.created_at).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 1) return "just now";
          if (mins < 60) return `${mins}m ago`;
          const hrs = Math.floor(mins / 60);
          if (hrs < 24) return `${hrs}h ago`;
          return `${Math.floor(hrs / 24)}d ago`;
        })()
      : "",
    likes: p.likes_count || 0,
    reposts: p.forwards_count || 0,
    thoughts: p.thoughts_count || 0,
    user: {
      id: profile.id,
      name: profile.name,
      username: `@${profile.username}`,
      avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=1D4ED8&color=fff&size=80`,
      isVerified: profile.is_verified,
    },
  });

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">

        {/* Banner */}
        <div
          className="relative h-36 bg-gradient-to-r from-blue-500 to-blue-700 cursor-pointer group"
          onClick={() => navigate("/profile/edit")}
        >
          {profile.banner_url && (
            <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-sm font-semibold">Change Banner</span>
          </div>
        </div>

        {/* Avatar + actions */}
        <div className="px-4 relative -mt-10 flex items-end justify-between mb-3">
          <div className="relative cursor-pointer group" onClick={() => navigate("/profile/edit")}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600 ring-4 ring-white shadow-sm flex items-center justify-center">
                <span className="text-white text-3xl font-extrabold">
                  {profile.name?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Edit3 size={16} className="text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => navigate("/settings")}
              className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <Settings size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => navigate("/profile/edit")}
              className="px-4 py-2 border-2 border-gray-200 rounded-full text-sm font-bold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-extrabold text-gray-900">{profile.name}</h1>
            {profile.is_verified && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full text-[11px] text-white font-bold">
                ✓
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">@{profile.username}</p>

          {profile.bio && (
            <p className="text-gray-800 text-sm leading-relaxed mb-2">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-gray-400" />
                {profile.location}
              </span>
            )}
            {profile.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:underline"
              >
                <Link2 size={12} />
                {profile.website_label || profile.website_url}
              </a>
            )}
          </div>

          <div className="flex gap-4 text-sm">
            <button
              onClick={() => navigate("/profile/followers/me")}
              className="hover:underline"
            >
              <span className="font-bold text-gray-900">
                {(profile.followers_count || 0).toLocaleString()}
              </span>
              <span className="text-gray-500 ml-1">Followers</span>
            </button>
            <button
              onClick={() => navigate("/profile/followers/me")}
              className="hover:underline"
            >
              <span className="font-bold text-gray-900">
                {(profile.following_count || 0).toLocaleString()}
              </span>
              <span className="text-gray-500 ml-1">Following</span>
            </button>
            <span>
              <span className="font-bold text-gray-900">
                {(profile.posts_count || 0).toLocaleString()}
              </span>
              <span className="text-gray-500 ml-1">Quotes</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id: "quotes", label: "Quotes",  icon: FileText  },
            { id: "media",  label: "Media",   icon: Grid3X3   },
            { id: "saves",  label: "Saved",   icon: Bookmark  },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as "quotes" | "media" | "saves")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "quotes" && (
          <div>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-blue-400" />
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText size={40} className="mb-3 text-gray-200" />
                <p className="font-semibold text-gray-600 mb-1">No quotes yet</p>
                <p className="text-sm mb-4">Share your first thought with the world!</p>
                <button
                  onClick={() => navigate("/create-post")}
                  className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                  Create Quote
                </button>
              </div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={mapPost(p) as unknown as Parameters<typeof PostCard>[0]["post"]}
                  isLoggedIn={true}
                  isOwn={true}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "media" && (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {mediaPosts.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
                <Grid3X3 size={40} className="mb-3 text-gray-200" />
                <p className="text-sm font-medium">No media posts yet</p>
              </div>
            ) : (
              mediaPosts.map((p) => {
                const media = (p as unknown as Record<string, {url: string; media_type: string}[]>).post_media;
                const first = media?.[0];
                return first ? (
                  <div
                    key={p.id}
                    className="aspect-square bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => navigate(`/thoughts/${p.id}`)}
                  >
                    <img src={first.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null;
              })
            )}
          </div>
        )}

        {activeTab === "saves" && (
          <div>
            {saved.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Bookmark size={40} className="mb-3 text-gray-200" />
                <p className="font-semibold text-gray-600 mb-1">No saved quotes yet</p>
                <p className="text-sm">Bookmark quotes to find them here</p>
              </div>
            ) : (
              saved.map((p) => (
                <PostCard
                  key={p.id}
                  post={mapPost(p) as unknown as Parameters<typeof PostCard>[0]["post"]}
                  isLoggedIn={true}
                />
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
