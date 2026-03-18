import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";

function mask(value: string | null | undefined, type: "email" | "phone"): string {
  if (!value) return "—";
  if (type === "email") {
    const [local, domain] = value.split("@");
    if (!domain) return value;
    const shown = local.length > 2 ? local[0] + "•".repeat(local.length - 2) + local.slice(-1) : local;
    return `${shown}@${domain}`;
  }
  if (type === "phone") {
    return value.length > 4 ? "•".repeat(value.length - 4) + value.slice(-4) : value;
  }
  return value;
}

function formatDob(dob: string | null | undefined): string {
  if (!dob) return "—";
  try {
    return new Date(dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  } catch { return dob; }
}

function formatJoined(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } catch { return ts; }
}

export function AccountInfoPage() {
  const navigate      = useNavigate();
  const { profile }   = useAuth();
  const [showEmail,  setShowEmail]  = useState(false);
  const [showPhone,  setShowPhone]  = useState(false);

  const p = profile as any;

  const rows: { label: string; value: string; sensitive?: "email" | "phone"; show?: boolean; toggle?: () => void }[] = [
    { label: "Full Name",     value: p?.name        || "—" },
    { label: "Username",      value: `@${p?.username || "—"}` },
    {
      label: "Email",
      value: showEmail ? (p?.email || "—") : mask(p?.email, "email"),
      sensitive: "email", show: showEmail, toggle: () => setShowEmail(s => !s),
    },
    {
      label: "Phone",
      value: showPhone ? (p?.phone || "—") : mask(p?.phone, "phone"),
      sensitive: "phone", show: showPhone, toggle: () => setShowPhone(s => !s),
    },
    { label: "Date of Birth", value: formatDob(p?.dob) },
    { label: "Gender",        value: p?.gender ? (p.gender[0].toUpperCase() + p.gender.slice(1)) : "—" },
    { label: "Account Type",  value: p?.is_private ? "Private" : "Public" },
    { label: "Joined",        value: formatJoined(p?.joined_at) },
  ];

  return (
    <AppShell>
      <div className="min-h-full bg-white dark:bg-gray-950">

        {/* Header — no mt-14 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white">Account Info</h1>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
                  {row.label}
                </p>
                <p className="text-sm text-gray-900 dark:text-white font-medium truncate">
                  {row.value}
                </p>
              </div>
              {row.toggle && (
                <button onClick={row.toggle}
                  className="ml-3 shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 dark:text-gray-500">
                  {row.show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
