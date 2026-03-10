import React from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { currentUser } from "../data/mockData";

const user = currentUser as any;

export function AccountInfoPage() {
  const navigate = useNavigate();
  const info = [
    { label:"Full Name", value: user?.name },
    { label:"Username", value: user?.username },
    { label:"Email", value: "arjun@example.com" },
    { label:"Phone", value: "+91 XXXXXX7890" },
    { label:"Date of Birth", value: "1998-04-15" },
    { label:"Gender", value: "Male" },
    { label:"Account Type", value: "Personal" },
    { label:"Joined", value: "January 2024" },
  ];
  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-14 lg:top-0 bg-white z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Account Info</h1>
        </div>
        <div className="divide-y divide-gray-50">
          {info.map(item => (
            <div key={item.label} className="px-4 py-3.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
              <p className="text-sm text-gray-900 font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
