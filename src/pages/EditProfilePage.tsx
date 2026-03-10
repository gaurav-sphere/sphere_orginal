import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Camera, Check, Loader2 } from "lucide-react";
import { currentUser } from "../data/mockData";

const user = currentUser as any;

export function EditProfilePage() {
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [location, setLocation] = useState(user?.location || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false); setSaved(true);
    setTimeout(() => navigate("/profile"), 600);
  };

  const inputCls = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-gray-900";
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Edit Profile</h1>
        <button onClick={save} disabled={saving || saved}
          className="px-4 py-1.5 bg-gray-900 text-white rounded-full text-sm font-bold hover:bg-gray-800 disabled:opacity-60 transition-all flex items-center gap-1.5">
          {saved ? <><Check size={14} />Saved</> : saving ? <><Loader2 size={14} className="animate-spin" />Saving</> : "Save"}
        </button>
      </div>

      {/* Banner */}
      <div className="relative h-36 bg-gradient-to-r from-blue-500 to-purple-600 cursor-pointer group">
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera size={24} className="text-white" />
        </div>
      </div>

      {/* Avatar */}
      <div className="px-4 -mt-10 mb-4">
        <div className="relative w-20 h-20 cursor-pointer group">
          <img src={user?.avatar} alt="me" className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-sm" />
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={18} className="text-white" />
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 pb-10">
        <div><label className={labelCls}>Name</label><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></div>
        <div>
          <label className={labelCls}>Bio <span className="text-gray-300 font-normal">({bio.length}/160)</span></label>
          <textarea value={bio} onChange={e => setBio(e.target.value.slice(0,160))} rows={3} className={inputCls + " resize-none"} />
        </div>
        <div><label className={labelCls}>Location</label><input value={location} onChange={e => setLocation(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Website</label><input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" className={inputCls} /></div>
      </div>
    </div>
  );
}
