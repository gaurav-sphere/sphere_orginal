import React, {
  useState, useRef, useEffect, useCallback,
} from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Search, Send, MoreHorizontal, ImagePlus,
  Check, CheckCheck, X, Reply, Trash2, Settings,
  Loader2, MessageSquare, SmilePlus,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
interface OtherUser {
  id:         string;
  name:       string;
  username:   string;
  avatar_url: string | null;
}

interface Conversation {
  id:               string;
  other:            OtherUser;
  last_message:     string | null;
  last_message_at:  string | null;
  unread:           number;          // unread count for ME
  is_own_last:      boolean;         // did I send the last message?
  am_p1:            boolean;         // am I participant_1?
  cleared_at:       string | null;   // when I cleared this chat
}

interface Message {
  id:              string;
  sender_id:       string;
  body:            string;
  media_url:       string | null;
  media_type:      string | null;
  is_read:         boolean;
  created_at:      string;
  deleted_at:      string | null;
  reply_to:        string | null;
  reply_preview?:  string | null;    // body of the replied message
  reactions:       Record<string, string[]>; // emoji → userIds
}

/* ── 6 quick-reactions ── */
const QUICK_REACTIONS = ["❤️","😂","😮","😢","👍","🔥"];

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function timeAgo(iso: string): string {
  const d    = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(d / 60000);
  if (mins < 1)  return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day:"numeric", month:"short" });
}

function fullTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour:"numeric", minute:"2-digit", hour12:true });
}

/* ══════════════════════════════════════════════════════════════
   AVATAR with fallback
══════════════════════════════════════════════════════════════ */
function Avatar({ src, name, size = 40, online = false }: {
  src?: string|null; name: string; size?: number; online?: boolean;
}) {
  const [err, setErr] = useState(false);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src && !err ? (
        <img src={src} alt={name} onError={() => setErr(true)}
          className="rounded-full object-cover w-full h-full" />
      ) : (
        <div className="rounded-full bg-blue-600 flex items-center justify-center w-full h-full text-white font-bold"
          style={{ fontSize: size * 0.4 }}>
          {name[0]?.toUpperCase() || "U"}
        </div>
      )}
      {online && (
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REACTION PICKER
══════════════════════════════════════════════════════════════ */
function ReactionPicker({ onPick, onClose }: { onPick:(e:string)=>void; onClose:()=>void }) {
  return (
    <div className="absolute bottom-8 left-0 z-50 flex gap-1 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 px-2 py-1.5">
      {QUICK_REACTIONS.map(e => (
        <button key={e} onClick={() => { onPick(e); onClose(); }}
          className="text-xl hover:scale-125 transition-transform p-1 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">
          {e}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MESSAGE BUBBLE
══════════════════════════════════════════════════════════════ */
function MessageBubble({
  msg, isMe, otherAvatar, otherName, onReact, onReply, currentUserId,
}: {
  msg:           Message;
  isMe:          boolean;
  otherAvatar:   string|null;
  otherName:     string;
  onReact:       (msgId:string, emoji:string) => void;
  onReply:       (msg:Message) => void;
  currentUserId: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isDeleted = !!msg.deleted_at;

  /* Total reactions as flat list */
  const reactionList = Object.entries(msg.reactions || {}).filter(([,ids]) => ids.length > 0);

  return (
    <div
      className={`flex items-end gap-2 group ${isMe ? "justify-end" : "justify-start"}`}
      onMouseLeave={() => { setShowPicker(false); setShowActions(false); }}
    >
      {!isMe && <Avatar src={otherAvatar} name={otherName} size={28} />}

      <div className={`relative max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>

        {/* Reply preview */}
        {msg.reply_preview && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl text-xs border-l-2 border-blue-400 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 max-w-full truncate ${isMe?"ml-auto":""}`}>
            {msg.reply_preview}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed cursor-pointer select-text ${
            isDeleted
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 italic"
              : isMe
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm"
          }`}
          onContextMenu={e => { e.preventDefault(); if (!isDeleted) setShowActions(true); }}
          onTouchStart={() => { if (!isDeleted) { const t = setTimeout(() => setShowActions(true), 500); return () => clearTimeout(t); } }}
        >
          {/* Media */}
          {msg.media_url && !isDeleted && (
            <img src={msg.media_url} alt="" className="rounded-xl max-w-full mb-1 max-h-60 object-cover" />
          )}
          {isDeleted ? "This message was deleted" : msg.body}
        </div>

        {/* Reactions below bubble */}
        {reactionList.length > 0 && (
          <div className={`flex gap-0.5 flex-wrap mt-0.5 ${isMe?"justify-end":""}`}>
            {reactionList.map(([emoji, ids]) => (
              <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all ${
                  ids.includes(currentUserId)
                    ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                }`}>
                <span>{emoji}</span>
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{ids.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Time + read status */}
        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : ""}`}>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{fullTime(msg.created_at)}</span>
          {isMe && !isDeleted && (
            msg.is_read
              ? <CheckCheck size={11} className="text-blue-500" />
              : <Check size={11} className="text-gray-400" />
          )}
        </div>

        {/* Hover actions — reply + react */}
        {!isDeleted && (
          <div className={`absolute ${isMe ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"}
            top-0 hidden group-hover:flex items-center gap-0.5`}>
            <button onClick={() => onReply(msg)}
              className="w-7 h-7 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-colors">
              <Reply size={12} className="text-gray-500" />
            </button>
            <div className="relative">
              <button onClick={() => setShowPicker(!showPicker)}
                className="w-7 h-7 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-colors">
                <SmilePlus size={12} className="text-gray-500" />
              </button>
              {showPicker && (
                <ReactionPicker onPick={e => onReact(msg.id, e)} onClose={() => setShowPicker(false)} />
              )}
            </div>
          </div>
        )}

        {/* Long-press / right-click context menu */}
        {showActions && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
            <div className={`absolute z-50 bottom-8 ${isMe?"right-0":"left-0"} bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden min-w-[140px]`}>
              <button onClick={() => { onReply(msg); setShowActions(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <Reply size={14} className="text-gray-400" /> Reply
              </button>
              {QUICK_REACTIONS.map(e => null) /* reaction row in context shown via picker */}
              <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2" />
              <button onClick={() => setShowActions(false)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <SmilePlus size={14} className="text-gray-400" /> React
              </button>
            </div>
          </>
        )}
      </div>

      {isMe && <Avatar src={null} name="me" size={28} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TYPING INDICATOR
══════════════════════════════════════════════════════════════ */
function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="w-7 h-7" />
      <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 flex items-center gap-1">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i*0.15}s`, animationDuration: "0.8s" }} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export function MessagesPage() {
  const navigate            = useNavigate();
  const { user, profile }   = useAuth();
  const userId              = user?.id || "";

  /* List state */
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [convLoading,    setConvLoading]    = useState(true);
  const [search,         setSearch]         = useState("");
  const [activeConvId,   setActiveConvId]   = useState<string|null>(null);

  /* Chat state */
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [msgLoading,     setMsgLoading]     = useState(false);
  const [input,          setInput]          = useState("");
  const [sending,        setSending]        = useState(false);
  const [replyTo,        setReplyTo]        = useState<Message|null>(null);
  const [typing,         setTyping]         = useState(false);       // other user is typing
  const [mediaFile,      setMediaFile]      = useState<File|null>(null);
  const [mediaPreview,   setMediaPreview]   = useState<string|null>(null);
  const [showMore,       setShowMore]       = useState(false);       // chat header ⋯ menu

  /* Refs */
  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const imageRef       = useRef<HTMLInputElement>(null);
  const typingTimer    = useRef<ReturnType<typeof setTimeout>>();
  const channelRef     = useRef<ReturnType<typeof supabase.channel>|null>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  /* ──────────────────────────────────────────────
     LOAD CONVERSATIONS
  ────────────────────────────────────────────── */
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    setConvLoading(true);
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id, last_message, last_message_at, unread_count_1, unread_count_2,
        participant_1, participant_2, cleared_by_1, cleared_by_2,
        p1:profiles!conversations_participant_1_fkey(id,name,username,avatar_url),
        p2:profiles!conversations_participant_2_fkey(id,name,username,avatar_url)
      `)
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order("last_message_at", { ascending: false });

    if (error) { console.error(error); setConvLoading(false); return; }

    const mapped: Conversation[] = (data || []).map((row: any) => {
      const amP1    = row.participant_1 === userId;
      const other   = amP1 ? row.p2 : row.p1;
      const unread  = amP1 ? (row.unread_count_1 || 0) : (row.unread_count_2 || 0);
      const cleared = amP1 ? row.cleared_by_1 : row.cleared_by_2;

      /* Check if last message is after cleared timestamp (only show if newer) */
      const lastMsgAt = row.last_message_at ? new Date(row.last_message_at).getTime() : 0;
      const clearedAt = cleared ? new Date(cleared).getTime() : 0;
      const showLast  = !cleared || lastMsgAt > clearedAt;

      return {
        id:              row.id,
        other:           { id: other?.id, name: other?.name || "User", username: other?.username || "user", avatar_url: other?.avatar_url || null },
        last_message:    showLast ? row.last_message : null,
        last_message_at: showLast ? row.last_message_at : null,
        unread:          showLast ? unread : 0,
        is_own_last:     showLast ? row.last_message_at && row.participant_1 === userId : false,
        am_p1:           amP1,
        cleared_at:      cleared,
      };
    });

    setConversations(mapped);
    setConvLoading(false);
  }, [userId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  /* ──────────────────────────────────────────────
     LOAD MESSAGES for active conversation
  ────────────────────────────────────────────── */
  const loadMessages = useCallback(async (convId: string, clearedAt: string|null) => {
    setMsgLoading(true);
    setMessages([]);

    let query = supabase
      .from("messages")
      .select("id, sender_id, body, media_url, media_type, is_read, created_at, deleted_at, reply_to, reactions")
      .eq("conversation_id", convId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(60);

    /* Only show messages after the cleared timestamp */
    if (clearedAt) query = query.gt("created_at", clearedAt);

    const { data, error } = await query;
    if (error) { console.error(error); setMsgLoading(false); return; }

    /* Hydrate reply previews */
    const replyIds = (data || []).filter((m: any) => m.reply_to).map((m: any) => m.reply_to);
    let replyMap: Record<string, string> = {};
    if (replyIds.length > 0) {
      const { data: rData } = await supabase.from("messages").select("id, body").in("id", replyIds);
      (rData || []).forEach((r: any) => { replyMap[r.id] = r.body; });
    }

    setMessages((data || []).map((m: any) => ({
      ...m,
      reactions:     m.reactions || {},
      reply_preview: m.reply_to ? (replyMap[m.reply_to] || null) : null,
    })));
    setMsgLoading(false);
  }, []);

  /* ──────────────────────────────────────────────
     OPEN CONVERSATION
  ────────────────────────────────────────────── */
  const openConversation = useCallback(async (conv: Conversation) => {
    setActiveConvId(conv.id);
    setReplyTo(null);
    setInput("");
    setMediaFile(null); setMediaPreview(null);
    await loadMessages(conv.id, conv.cleared_at);

    /* Mark as read */
    if (conv.unread > 0) {
      const field = conv.am_p1 ? "unread_count_1" : "unread_count_2";
      await supabase.from("conversations").update({ [field]: 0 }).eq("id", conv.id);
      await supabase.from("messages").update({ is_read: true, read_at: new Date().toISOString() })
        .eq("conversation_id", conv.id).eq("is_read", false).neq("sender_id", userId);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
    }

    /* Realtime subscription */
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel(`chat:${conv.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${conv.id}`,
      }, async payload => {
        const newMsg = payload.new as any;
        if (newMsg.sender_id === userId) return; // we already added it optimistically

        /* Hydrate reply preview if needed */
        let replyPreview = null;
        if (newMsg.reply_to) {
          const { data: rd } = await supabase.from("messages").select("body").eq("id", newMsg.reply_to).single();
          replyPreview = rd?.body || null;
        }
        setMessages(prev => [...prev, { ...newMsg, reactions: {}, reply_preview: replyPreview }]);
        setTyping(false);

        /* Mark immediately as read since conversation is open */
        await supabase.from("messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", newMsg.id);
        await supabase.from("conversations").update({
          [conv.am_p1 ? "unread_count_1" : "unread_count_2"]: 0
        }).eq("id", conv.id);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `conversation_id=eq.${conv.id}`,
      }, payload => {
        const upd = payload.new as any;
        setMessages(prev => prev.map(m => m.id === upd.id ? { ...m, is_read: upd.is_read, reactions: upd.reactions || {} } : m));
      })
      .on("broadcast", { event: "typing" }, () => {
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3000);
      })
      .subscribe();

    channelRef.current = ch;
  }, [userId, loadMessages]);

  useEffect(() => () => { if (channelRef.current) supabase.removeChannel(channelRef.current); }, []);

  /* Auto-scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* Auto-focus input when conversation opens */
  useEffect(() => {
    if (activeConvId) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeConvId]);

  /* ──────────────────────────────────────────────
     SEND MESSAGE
  ────────────────────────────────────────────── */
  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && !mediaFile) || !activeConvId || !userId || sending) return;
    setSending(true);

    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    /* Upload image if attached */
    if (mediaFile) {
      try {
        const ext  = mediaFile.name.split(".").pop() || "jpg";
        const path = `${userId}/msg_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("posts").upload(path, mediaFile, { upsert: true });
        if (!upErr) {
          mediaUrl  = supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
          mediaType = "image";
        }
      } catch { /* silently skip */ }
    }

    const insertData: any = {
      conversation_id: activeConvId,
      sender_id:       userId,
      body:            text || " ",
      media_url:       mediaUrl,
      media_type:      mediaType,
      reply_to:        replyTo?.id || null,
    };

    const { data: newMsg, error } = await supabase.from("messages").insert(insertData).select("*").single();
    if (error) { console.error(error); setSending(false); return; }

    /* Optimistic add */
    setMessages(prev => [...prev, {
      id:           newMsg.id,
      sender_id:    userId,
      body:         text || " ",
      media_url:    mediaUrl,
      media_type:   mediaType,
      is_read:      false,
      created_at:   newMsg.created_at,
      deleted_at:   null,
      reply_to:     replyTo?.id || null,
      reply_preview: replyTo?.body || null,
      reactions:    {},
    }]);

    /* Update conversation last_message */
    const conv = conversations.find(c => c.id === activeConvId)!;
    const otherUnreadField = conv.am_p1 ? "unread_count_2" : "unread_count_1";
    await supabase.from("conversations").update({
      last_message:     text || "📷 Image",
      last_message_at:  new Date().toISOString(),
      [otherUnreadField]: (conv.am_p1 ? (conversations.find(c=>c.id===activeConvId)?.unread||0) : 0) + 1,
    }).eq("id", activeConvId);

    /* Refresh conversation list */
    loadConversations();

    setInput(""); setReplyTo(null); setMediaFile(null); setMediaPreview(null);
    setSending(false);
  };

  /* ──────────────────────────────────────────────
     TYPING BROADCAST
  ────────────────────────────────────────────── */
  const broadcastTyping = () => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: {} });
  };

  /* ──────────────────────────────────────────────
     REACT to message
  ────────────────────────────────────────────── */
  const handleReact = async (msgId: string, emoji: string) => {
    if (!userId) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const current = { ...msg.reactions };
    const ids: string[] = current[emoji] || [];
    const already = ids.includes(userId);

    /* Toggle */
    if (already) {
      current[emoji] = ids.filter(id => id !== userId);
      if (current[emoji].length === 0) delete current[emoji];
    } else {
      current[emoji] = [...ids, userId];
    }

    /* Optimistic update */
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: current } : m));

    await supabase.from("messages").update({ reactions: current }).eq("id", msgId);
  };

  /* ──────────────────────────────────────────────
     DELETE (clear) conversation for me
  ────────────────────────────────────────────── */
  const handleClearChat = async () => {
    if (!activeConvId || !activeConv) return;
    const field = activeConv.am_p1 ? "cleared_by_1" : "cleared_by_2";
    await supabase.from("conversations").update({ [field]: new Date().toISOString() }).eq("id", activeConvId);
    setMessages([]);
    setConversations(prev => prev.map(c => c.id === activeConvId
      ? { ...c, last_message: null, last_message_at: null, unread: 0 }
      : c));
    setShowMore(false);
  };

  /* ──────────────────────────────────────────────
     IMAGE ATTACH
  ────────────────────────────────────────────── */
  const handleImageAttach = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert("Image must be under 10MB"); return; }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  /* ──────────────────────────────────────────────
     FILTER conversations by search
  ────────────────────────────────────────────── */
  const filteredConvs = conversations.filter(c => {
    const q = search.toLowerCase();
    return !q || c.other.name.toLowerCase().includes(q) || c.other.username.toLowerCase().includes(q);
  });

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <AppShell>
      {/* Full height, two-column on desktop */}
      <div className="flex h-full bg-white dark:bg-gray-950 overflow-hidden">

        {/* ── CONVERSATION LIST ── */}
        <div className={`flex flex-col border-r border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900
          ${activeConvId ? "hidden lg:flex w-80" : "flex w-full lg:w-80"}`}>

          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-bold text-gray-900 dark:text-white text-lg">Messages</h1>
              <button onClick={() => navigate("/messages/settings")}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Settings size={17} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            {/* Search within existing conversations */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 text-gray-900 dark:text-white placeholder-gray-400" />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} className="animate-spin text-blue-400" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <MessageSquare size={32} className="text-gray-200 dark:text-gray-700 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {search ? "No conversations match" : "No messages yet"}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                  {!search && "Follow someone and they can DM you"}
                </p>
              </div>
            ) : (
              filteredConvs.map(conv => (
                <button key={conv.id} onClick={() => openConversation(conv)}
                  className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors border-b border-gray-50 dark:border-gray-800/60 ${
                    activeConvId === conv.id
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}>
                  <Avatar src={conv.other.avatar_url} name={conv.other.name} size={48} online={true} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{conv.other.name}</p>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${conv.unread > 0 ? "font-semibold text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"}`}>
                        {conv.is_own_last && <span className="text-gray-400">You: </span>}
                        {conv.last_message || <span className="italic">Chat cleared</span>}
                      </p>
                      {conv.unread > 0 && (
                        <span className="shrink-0 w-5 h-5 bg-blue-600 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                          {conv.unread > 9 ? "9+" : conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── CHAT THREAD ── */}
        {activeConvId && activeConv ? (
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-950">

            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 z-10">
              <button onClick={() => { setActiveConvId(null); if (channelRef.current) supabase.removeChannel(channelRef.current); }}
                className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
                <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
              </button>
              <button onClick={() => navigate(`/user/${activeConv.other.id}`)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                <Avatar src={activeConv.other.avatar_url} name={activeConv.other.name} size={36} online={true} />
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{activeConv.other.name}</p>
                  <p className="text-xs text-green-500 font-medium">Active now</p>
                </div>
              </button>
              {/* ⋯ more menu */}
              <div className="relative shrink-0">
                <button onClick={() => setShowMore(!showMore)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <MoreHorizontal size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
                {showMore && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                    <div className="absolute right-0 top-11 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden min-w-[180px]">
                      <button onClick={() => navigate(`/user/${activeConv.other.id}`)}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        View Profile
                      </button>
                      <button onClick={() => navigate("/messages/settings")}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Message Settings
                      </button>
                      <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3" />
                      <button onClick={handleClearChat}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <Trash2 size={14} /> Clear Chat (for me)
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {msgLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-blue-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Avatar src={activeConv.other.avatar_url} name={activeConv.other.name} size={56} />
                  <p className="font-bold text-gray-900 dark:text-white mt-3">{activeConv.other.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">@{activeConv.other.username}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Say hello! 👋</p>
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMe={msg.sender_id === userId}
                    otherAvatar={activeConv.other.avatar_url}
                    otherName={activeConv.other.name}
                    onReact={handleReact}
                    onReply={m => { setReplyTo(m); inputRef.current?.focus(); }}
                    currentUserId={userId}
                  />
                ))
              )}
              {typing && <TypingIndicator name={activeConv.other.name} />}
              <div ref={bottomRef} />
            </div>

            {/* Reply banner */}
            {replyTo && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-100 dark:border-blue-900 shrink-0">
                <div className="w-0.5 h-8 bg-blue-500 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">Replying to</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{replyTo.body}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Media preview */}
            {mediaPreview && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <div className="relative inline-block">
                  <img src={mediaPreview} alt="" className="h-20 rounded-xl object-cover" />
                  <button onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                    <X size={10} className="text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* Input bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
              <button onClick={() => imageRef.current?.click()}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 transition-colors shrink-0">
                <ImagePlus size={20} />
              </button>
              <input ref={imageRef} type="file" accept="image/*" hidden
                onChange={e => e.target.files?.[0] && handleImageAttach(e.target.files[0])} />

              <input
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); broadcastTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Message…"
                className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
              <button onClick={sendMessage} disabled={(!input.trim() && !mediaFile) || sending}
                className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 active:scale-95 transition-all shrink-0">
                {sending ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white ml-0.5" />}
              </button>
            </div>
          </div>
        ) : (
          /* Empty state — desktop only */
          <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-950">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <MessageSquare size={28} className="text-blue-400" />
            </div>
            <p className="font-semibold text-gray-600 dark:text-gray-400">Select a conversation</p>
            <p className="text-sm">Choose a chat from the list to start messaging</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
