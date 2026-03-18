import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Camera, Check, Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

async function compressImage(file: File): Promise<File> {
  if (file.size < 200_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const MAX = 1200;
    const sc  = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const c   = document.createElement("canvas");
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(
      b => res(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file),
      "image/jpeg", 0.85));
  } catch { return file; }
}

export function EditProfilePage() {
  const navigate           = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  /* Form fields */
  const [name,         setName]         = useState("");
  const [bio,          setBio]          = useState("");
  const [location,     setLocation]     = useState("");
  const [websiteUrl,   setWebsiteUrl]   = useState("");
  const [websiteLabel, setWebsiteLabel] = useState("");

  /* Avatar / banner local preview + file */
  const [avatarPreview,  setAvatarPreview]  = useState<string | null>(null);
  const [bannerPreview,  setBannerPreview]  = useState<string | null>(null);
  const [avatarFile,     setAvatarFile]     = useState<File | null>(null);
  const [bannerFile,     setBannerFile]     = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  /* Pre-fill from profile */
  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setBio((profile as any).bio || "");
    setLocation((profile as any).location || "");
    setWebsiteUrl((profile as any).website_url || "");
    setWebsiteLabel((profile as any).website_label || "");
  }, [profile]);

  const handleAvatarFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const c = await compressImage(file);
    setAvatarFile(c);
    setAvatarPreview(URL.createObjectURL(c));
  };

  const handleBannerFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const c = await compressImage(file);
    setBannerFile(c);
    setBannerPreview(URL.createObjectURL(c));
  };

  const uploadToStorage = async (file: File, bucket: string, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const save = async () => {
    if (!user?.id || saving) return;
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");

    const updates: Record<string, any> = {
      name:          name.trim(),
      bio:           bio.trim() || null,
      location:      location.trim() || null,
      website_url:   websiteUrl.trim() || null,
      website_label: websiteLabel.trim() || null,
      updated_at:    new Date().toISOString(),
    };

    /* Upload avatar if changed */
    if (avatarFile) {
      const ext  = avatarFile.name.split(".").pop() || "jpg";
      const url  = await uploadToStorage(avatarFile, "avatars", `${user.id}/avatar.${ext}`);
      if (url) updates.avatar_url = url;
    }

    /* Upload banner if changed */
    if (bannerFile) {
      const ext  = bannerFile.name.split(".").pop() || "jpg";
      const url  = await uploadToStorage(bannerFile, "banners", `${user.id}/banner.${ext}`);
      if (url) updates.banner_url = url;
    }

    const { error: dbErr } = await supabase.from("profiles").update(updates).eq("id", user.id);
    setSaving(false);

    if (dbErr) { setError(dbErr.message || "Failed to save. Please try again."); return; }

    await refreshProfile();
    setSaved(true);
    setTimeout(() => navigate("/profile"), 600);
  };

  const inputCls = "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-400 transition-all text-gray-900 dark:text-white placeholder-gray-400";
  const labelCls = "block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5";

  const currentAvatar  = avatarPreview  || (profile as any)?.avatar_url;
  const currentBanner  = bannerPreview  || (profile as any)?.banner_url;

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-gray-950">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300"/>
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white">Edit Profile</h1>
          <button onClick={save} disabled={saving || saved}
            className="px-4 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-bold hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-all flex items-center gap-1.5">
            {saved   ? <><Check size={13}/>Saved</>
            : saving ? <><Loader2 size={13} className="animate-spin"/>Saving</>
            : "Save"}
          </button>
        </div>

        {/* Banner */}
        <div className="relative h-36 bg-gradient-to-r from-blue-500 to-blue-700 cursor-pointer group overflow-hidden"
          onClick={() => bannerRef.current?.click()}>
          {currentBanner && <img src={currentBanner} alt="" className="w-full h-full object-cover"/>}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={24} className="text-white"/>
          </div>
        </div>
        <input ref={bannerRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleBannerFile(e.target.files[0])}/>

        {/* Avatar */}
        <div className="px-4 -mt-10 mb-5">
          <div className="relative w-20 h-20 cursor-pointer group" onClick={() => avatarRef.current?.click()}>
            {currentAvatar ? (
              <img src={currentAvatar} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-gray-950 shadow-sm"/>
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600 ring-4 ring-white dark:ring-gray-950 shadow-sm flex items-center justify-center">
                <span className="text-white text-3xl font-extrabold">{profile?.name?.[0]?.toUpperCase() || "U"}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white"/>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleAvatarFile(e.target.files[0])}/>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Tap photo to change</p>
        </div>

        {/* Form */}
        <div className="px-4 space-y-4 pb-10">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className={labelCls}>Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder="Your name" className={inputCls}/>
          </div>

          <div>
            <label className={labelCls}>
              Bio <span className="text-gray-300 dark:text-gray-600 font-normal">({bio.length}/160)</span>
            </label>
            <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 160))} rows={3}
              placeholder="Tell people about yourself…" className={inputCls + " resize-none"}/>
          </div>

          <div>
            <label className={labelCls}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className={inputCls}/>
          </div>

          <div>
            <label className={labelCls}>Website URL</label>
            <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yoursite.com" className={inputCls}/>
          </div>

          <div>
            <label className={labelCls}>Website Label</label>
            <input value={websiteLabel} onChange={e => setWebsiteLabel(e.target.value)} placeholder="My Portfolio" className={inputCls}/>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Display name for the link on your profile</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
