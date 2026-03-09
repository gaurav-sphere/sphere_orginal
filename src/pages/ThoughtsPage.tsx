import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Send, Heart, Shield, ChevronDown } from "lucide-react";
import { PostCard } from "../components/PostCard";
import { LoginGateSheet } from "../components/LoginGateSheet";
import { mockPosts, mockUsers, currentUser } from "../mockData";

const DEMO_THOUGHTS = [
  { id:"t1", user: mockUsers[1], content:"This is such a great perspective! Completely agree with your point about the current situation.", timestamp:"2m", likes:12, replies:[] },
  { id:"t2", user: mockUsers[2], content:"Interesting take. I'd add that the root issue is even deeper — we need systemic change.", timestamp:"8m", likes:5, replies:[
    { id:"t2r1", user: mockUsers[3], content:"Exactly! That's the key point most people miss.", timestamp:"5m", likes:3 }
  ]},
  { id:"t3", user: mockUsers[4], content:"OMG yes 🔥 been saying this for years. Finally someone gets it!", timestamp:"15m", likes:28, replies:[] },
  { id:"t4", user: mockUsers[0], content:"Not sure I fully agree — can you elaborate on the third point?", timestamp:"22m", likes:4, replies:[] },
  { id:"t5", user: mockUsers[1], content:"Saved this. Need to share with my whole group.", timestamp:"35m", likes:9, replies:[] },
];

function ThoughtItem({ thought, isLoggedIn, isReply = false }: { thought: any; isLoggedIn: boolean; isReply?: boolean }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(thought.likes);
  const [showGate, setShowGate] = useState(false);

  const handleLike = () => {
    if (!isLoggedIn) { setShowGate(true); return; }
    setLiked(p => !p);
    setLikeCount((c: number) => liked ? c - 1 : c + 1);
  };

  return (
    <>
      <div className={`flex gap-3 py-3 ${isReply ? "pl-12" : ""}`}>
        {thought.user?.avatar ? (
          <img src={thought.user.avatar} alt={thought.user.name} className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
            <Shield size={16} className="text-gray-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-bold text-gray-900">{thought.user?.name}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{thought.timestamp}</span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{thought.content}</p>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={handleLike} className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>
              <Heart size={13} fill={liked ? "currentColor" : "none"} />
              {likeCount > 0 && <span className="font-semibold">{likeCount}</span>}
            </button>
            {!isReply && (
              <button className="text-xs text-gray-400 hover:text-blue-500 font-semibold transition-colors">Reply</button>
            )}
          </div>
        </div>
      </div>
      {thought.replies?.map((r: any) => <ThoughtItem key={r.id} thought={r} isLoggedIn={isLoggedIn} isReply />)}
      {showGate && <LoginGateSheet action="praise" onClose={() => setShowGate(false)} />}
    </>
  );
}

export function ThoughtsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoggedIn] = useState(true); // In production: from AuthContext
  const [reply, setReply] = useState("");
  const [thoughts, setThoughts] = useState(DEMO_THOUGHTS);
  const [gateAction, setGateAction] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const post = mockPosts.find((p: any) => p.id === id) || mockPosts[0];
  const VISIBLE_FOR_GUEST = 3;

  const handleSend = () => {
    if (!isLoggedIn) { setGateAction("thought"); return; }
    if (!reply.trim()) return;
    const newThought = {
      id: `t_new_${Date.now()}`,
      user: currentUser,
      content: reply.trim(),
      timestamp: "just now",
      likes: 0,
      replies: [],
    };
    setThoughts(prev => [newThought, ...prev]);
    setReply("");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Thoughts</h1>
        <span className="text-sm text-gray-400 ml-0.5">({thoughts.length})</span>
      </div>

      {/* Original post */}
      <PostCard post={post as any} isLoggedIn={isLoggedIn} />

      {/* Thoughts */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gray-100" />
          <span className="text-xs text-gray-400 font-semibold">{thoughts.length} Thoughts</span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        {isLoggedIn ? (
          thoughts.map((t) => (
            <div key={t.id} className="border-b border-gray-50 last:border-0">
              <ThoughtItem thought={t} isLoggedIn={isLoggedIn} />
            </div>
          ))
        ) : (
          <>
            {thoughts.slice(0, VISIBLE_FOR_GUEST).map((t) => (
              <div key={t.id} className="border-b border-gray-50 last:border-0">
                <ThoughtItem thought={t} isLoggedIn={false} />
              </div>
            ))}
            {thoughts.length > VISIBLE_FOR_GUEST && (
              <div className="relative mt-2">
                {/* Blurred preview */}
                <div className="blur-sm pointer-events-none">
                  <ThoughtItem thought={thoughts[VISIBLE_FOR_GUEST]} isLoggedIn={false} />
                </div>
                {/* Gate overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent flex flex-col items-center justify-end pb-4 gap-2">
                  <p className="text-sm font-bold text-gray-900">
                    Sign up to read all {thoughts.length} thoughts
                  </p>
                  <button onClick={() => navigate("/login")} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                    Join Sphere
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reply input */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        {isLoggedIn ? (
          <img src={(currentUser as any)?.avatar} alt="me" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-gray-400" />
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isLoggedIn ? "Add your thought…" : "Log in to add a thought…"}
          onClick={() => { if (!isLoggedIn) setGateAction("thought"); }}
          readOnly={!isLoggedIn}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder-gray-400 cursor-text"
        />
        <button
          onClick={handleSend}
          disabled={!reply.trim() && isLoggedIn}
          className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          <Send size={15} className="text-white ml-0.5" />
        </button>
      </div>

      {gateAction && <LoginGateSheet action={gateAction as any} onClose={() => setGateAction(null)} />}
    </div>
  );
}
