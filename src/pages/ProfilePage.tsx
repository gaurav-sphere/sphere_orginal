import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Settings, Edit3, Grid3X3, FileText, Bookmark,
  MapPin, Link2, Loader2, Repeat2,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const POST_SELECT = `
  id, body, category, is_anon, created_at,
  likes_count, forwards_count, thoughts_count,
  is_forward, forward_of, forward_comment,
  city, hashtags, user_id, comments_off, is_pinned,
  profiles!posts_user_id_fkey (
    id, name, username, anon_username, avatar_url, is_verified, is_org
  ),
  post_media (url, media_type, width, height, position)
`;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildPost(row: any): any {
  const prof = row.profiles || {};
  const media = (row.post_media || []).sort((a: any, b: any) => a.position - b.position);
  const av = prof.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(prof.name||"U")}&background=1D4ED8&color=fff&size=80`;
  return {
    id: row.id, body: row.body, content: row.body,
    category: row.category || "top", is_anon: row.is_anon || false,
    created_at: row.created_at, timestamp: timeAgo(row.created_at),
    likes_count: row.likes_count||0, likes: row.likes_count||0,
    forwards_count: row.forwards_count||0, reposts: row.forwards_count||0,
    thoughts_count: row.thoughts_count||0, thoughts: row.thoughts_count||0,
    is_forward: row.is_forward||false, forward_of: row.forward_of||null,
    forward_comment: row.forward_comment||null, city: row.city,
    hashtags: row.hashtags||[], user_id: row.user_id,
    comments_off: row.comments_off||false, is_pinned: row.is_pinned||false,
    isLiked: false, isReposted: false,
    mediaItems: media.map((m: any) => ({ type: m.media_type, url: m.url, width: m.width, height: m.height })),
    user: {
      id: prof.id, name: prof.name||"Unknown",
      username: `@${prof.username||"user"}`, anon_username: `@${prof.anon_username||"anon"}`,
      avatar_url: av, avatar: av,
      is_verified: prof.is_verified||false, isVerified: prof.is_verified||false,
      is_org: prof.is_org||false,
    },
  };
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<"quotes"|"forwards"|"media"|"saves">("quotes");
  const [quotes,   setQuotes]   = useState<any[]>([]);
  const [forwards, setForwards] = useState<any[]>([]);
  const [saved,    setSaved]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fwdLoaded, setFwdLoaded] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    /* Redirect /profile → /profile/:username for canonical SEO URL */
    if (profile?.username) {
      window.history.replaceState({}, "", `/profile/${profile.username}`);
      /* SEO meta */
      document.title = `${profile.name} (@${profile.username}) · Sphere`;
      const setMeta = (prop: string, val: string, type: "name"|"property" = "name") => {
        let el = document.querySelector(`meta[${type}='${prop}']`) as HTMLMetaElement | null;
        if (!el) { el = document.createElement("meta"); el.setAttribute(type, prop); document.head.appendChild(el); }
        el.setAttribute("content", val);
      };
      setMeta("description", profile.bio ? `${profile.bio.slice(0,150)} · Sphere` : `${profile.name} on Sphere`);
      setMeta("og:title",       `${profile.name} (@${profile.username}) · Sphere`, "property");
      setMeta("og:description", profile.bio || `${profile.name} on Sphere`, "property");
      if (profile.avatar_url) setMeta("og:image", profile.avatar_url, "property");
      setMeta("og:url", window.location.href, "property");
      setMeta("og:type", "profile", "property");
    }

    supabase.from("posts").select(POST_SELECT)
      .eq("user_id", user.id).is("deleted_at", null)
      .eq("is_forward", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setQuotes(data.map(buildPost)); setLoading(false); });
  }, [user?.id]);

  const loadForwards = useCallback(async () => {
    if (!user?.id || fwdLoaded) return;
    const { data } = await supabase.from("posts").select(POST_SELECT)
      .eq("user_id", user.id).eq("is_forward", true).is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!data) { setFwdLoaded(true); return; }
    const origIds = data.filter(p => p.forward_of).map(p => p.forward_of as string);
    let origMap: Record<string, any> = {};
    if (origIds.length) {
      const { data: orig } = await supabase.from("posts").select(POST_SELECT).in("id", origIds).is("deleted_at", null);
      (orig||[]).forEach((r: any) => { origMap[r.id] = buildPost(r); });
    }
    setForwards(data.map(r => ({ ...buildPost(r), originalPost: origMap[r.forward_of]||null })));
    setFwdLoaded(true);
  }, [user?.id, fwdLoaded]);

  const loadSaved = useCallback(async () => {
    if (!user?.id || savedLoaded) return;
    const { data } = await supabase.from("bookmarks")
      .select(`posts ( ${POST_SELECT} )`)
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setSaved(data.map((b: any) => b.posts ? buildPost(b.posts) : null).filter(Boolean));
    setSavedLoaded(true);
  }, [user?.id, savedLoaded]);

  useEffect(() => { if (activeTab === "forwards") loadForwards(); }, [activeTab, loadForwards]);
  useEffect(() => { if (activeTab === "saves")    loadSaved();    }, [activeTab, loadSaved]);

  if (!profile) return (
    <AppShell><div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-blue-500"/></div></AppShell>
  );

  const mediaPosts = quotes.filter(p => p.mediaItems?.length > 0);

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-gray-950">

        {/* Banner */}
        <div className="relative h-36 bg-gradient-to-r from-blue-500 to-blue-700 cursor-pointer group"
          onClick={() => navigate("/profile/edit")}>
          {profile.banner_url && <img src={profile.banner_url} alt="" className="w-full h-full object-cover"/>}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-sm font-semibold">Change Banner</span>
          </div>
        </div>

        {/* Avatar + actions */}
        <div className="px-4 relative -mt-10 flex items-end justify-between mb-3">
          <div className="relative cursor-pointer group" onClick={() => navigate("/profile/edit")}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-gray-950 shadow-sm"/>
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600 ring-4 ring-white dark:ring-gray-950 shadow-sm flex items-center justify-center">
                <span className="text-white text-3xl font-extrabold">{profile.name?.[0]?.toUpperCase()||"U"}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Edit3 size={16} className="text-white"/>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => navigate("/settings")}
              className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Settings size={16} className="text-gray-600 dark:text-gray-400"/>
            </button>
            <button onClick={() => navigate("/profile/edit")}
              className="px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-full text-sm font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Edit Profile
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{profile.name}</h1>
            {profile.is_verified && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full text-[11px] text-white font-bold">✓</span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">@{profile.username}</p>
          {profile.bio && <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed mb-2">{profile.bio}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-3">
            {profile.location && <span className="flex items-center gap-1"><MapPin size={12} className="text-gray-400"/>{profile.location}</span>}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                <Link2 size={12}/>{profile.website_label||profile.website_url}
              </a>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <button onClick={() => navigate(`/profile/followers/${user?.id}`)} className="hover:underline">
              <span className="font-bold text-gray-900 dark:text-white">{(profile.followers_count||0).toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">Followers</span>
            </button>
            <button onClick={() => navigate(`/profile/followers/${user?.id}`)} className="hover:underline">
              <span className="font-bold text-gray-900 dark:text-white">{(profile.following_count||0).toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">Following</span>
            </button>
            <span>
              <span className="font-bold text-gray-900 dark:text-white">{(profile.posts_count||0).toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">Quotes</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {[
            { id:"quotes",   label:"Quotes",   Icon:FileText },
            { id:"forwards", label:"Forwards", Icon:Repeat2  },
            { id:"media",    label:"Media",    Icon:Grid3X3  },
            { id:"saves",    label:"Saved",    Icon:Bookmark },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-all ${
                activeTab===id ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>

        {/* QUOTES */}
        {activeTab==="quotes" && (
          loading
            ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-400"/></div>
            : quotes.length===0
            ? <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText size={40} className="mb-3 text-gray-200 dark:text-gray-700"/>
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No quotes yet</p>
                <p className="text-sm mb-4">Share your first thought with the world!</p>
                <button onClick={() => navigate("/create-post")} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700">Create Quote</button>
              </div>
            : quotes.map(p => <PostCard key={p.id} post={p} isLoggedIn={true} isOwn={true} currentUserId={user?.id}/>)
        )}

        {/* FORWARDS */}
        {activeTab==="forwards" && (
          forwards.length===0
            ? <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Repeat2 size={40} className="mb-3 text-gray-200 dark:text-gray-700"/>
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No forwards yet</p>
                <p className="text-sm">Quotes you forward will appear here</p>
              </div>
            : forwards.map(p => <PostCard key={p.id} post={p} isLoggedIn={true} isOwn={true} currentUserId={user?.id}/>)
        )}

        {/* MEDIA */}
        {activeTab==="media" && (
          mediaPosts.length===0
            ? <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Grid3X3 size={40} className="mb-3 text-gray-200 dark:text-gray-700"/>
                <p className="text-sm font-medium text-gray-500">No media posts yet</p>
              </div>
            : <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {mediaPosts.map(p => {
                  const first = p.mediaItems?.[0];
                  return first ? (
                    <div key={p.id} className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => navigate(`/quote/${p.id}`)}>
                      <img src={first.url} alt="" className="w-full h-full object-cover"/>
                    </div>
                  ) : null;
                })}
              </div>
        )}

        {/* SAVED */}
        {activeTab==="saves" && (
          saved.length===0
            ? <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Bookmark size={40} className="mb-3 text-gray-200 dark:text-gray-700"/>
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No saved quotes yet</p>
                <p className="text-sm">Bookmark quotes to find them here</p>
              </div>
            : saved.map(p => <PostCard key={p.id} post={p} isLoggedIn={true} currentUserId={user?.id}/>)
        )}
      </div>
    </AppShell>
  );
}
