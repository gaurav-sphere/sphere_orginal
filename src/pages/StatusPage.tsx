import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, X, Camera, Type, Send, Check,
  Pause, Play, Volume2, VolumeX, Scissors,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, uploadFile } from "../lib/supabase";

/* ─────────────────── Background Options ─────────────────────────────────── */
const BACKGROUNDS = [
  // No bg (transparent / black for media)
  { id: "none",    type: "none",     label: "None",     value: "#000000" },
  // Gradients
  { id: "g0",  type: "gradient", label: "Ocean",    from: "#1D4ED8", to: "#06B6D4" },
  { id: "g1",  type: "gradient", label: "Sunset",   from: "#F97316", to: "#EF4444" },
  { id: "g2",  type: "gradient", label: "Forest",   from: "#16A34A", to: "#059669" },
  { id: "g3",  type: "gradient", label: "Purple",   from: "#7C3AED", to: "#DB2777" },
  { id: "g4",  type: "gradient", label: "Gold",     from: "#D97706", to: "#F59E0B" },
  { id: "g5",  type: "gradient", label: "Midnight", from: "#1E1B4B", to: "#4338CA" },
  { id: "g6",  type: "gradient", label: "Rose",     from: "#BE185D", to: "#9333EA" },
  { id: "g7",  type: "gradient", label: "Teal",     from: "#0F766E", to: "#0D9488" },
  { id: "g8",  type: "gradient", label: "Fire",     from: "#B91C1C", to: "#D97706" },
  { id: "g9",  type: "gradient", label: "Sky",      from: "#0EA5E9", to: "#6366F1" },
  { id: "g10", type: "gradient", label: "Lime",     from: "#84CC16", to: "#10B981" },
  { id: "g11", type: "gradient", label: "Coral",    from: "#F43F5E", to: "#FB923C" },
  { id: "g12", type: "gradient", label: "Dawn",     from: "#FDA4AF", to: "#FDE68A" },
  { id: "g13", type: "gradient", label: "Dusk",     from: "#312E81", to: "#831843" },
  { id: "g14", type: "gradient", label: "Aurora",   from: "#34D399", to: "#818CF8" },
  // Solids
  { id: "s0",  type: "solid",    label: "Black",    value: "#111111" },
  { id: "s1",  type: "solid",    label: "White",    value: "#FFFFFF" },
  { id: "s2",  type: "solid",    label: "Red",      value: "#EF4444" },
  { id: "s3",  type: "solid",    label: "Blue",     value: "#2563EB" },
  { id: "s4",  type: "solid",    label: "Green",    value: "#16A34A" },
  { id: "s5",  type: "solid",    label: "Yellow",   value: "#F59E0B" },
  { id: "s6",  type: "solid",    label: "Pink",     value: "#EC4899" },
  { id: "s7",  type: "solid",    label: "Purple",   value: "#9333EA" },
  { id: "s8",  type: "solid",    label: "Orange",   value: "#EA580C" },
  { id: "s9",  type: "solid",    label: "Teal",     value: "#0F766E" },
];

interface BgOption { id: string; type: string; label: string; from?: string; to?: string; value?: string }

const DEFAULT_BG_IDX = 3; // Purple gradient

function getBgStyle(bg: BgOption): React.CSSProperties {
  if (bg.type === "none") return { background: "#000" };
  if (bg.type === "gradient") return { background: `linear-gradient(135deg, ${bg.from}, ${bg.to})` };
  return { background: bg.value };
}

function getBgGradIdx(bg: BgOption): number {
  if (bg.type !== "gradient") return 0;
  return BACKGROUNDS.filter(b => b.type === "gradient").findIndex(b => b.id === bg.id);
}

const MAX_STORIES = 10;
const MAX_STORY_DURATION = 60;
const MAX_TOTAL_DURATION = MAX_STORIES * MAX_STORY_DURATION;

/* ─────────────────────────── Story Data ────────────────────────────────── */
interface StoryData {
  id: string; user_id: string; story_type: string;
  text_body: string | null; media_url: string | null;
  gradient_idx: number; created_at: string;
  views_count?: number;
  profile: { id: string; name: string; username: string; avatar_url: string | null };
  items: StoryData[];
}

/* ═══════════════════════════ STORY VIEWER ══════════════════════════════════ */
function StoryViewer({ stories, startUserIdx, currentUserId, onClose }: {
  stories: StoryData[]; startUserIdx: number; currentUserId: string; onClose: () => void;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [userIdx, setUserIdx]   = useState(startUserIdx);
  const [itemIdx, setItemIdx]   = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused]     = useState(false);
  const [muted, setMuted]       = useState(true);
  const [reply, setReply]       = useState("");
  const [sent, setSent]         = useState(false);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const DURATION   = 5000;

  // Touch tracking — must NOT cause pull-to-refresh
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  /* ── Prevent ALL pull-to-refresh and scroll while viewer is open ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // non-passive so we can preventDefault
    const preventScroll = (e: TouchEvent) => { e.preventDefault(); };
    el.addEventListener("touchmove", preventScroll, { passive: false });
    // also prevent on document while viewer is mounted
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      el.removeEventListener("touchmove", preventScroll);
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    };
  }, []);

  const userStory  = stories[userIdx];
  const storyItems = userStory?.items?.length ? userStory.items : [userStory];
  const item       = storyItems[itemIdx] ?? userStory;

  /* Progress timer */
  useEffect(() => {
    setProgress(0);
    if (!item || paused) return;
    clearInterval(intervalRef.current);
    const dur = item.story_type === "video" ? DURATION * 12 : DURATION;
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current);
          advanceNext();
          return 0;
        }
        return p + (100 / (dur / 100));
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdx, itemIdx, paused, item?.id]);

  /* Mark viewed */
  useEffect(() => {
    if (!item?.id || !currentUserId) return;
    supabase.from("story_views")
      .upsert({ story_id: item.id, viewer_id: currentUserId, viewed_at: new Date().toISOString() },
               { onConflict: "story_id,viewer_id" })
      .then(() => {})
      .catch(() => {});
  }, [item?.id, currentUserId]);

  const advanceNext = useCallback(() => {
    if (itemIdx < storyItems.length - 1) { setItemIdx(i => i + 1); setProgress(0); }
    else if (userIdx < stories.length - 1) { setUserIdx(u => u + 1); setItemIdx(0); setProgress(0); }
    else { onClose(); }
  }, [userIdx, itemIdx, storyItems.length, stories.length, onClose]);

  const goBack = useCallback(() => {
    if (itemIdx > 0) { setItemIdx(i => i - 1); setProgress(0); }
    else if (userIdx > 0) { setUserIdx(u => u - 1); setItemIdx(0); setProgress(0); }
  }, [userIdx, itemIdx]);

  const handleSendReply = async () => {
    if (!reply.trim() || !item?.id) return;
    await supabase.from("notifications").insert({
      user_id: userStory.user_id, actor_id: currentUserId,
      type: "story_reply", text: reply.trim(),
    }).catch(() => {});
    setReply(""); setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  if (!userStory) return null;

  const isOwnStory = userStory.user_id === currentUserId;
  const bgStyle    = (() => {
    const gradients = BACKGROUNDS.filter(b => b.type === "gradient");
    const g = gradients[Math.abs(item?.gradient_idx ?? 0) % gradients.length];
    return getBgStyle(g ?? BACKGROUNDS[DEFAULT_BG_IDX]);
  })();

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[999] bg-black flex items-center justify-center"
      style={{ touchAction: "none" }}
      onTouchStart={e => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        // Horizontal swipe → change user story
        if (Math.abs(dx) > 60 && Math.abs(dy) < 80) {
          if (dx < 0 && userIdx < stories.length - 1) { setUserIdx(u => u + 1); setItemIdx(0); setProgress(0); }
          if (dx > 0 && userIdx > 0) { setUserIdx(u => u - 1); setItemIdx(0); setProgress(0); }
        }
        // Intentionally NO swipe-down-to-close (causes refresh confusion)
      }}
    >
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col overflow-hidden">

        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3">
          {storyItems.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
              <div className="h-full bg-white rounded transition-none"
                style={{ width: i < itemIdx ? "100%" : i === itemIdx ? `${progress}%` : "0%" }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-0 right-0 z-20 flex items-center justify-between px-3 pt-3">
          <button onClick={() => { clearInterval(intervalRef.current); navigate(`/user/${userStory.user_id}`); }}
            className="flex items-center gap-2">
            {userStory.profile.avatar_url
              ? <img src={userStory.profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/40" />
              : <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                  {userStory.profile.name?.[0]?.toUpperCase()}
                </div>
            }
            <div>
              <p className="text-white font-bold text-sm leading-tight">{userStory.profile.name}</p>
              <p className="text-white/60 text-xs">
                {new Date(item?.created_at ?? "").toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPaused(p => !p)}
              className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white">
              {paused ? <Play size={14} fill="white" /> : <Pause size={14} />}
            </button>
            <button onClick={() => { clearInterval(intervalRef.current); onClose(); }}
              className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main content — fills screen, no overflow */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={item?.story_type === "text" ? bgStyle : { background: "#000" }}>
          {item?.story_type === "text" && (
            <p className="text-white font-bold text-2xl text-center px-10 leading-relaxed"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
              {item.text_body}
            </p>
          )}
          {item?.story_type === "image" && item.media_url && (
            <>
              <img src={item.media_url} alt=""
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 pointer-events-none" />
              <img src={item.media_url} alt="" className="relative z-10 max-w-full max-h-full object-contain" />
            </>
          )}
          {item?.story_type === "video" && item.media_url && (
            <video ref={videoRef} src={item.media_url} muted={muted} autoPlay playsInline
              className="w-full h-full object-contain"
              onEnded={() => { clearInterval(intervalRef.current); advanceNext(); }} />
          )}
        </div>

        {/* Tap zones (above content, below header) */}
        <button className="absolute left-0 top-16 bottom-20 w-1/3 z-10" onClick={goBack} />
        <button className="absolute right-0 top-16 bottom-20 w-1/3 z-10" onClick={advanceNext} />

        {/* Video mute */}
        {item?.story_type === "video" && (
          <button onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }}
            className="absolute bottom-24 right-4 z-20 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white">
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        )}

        {/* Reply bar */}
        {!isOwnStory && (
          <div className="absolute bottom-5 left-0 right-0 px-4 flex items-center gap-2 z-20">
            <input type="text" value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendReply()}
              placeholder={`Reply to ${userStory.profile.name}…`}
              className="flex-1 bg-white/20 backdrop-blur-sm text-white placeholder-white/50 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30" />
            <button onClick={handleSendReply}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 shrink-0">
              {sent ? <Check size={16} className="text-green-300" /> : <Send size={16} />}
            </button>
          </div>
        )}

        {/* Views for own story */}
        {isOwnStory && (
          <div className="absolute bottom-5 left-4 z-20 flex items-center gap-1.5 text-white/70 text-xs">
            <span>👁</span><span>{item?.views_count ?? 0} views</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ TEXT OVERLAY (Instagram-style) ═════════════════════ */
interface TextOverlay {
  text: string; x: number; y: number;
  fontSize: number; color: string; bold: boolean; align: "left"|"center"|"right";
  rotation: number;
}

function TextOverlayEditor({
  overlay, onChange, onDelete, screenW, screenH,
}: {
  overlay: TextOverlay; onChange: (o: TextOverlay) => void;
  onDelete: () => void; screenW: number; screenH: number;
}) {
  const [editing, setEditing] = useState(true);
  const dragging    = useRef(false);
  const pinching    = useRef(false);
  const dragStartX  = useRef(0);
  const dragStartY  = useRef(0);
  const posStartX   = useRef(overlay.x);
  const posStartY   = useRef(overlay.y);
  const pinchDist0  = useRef(0);
  const fontSize0   = useRef(overlay.fontSize);
  const inputRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const getPinchDist = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const textStyle: React.CSSProperties = {
    position: "absolute", left: `${overlay.x}%`, top: `${overlay.y}%`,
    transform: `translate(-50%,-50%) rotate(${overlay.rotation}deg)`,
    fontSize: overlay.fontSize, color: overlay.color,
    fontWeight: overlay.bold ? "bold" : "normal",
    textAlign: overlay.align, textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    maxWidth: "80vw", whiteSpace: "pre-wrap", wordBreak: "break-word",
    cursor: "grab", userSelect: "none", zIndex: 50, touchAction: "none",
  };

  return (
    <div style={textStyle}
      onTouchStart={e => {
        e.stopPropagation();
        if (e.touches.length === 2) {
          pinching.current = true; dragging.current = false;
          pinchDist0.current = getPinchDist(e.touches);
          fontSize0.current = overlay.fontSize;
        } else {
          dragging.current = true; pinching.current = false;
          dragStartX.current = e.touches[0].clientX;
          dragStartY.current = e.touches[0].clientY;
          posStartX.current = overlay.x; posStartY.current = overlay.y;
          setEditing(false);
        }
      }}
      onTouchMove={e => {
        e.stopPropagation(); e.preventDefault();
        if (pinching.current && e.touches.length === 2) {
          const dist = getPinchDist(e.touches);
          const scale = dist / pinchDist0.current;
          onChange({ ...overlay, fontSize: Math.min(80, Math.max(12, Math.round(fontSize0.current * scale))) });
        } else if (dragging.current && e.touches.length === 1) {
          const dx = ((e.touches[0].clientX - dragStartX.current) / screenW) * 100;
          const dy = ((e.touches[0].clientY - dragStartY.current) / screenH) * 100;
          onChange({ ...overlay, x: posStartX.current + dx, y: posStartY.current + dy });
        }
      }}
      onTouchEnd={e => { e.stopPropagation(); dragging.current = false; pinching.current = false; }}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <textarea
          ref={inputRef}
          value={overlay.text}
          onChange={e => onChange({ ...overlay, text: e.target.value })}
          onBlur={() => setEditing(false)}
          onClick={e => e.stopPropagation()}
          className="bg-transparent outline-none resize-none text-center w-full"
          style={{ fontSize: overlay.fontSize, color: overlay.color, fontWeight: overlay.bold?"bold":"normal", textShadow: "0 2px 8px rgba(0,0,0,0.5)", minWidth: 120, touchAction: "none" }}
          rows={3}
        />
      ) : (
        <span>{overlay.text || "Tap to edit"}</span>
      )}
    </div>
  );
}

/* ═══════════════════════ BACKGROUND PICKER ═════════════════════════════════ */
function BgPicker({ selected, onSelect }: { selected: BgOption; onSelect: (b: BgOption) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2 pt-1" style={{touchAction:"pan-x"}} onClick={e=>e.stopPropagation()}>
      {BACKGROUNDS.map(bg => {
        const isSelected = bg.id === selected.id;
        return (
          <button key={bg.id} onClick={() => onSelect(bg)}
            className="shrink-0 flex flex-col items-center gap-1">
            <div
              className="rounded-full transition-all"
              style={{
                width: 36, height: 36,
                ...(bg.type === "none"
                  ? { border: "2px dashed rgba(255,255,255,0.5)", background: "transparent" }
                  : bg.type === "gradient"
                    ? { background: `linear-gradient(135deg,${bg.from},${bg.to})` }
                    : { background: bg.value, border: bg.value === "#FFFFFF" ? "1px solid rgba(255,255,255,0.3)" : "none" }
                ),
                boxShadow: isSelected ? "0 0 0 2.5px white" : "none",
                transform: isSelected ? "scale(1.2)" : "scale(1)",
              }}
            >
              {bg.type === "none" && <span className="text-white/60 text-lg leading-none flex items-center justify-center h-full">∅</span>}
            </div>
            <span className="text-white/50 text-[8px] font-medium">{bg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════ CREATE STORY PAGE ═════════════════════════════════ */
export function StatusPage() {
  const navigate   = useNavigate();
  const { userId } = useParams();
  const { user, profile } = useAuth();
  const pageRef    = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  /* ── Viewer state ── */
  const [viewerStories, setViewerStories]   = useState<StoryData[]>([]);
  const [viewerStartIdx, setViewerStartIdx] = useState<number | null>(null);

  /* ── Create state ── */
  const [mode, setMode]           = useState<"pick"|"text"|"media">("pick");
  const [selectedBg, setSelectedBg] = useState<BgOption>(BACKGROUNDS[DEFAULT_BG_IDX]);
  const [overlays, setOverlays]   = useState<TextOverlay[]>([]);
  const [activeOverlayIdx, setActiveOverlayIdx] = useState<number | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl]   = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image"|"video"|null>(null);
  const [videoSegments, setVideoSegments] = useState(1);
  const [posting, setPosting]     = useState(false);
  const [posted, setPosted]       = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 375, h: 667 });

  /* ── Prevent page scroll & pull-to-refresh ── */
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", prevent, { passive: false });
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      el.removeEventListener("touchmove", prevent);
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    };
  }, []);

  /* Measure canvas for drag */
  useEffect(() => {
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    setCanvasSize({ w: r.width, h: r.height });
  }, [mode]);

  /* Load stories */
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data: followData } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      const ids = [user.id, ...(followData || []).map((r: any) => r.following_id)];

      const { data: storiesData } = await supabase
        .from("stories")
        .select("id,user_id,story_type,text_body,media_url,gradient_idx,created_at,views_count")
        .in("user_id", ids)
        .gt("expires_at", new Date().toISOString())
        .order("user_id").order("created_at");

      if (!storiesData?.length) { if (userId) navigate("/feed"); return; }

      const userIds = [...new Set(storiesData.map((s: any) => s.user_id))];
      const { data: profilesData } = await supabase.from("profiles").select("id,name,username,avatar_url").in("id", userIds);
      const pmap: Record<string, any> = {};
      (profilesData || []).forEach((p: any) => { pmap[p.id] = p; });

      const grouped: Record<string, any[]> = {};
      storiesData.forEach((s: any) => { if (!grouped[s.user_id]) grouped[s.user_id] = []; grouped[s.user_id].push(s); });

      const result: StoryData[] = userIds.map(uid => {
        const items = grouped[uid] || [];
        const prof  = pmap[uid] || { id: uid, name: "User", username: "user", avatar_url: null };
        return {
          ...items[0], profile: prof,
          items: items.map((s: any) => ({ ...s, profile: prof, items: [] })),
        };
      });

      setViewerStories(result);
      if (userId) {
        const idx = result.findIndex(s => s.user_id === userId);
        setViewerStartIdx(idx >= 0 ? idx : 0);
      }
    };
    load();
  }, [user?.id, userId]);

  /* File handler */
  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      setMediaType("image"); setMediaUrl(URL.createObjectURL(file));
      setMediaFile(file); setMode("media");
    } else if (file.type.startsWith("video/")) {
      const vid = document.createElement("video");
      const url = URL.createObjectURL(file);
      vid.preload = "metadata";
      vid.onloadedmetadata = () => {
        if (vid.duration > MAX_TOTAL_DURATION) {
          alert(`Video too long (${Math.round(vid.duration/60)}m). Max ${MAX_STORIES} minutes.`);
          URL.revokeObjectURL(url); return;
        }
        setVideoSegments(Math.ceil(vid.duration / MAX_STORY_DURATION));
        setMediaType("video"); setMediaUrl(url); setMediaFile(file); setMode("media");
      };
      vid.src = url;
    }
  };

  /* Add text overlay when tapping canvas */
  const handleCanvasTap = (e: React.MouseEvent) => {
    if (mode !== "text") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newOverlay: TextOverlay = {
      text: "", x, y, fontSize: 28, color: "#FFFFFF",
      bold: true, align: "center", rotation: 0,
    };
    setOverlays(ov => [...ov, newOverlay]);
    setActiveOverlayIdx(overlays.length);
  };

  /* Post story */
  const handlePost = async () => {
    if (!user?.id) { navigate("/login"); return; }
    if (mode === "text" && overlays.every(o => !o.text.trim())) return;
    setPosting(true);
    try {
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const textBody = overlays.map(o => o.text).join("\n") || null;
      const gradIdx  = BACKGROUNDS.filter(b => b.type === "gradient").findIndex(b => b.id === selectedBg.id);

      if (mode === "text") {
        await supabase.from("stories").insert({
          user_id: user.id, story_type: "text", text_body: textBody,
          gradient_idx: gradIdx >= 0 ? gradIdx : 0, expires_at: expires,
        });
      } else if (mode === "media" && mediaFile) {
        const pubUrl = await uploadFile("stories", user.id, mediaFile);
        const inserts = Array.from({ length: videoSegments }, (_, i) => ({
          user_id: user.id, story_type: mediaType, media_url: pubUrl,
          text_body: videoSegments > 1 ? JSON.stringify({ caption: textBody, seg: i, total: videoSegments, offset: i * 60 }) : textBody,
          gradient_idx: gradIdx >= 0 ? gradIdx : 0, expires_at: expires,
        }));
        await supabase.from("stories").insert(inserts);
      }
      setPosted(true);
      setTimeout(() => navigate("/feed"), 800);
    } catch { setPosting(false); }
  };

  const bgStyle = getBgStyle(selectedBg);
  const activeOverlay = activeOverlayIdx !== null ? overlays[activeOverlayIdx] : null;

  /* ── Viewer mode ── */
  if (viewerStartIdx !== null && viewerStories.length > 0 && user?.id) {
    return (
      <StoryViewer
        stories={viewerStories} startUserIdx={viewerStartIdx}
        currentUserId={user.id}
        onClose={() => { setViewerStartIdx(null); if (userId) navigate("/feed"); }}
      />
    );
  }

  /* ── CREATE MODE ── */
  return (
    <div ref={pageRef} className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden"
      style={{ touchAction: "none" }}>

      {/* ────────── PICK mode ────────── */}
      {mode === "pick" && (
        <div className="flex flex-col h-full" style={bgStyle}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 bg-black/20 shrink-0">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white">
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-bold text-white flex-1 text-base">Create Story</h1>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
            <div className="w-[105px] h-[105px] rounded-full mb-4 ring-4 ring-white/30 overflow-hidden shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-white/20 flex items-center justify-center text-white font-bold text-4xl">
                    {profile?.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
              }
            </div>
            <p className="text-white font-bold text-xl mb-1">{profile?.name}</p>
            <p className="text-white/60 text-sm text-center">Tap a style below or pick Text / Photo</p>
          </div>

          {/* Background picker */}
          <div className="shrink-0">
            <BgPicker selected={selectedBg} onSelect={setSelectedBg} />
          </div>

          {/* Action buttons */}
          <div className="shrink-0 px-4 pb-8 pt-3 flex gap-3">
            <button onClick={() => setMode("text")}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/20 backdrop-blur-sm rounded-2xl text-white font-bold hover:bg-white/30 transition-colors">
              <Type size={20} /> Add Text
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/20 backdrop-blur-sm rounded-2xl text-white font-bold hover:bg-white/30 transition-colors">
              <Camera size={20} /> Photo / Video
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {/* ────────── TEXT mode ────────── */}
      {mode === "text" && (
        <div className="flex flex-col h-full">
          {/* Top controls — minimal: back + share only */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm z-30">
            <button onClick={() => setMode("pick")}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
              <ArrowLeft size={20} />
            </button>
            <p className="text-white/50 text-xs">Tap canvas to add text · Pinch to resize · Drag to move</p>
            {overlays.some(o => o.text.trim()) && (
              <button onClick={handlePost} disabled={posting||posted}
                className="px-4 py-2 bg-white text-gray-900 rounded-full font-bold text-sm disabled:opacity-60">
                {posted ? "✓ Shared!" : posting ? "…" : "Share"}
              </button>
            )}
          </div>

          {/* Canvas — tap to add text */}
          <div ref={canvasRef} className="flex-1 relative overflow-hidden cursor-crosshair"
            style={bgStyle} onClick={handleCanvasTap}>
            {overlays.map((ov, i) => (
              <TextOverlayEditor
                key={i} overlay={ov}
                onChange={updated => setOverlays(ol => ol.map((o,j) => j===i ? updated : o))}
                onDelete={() => { setOverlays(ol => ol.filter((_,j) => j!==i)); setActiveOverlayIdx(null); }}
                screenW={canvasSize.w} screenH={canvasSize.h}
              />
            ))}
            {overlays.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-white/40 text-lg font-semibold">Tap anywhere to add text</p>
              </div>
            )}
          </div>

          {/* Background picker */}
          <div className="shrink-0 bg-black/60 backdrop-blur-sm py-2">
            <BgPicker selected={selectedBg} onSelect={setSelectedBg} />
          </div>
        </div>
      )}

      {/* ────────── MEDIA mode ────────── */}
      {mode === "media" && mediaUrl && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black">
            <button onClick={() => { setMode("pick"); setMediaUrl(null); setMediaFile(null); setOverlays([]); }}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
              <ArrowLeft size={20} />
            </button>
            {videoSegments > 1 && (
              <div className="flex items-center gap-1.5 bg-orange-500/20 rounded-full px-3 py-1">
                <Scissors size={11} className="text-orange-400" />
                <span className="text-orange-300 text-xs font-bold">{videoSegments} stories × 1 min</span>
              </div>
            )}
            <button onClick={handlePost} disabled={posting||posted}
              className="px-5 py-2 bg-blue-600 text-white rounded-full font-bold text-sm disabled:opacity-60">
              {posted ? "✓ Shared!" : posting ? "Uploading…" : "Share"}
            </button>
          </div>

          {/* Media canvas — tap to add text overlay */}
          <div ref={canvasRef} className="flex-1 relative overflow-hidden cursor-crosshair"
            style={{ background: selectedBg.type !== "none" ? getBgStyle(selectedBg).background : "#000" }}
            onClick={handleCanvasTap}>
            {/* Blurred bg */}
            {mediaType === "image" && <img src={mediaUrl} aria-hidden alt=""
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 pointer-events-none" />}
            {/* Media */}
            {mediaType === "image"
              ? <img src={mediaUrl} alt="" className="relative z-10 w-full h-full object-contain" />
              : <video src={mediaUrl} controls autoPlay muted playsInline className="relative z-10 w-full h-full object-contain" />
            }
            {/* Text overlays */}
            {overlays.map((ov, i) => (
              <TextOverlayEditor key={i} overlay={ov}
                onChange={updated => setOverlays(ol => ol.map((o,j) => j===i ? updated : o))}
                onDelete={() => { setOverlays(ol => ol.filter((_,j) => j!==i)); setActiveOverlayIdx(null); }}
                screenW={canvasSize.w} screenH={canvasSize.h} />
            ))}
            {overlays.length === 0 && (
              <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none">
                <span className="bg-black/40 text-white/60 text-xs px-3 py-1 rounded-full">Tap to add text</span>
              </div>
            )}
          </div>

          {/* Background tint picker */}
          <div className="shrink-0 bg-black py-2">
            <BgPicker selected={selectedBg} onSelect={setSelectedBg} />
          </div>
        </div>
      )}

    </div>
  );
}
