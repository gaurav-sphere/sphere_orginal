import React, { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Repeat2, MessageCircle, ThumbsUp, MoreHorizontal,
  Bookmark, Link2, Share2, X, Shield, UserPlus, Check,
  ChevronLeft, ChevronRight, Play, Volume2, VolumeX, Maximize2, Pause,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { togglePraise, toggleForward, toggleBookmark } from "../services/feedService";

interface MediaItem {
  type: "image" | "video";
  url: string;
  poster?: string;
}

interface PostCardProps {
  post: any;
  isLoggedIn?: boolean;
}

// Rounded button used for all video/image overlay controls
function CtrlBtn({
  onClick, children, className = "",
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white
        hover:bg-blue-600 active:bg-blue-700 transition-colors duration-150 ${className}`}
    >
      {children}
    </button>
  );
}

export function PostCard({ post, isLoggedIn = false }: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id;

  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [reposted, setReposted] = useState(post.isReposted ?? false);
  const [likeCount, setLikeCount] = useState(post.likes ?? 0);
  const [repostCount, setRepostCount] = useState(post.reposts ?? 0);
  const [showMenu, setShowMenu] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followAnim, setFollowAnim] = useState(false);

  // Media slider
  const [mediaIdx, setMediaIdx] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [touchStartX, setTouchStartX] = useState(0);
  const [slideAspects, setSlideAspects] = useState<Record<number, number>>({});
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const outerRef = useRef<HTMLDivElement>(null);

  // Load real follow state from DB on mount
  useEffect(() => {
    if (!uid || !post.user?.id || post.isAnonymous) return;
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", uid)
      .eq("following_id", post.user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setFollowing(true); });
  }, [uid, post.user?.id]);

  // Unified media array
  const allMedia: MediaItem[] = useMemo(() => {
    if (post.mediaItems?.length > 0) return post.mediaItems;
    const items: MediaItem[] = [];
    if (post.images) post.images.forEach((url: string) => items.push({ type: "image", url }));
    else if (post.image) items.push({ type: "image", url: post.image });
    if (post.video) items.push({ type: "video", url: post.video, poster: post.videoPoster || post.image || undefined });
    return items;
  }, [post]);

  // Consistent container height = tallest slide across all loaded items
  const containerHeight = useMemo(() => {
    const cw = outerRef.current?.offsetWidth || 360;
    const heights = Object.values(slideAspects).map(
      (a) => Math.min(Math.max(Math.round(cw / a), 160), 520)
    );
    return heights.length > 0 ? Math.max(...heights) : 300;
  }, [slideAspects]);

  // Pause non-active videos when slide changes
  useEffect(() => {
    videoRefs.current.forEach((v, i) => { if (v && i !== mediaIdx) v.pause(); });
    setVideoPlaying(false);
  }, [mediaIdx]);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>, idx: number) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    if (nw && nh) setSlideAspects((prev) => ({ ...prev, [idx]: nw / nh }));
  };
  const handleVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>, idx: number) => {
    const { videoWidth: vw, videoHeight: vh } = e.currentTarget;
    if (vw && vh) setSlideAspects((prev) => ({ ...prev, [idx]: vw / vh }));
  };

  const handleSwipeStart = (e: React.TouchEvent) => setTouchStartX(e.targetTouches[0].clientX);
  const handleSwipeEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 40) return;
    if (diff > 0 && mediaIdx < allMedia.length - 1) setMediaIdx((p) => p + 1);
    else if (diff < 0 && mediaIdx > 0) setMediaIdx((p) => p - 1);
  };

  const togglePlay = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const v = videoRefs.current[idx];
    if (!v) return;
    if (videoPlaying) v.pause(); else v.play();
  };
  const toggleMute = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const v = videoRefs.current[idx];
    if (!v) return;
    v.muted = !videoMuted;
    setVideoMuted(!videoMuted);
  };
  const openVideoFullscreen = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const v = videoRefs.current[idx];
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    else if ((v as any).webkitEnterFullscreen) (v as any).webkitEnterFullscreen();
    else if ((v as any).webkitRequestFullscreen) (v as any).webkitRequestFullscreen();
  };

  const requireLogin = (fn: () => void) => {
    if (!isLoggedIn) { navigate("/login"); return; }
    fn();
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireLogin(() => { if (!post.isAnonymous && post.user?.id) navigate(`/user/${post.user.id}`); });
  };

  // @mention click — look up profile by username from DB
  const handleMentionClick = async (e: React.MouseEvent, raw: string) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    const username = raw.replace(/^@/, "").toLowerCase();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (data?.id) navigate(`/user/${data.id}`);
  };

  // Praise — optimistic update + DB write
  const handlePraise = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireLogin(() => {
      const next = !liked;
      setLiked(next);
      setLikeCount((c: number) => next ? c + 1 : Math.max(0, c - 1));
      if (uid) togglePraise(post.id, uid, liked).catch(() => {
        // rollback on error
        setLiked(!next);
        setLikeCount((c: number) => !next ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  // Forward — optimistic update + DB write
  const handleForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireLogin(() => {
      const next = !reposted;
      setReposted(next);
      setRepostCount((c: number) => next ? c + 1 : Math.max(0, c - 1));
      if (uid) toggleForward(post.id, uid, reposted).catch(() => {
        setReposted(!next);
        setRepostCount((c: number) => !next ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  // Bookmark — optimistic + DB write
  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireLogin(() => {
      const next = !saved;
      setSaved(next);
      if (uid) toggleBookmark(post.id, uid, saved).catch(() => setSaved(!next));
    });
  };

  // Follow — write to follows table
  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn || !uid || !post.user?.id) { navigate("/login"); return; }
    if (!following) {
      setFollowing(true);
      setFollowAnim(true);
      setTimeout(() => setFollowAnim(false), 1800);
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: uid, following_id: post.user.id });
      if (error) setFollowing(false);
    } else {
      setFollowing(false);
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", uid)
        .eq("following_id", post.user.id);
    }
  };

  const formatCount = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n ?? 0);

  return (
    <>
      <div
        className="bg-white border-b border-gray-100 px-4 py-3 relative cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => navigate(`/thoughts/${post.id}`)}
      >
        {followAnim && (
          <div className="absolute top-3 right-12 z-20 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none"
            style={{ animation: "followPop 1.8s ease-out forwards" }}>
            <Check size={12} /> Following!
          </div>
        )}
        <style>{`@keyframes followPop{0%{opacity:0;transform:translateY(8px) scale(.8)}20%{opacity:1;transform:translateY(0) scale(1.05)}60%{opacity:1}100%{opacity:0;transform:translateY(-12px) scale(.9)}}`}</style>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0" onClick={handleNameClick}>
            {post.isAnonymous || !post.user?.avatar ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                <Shield size={18} className="text-white" />
              </div>
            ) : (
              <img src={post.user.avatar} alt={post.user.name} className="w-10 h-10 rounded-full object-cover" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <button onClick={handleNameClick} className="font-semibold text-gray-900 text-sm hover:underline">
                  {post.isAnonymous ? "Anonymous" : post.user?.name}
                </button>
                {post.user?.isVerified && !post.isAnonymous && <span className="text-blue-500 text-xs">✓</span>}
                <button onClick={handleNameClick} className="text-gray-400 text-xs hover:underline">{post.user?.username}</button>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-gray-400 text-xs">{post.timestamp}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                {!post.isAnonymous && isLoggedIn && (
                  <button
                    onClick={handleFollow}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${following ? "text-green-600 bg-green-50" : "text-blue-600 hover:bg-blue-50"}`}
                  >
                    {following ? <Check size={11} /> : <UserPlus size={11} />}
                    <span>{following ? "Following" : "Follow"}</span>
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>

            <p className="text-gray-800 text-sm mt-1 leading-relaxed break-words">
              {post.content.split(/(\s+)/).map((token: string, i: number) => {
                const c = token.trim();
                if (c.startsWith("#")) return (
                  <span key={i}
                    onClick={(e) => { e.stopPropagation(); if (isLoggedIn) navigate(`/feed/search?q=${encodeURIComponent(c)}`); else navigate(`/search?q=${encodeURIComponent(c)}`); }}
                    className="text-blue-500 cursor-pointer">{token}</span>
                );
                if (c.startsWith("@") && c.length > 1) return (
                  <span key={i}
                    onClick={(e) => handleMentionClick(e, c)}
                    className="text-blue-500 cursor-pointer font-medium">{token}</span>
                );
                return token;
              })}
            </p>

            {/* ── Consistent-height Media Slider ── */}
            {allMedia.length > 0 && (
              <div
                ref={outerRef}
                className="mt-2 rounded-xl overflow-hidden relative select-none"
                style={{ height: `${containerHeight}px` }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleSwipeStart}
                onTouchEnd={handleSwipeEnd}
              >
                {allMedia.map((item, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 w-full h-full"
                    style={{
                      transform: `translateX(${(i - mediaIdx) * 100}%)`,
                      transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                      willChange: "transform",
                    }}
                  >
                    {item.type === "image" ? (
                      <div className="relative w-full h-full overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/thoughts/${post.id}?fs=${i}`); }}>
                        {/* Blurred cinematic background */}
                        <img src={item.url} aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110"
                          style={{ filter: "blur(22px) brightness(0.35) saturate(1.8)" }} draggable={false} />
                        {/* Main image: contained so full image is always visible */}
                        <img src={item.url} alt="post media"
                          className="relative z-10 w-full h-full object-contain"
                          onLoad={(e) => handleImgLoad(e, i)}
                          draggable={false} />
                      </div>
                    ) : (
                      <div className="relative w-full h-full overflow-hidden bg-black">
                        {/* Blurred poster background */}
                        {item.poster && (
                          <img src={item.poster} aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110"
                            style={{ filter: "blur(22px) brightness(0.3) saturate(1.8)" }} />
                        )}
                        <video
                          ref={(el) => {
                            videoRefs.current[i] = el;
                            if (el) {
                              (el as any).disableRemotePlayback = true;
                              el.setAttribute("x-webkit-airplay", "deny");
                            }
                          }}
                          src={item.url}
                          poster={item.poster}
                          muted={videoMuted}
                          loop
                          playsInline
                          className="relative z-10 w-full h-full object-contain"
                          onLoadedMetadata={(e) => handleVideoMeta(e, i)}
                          onPlay={() => i === mediaIdx && setVideoPlaying(true)}
                          onPause={() => i === mediaIdx && setVideoPlaying(false)}
                        />
                        {i === mediaIdx && (
                          <>
                            {!videoPlaying && (
                              <div className="absolute inset-0 z-20 flex items-center justify-center" onClick={(e) => togglePlay(e, i)}>
                                <button className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 transition-colors">
                                  <Play size={24} className="text-white ml-1" fill="white" />
                                </button>
                              </div>
                            )}
                            <div className="absolute bottom-2 right-2 z-20 flex gap-1.5">
                              {videoPlaying && (
                                <CtrlBtn onClick={(e) => togglePlay(e, i)}><Pause size={13} fill="white" /></CtrlBtn>
                              )}
                              <CtrlBtn onClick={(e) => toggleMute(e, i)}>
                                {videoMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                              </CtrlBtn>
                              <CtrlBtn onClick={(e) => openVideoFullscreen(e, i)}>
                                <Maximize2 size={12} />
                              </CtrlBtn>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Arrows */}
                {allMedia.length > 1 && mediaIdx > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setMediaIdx((p) => p - 1); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 transition-colors z-20">
                    <ChevronLeft size={16} />
                  </button>
                )}
                {allMedia.length > 1 && mediaIdx < allMedia.length - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); setMediaIdx((p) => p + 1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 transition-colors z-20">
                    <ChevronRight size={16} />
                  </button>
                )}

                {/* Dots */}
                {allMedia.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                    {allMedia.map((_, i) => (
                      <button key={i} onClick={(e) => { e.stopPropagation(); setMediaIdx(i); }}
                        className={`rounded-full transition-all duration-200 ${i === mediaIdx ? "bg-white w-4 h-1.5" : "bg-white/60 w-1.5 h-1.5 hover:bg-white/80"}`} />
                    ))}
                  </div>
                )}

                {/* Counter */}
                {allMedia.length > 1 && (
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                    {allMedia[mediaIdx]?.type === "video" && <span className="bg-black/40 text-white text-[9px] px-1.5 py-0.5 rounded-full">🎬</span>}
                    <span className="bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">{mediaIdx + 1}/{allMedia.length}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {!post.commentsOff && (
              <div className="flex items-center gap-4 mt-3">
                <button onClick={(e) => { e.stopPropagation(); navigate(`/thoughts/${post.id}`); }} className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                  <MessageCircle size={17} /><span className="text-xs">{formatCount(post.thoughts ?? 0)}</span>
                </button>
                <button onClick={handleForward}
                  className={`flex items-center gap-1.5 transition-colors ${reposted ? "text-green-500" : "text-gray-400 hover:text-green-500"}`}>
                  <Repeat2 size={17} /><span className="text-xs">{formatCount(repostCount)}</span>
                </button>
                <button onClick={handlePraise}
                  className={`flex items-center gap-1.5 transition-colors ${liked ? "text-orange-500" : "text-gray-400 hover:text-orange-500"}`}>
                  <ThumbsUp size={17} className={liked ? "fill-orange-500" : ""} /><span className="text-xs">{formatCount(likeCount)}</span>
                </button>
                <button onClick={handleBookmark}
                  className={`ml-auto transition-colors ${saved ? "text-blue-600" : "text-gray-400 hover:text-blue-500"}`}>
                  <Bookmark size={17} className={saved ? "fill-blue-600" : ""} />
                </button>
              </div>
            )}
          </div>
        </div>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-4 top-10 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-44">
              <button className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(`${window.location.origin}/thoughts/${post.id}`); setShowMenu(false); }}>
                <Link2 size={15} /> Copy link
              </button>
              <button className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={(e) => { e.stopPropagation(); navigator.share?.({ url: `${window.location.origin}/thoughts/${post.id}` }).catch(() => {}); setShowMenu(false); }}>
                <Share2 size={15} /> Share
              </button>
              <div className="h-px bg-gray-100" />
              <button className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50"
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}>
                <X size={15} /> Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
