import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../components/AppShell";

export function MessageSettingsPage() {
  const navigate = useNavigate();
  const [dmPref, setDmPref] = useState("everyone");
  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-14 lg:top-0 bg-white z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Message Settings</h1>
        </div>
        <div className="px-4 py-4 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Who can send you DMs?</p>
          {["Everyone","People I follow","Nobody"].map(opt => (
            <button key={opt} onClick={() => setDmPref(opt.toLowerCase())}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all ${dmPref===opt.toLowerCase()?"border-blue-600 bg-blue-50 text-blue-700":"border-gray-100 text-gray-800 hover:border-gray-200"}`}>
              {opt}
              {dmPref===opt.toLowerCase() && <div className="w-4 h-4 rounded-full bg-blue-600" />}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
