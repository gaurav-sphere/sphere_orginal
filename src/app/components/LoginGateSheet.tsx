import React from "react";
import { X, UserPlus, LogIn } from "lucide-react";
import { useNavigate } from "react-router";

type ActionType = "praise"|"thought"|"forward"|"bookmark"|"profile"|"org_profile"|"search_people"|"message"|"follow"|"create"|"story";

const MESSAGES: Record<ActionType, { title: string; body: string }> = {
  praise:        { title: "Praise this quote 👏", body: "Join Sphere to support creators and show them some love." },
  thought:       { title: "Share your thought 💬", body: "Join Sphere to join the conversation and reply." },
  forward:       { title: "Forward this quote 🔁", body: "Share great content with your followers on Sphere." },
  bookmark:      { title: "Save for later 🔖", body: "Join Sphere to build your personal collection of great quotes." },
  profile:       { title: "See their profile 👤", body: "Follow people and see their quotes on Sphere." },
  org_profile:   { title: "See this organisation 🏢", body: "Follow organisations you care about on Sphere." },
  search_people: { title: "Find your friends 🔍", body: "Search and follow people on Sphere." },
  message:       { title: "Start a conversation 💌", body: "Message people directly on Sphere." },
  follow:        { title: "Follow them ➕", body: "Join Sphere to follow people and stay updated." },
  create:        { title: "Create a quote ✍️", body: "Share your thoughts with the world on Sphere." },
  story:         { title: "View Stories 📸", body: "Join Sphere to see and share status updates." },
};

interface LoginGateSheetProps {
  action: ActionType | null;
  onClose: () => void;
}

export function LoginGateSheet({ action, onClose }: LoginGateSheetProps) {
  const navigate = useNavigate();
  if (!action) return null;
  const msg = MESSAGES[action] ?? MESSAGES.praise;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-sm mx-auto bg-white rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl sheet-up">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">{msg.title}</h2>
          <p className="text-sm text-gray-500">{msg.body}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => { onClose(); navigate("/login", { state: { defaultTab: "register" } }); }}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={16} /> Sign Up Free
          </button>
          <button
            onClick={() => { onClose(); navigate("/login"); }}
            className="w-full py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            <LogIn size={16} /> Log In
          </button>
          <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
