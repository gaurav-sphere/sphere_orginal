import React from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, UserCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";

export function BlockedListPage() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-14 lg:top-0 bg-white z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Blocked Users</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <UserCheck size={40} className="mb-3 text-gray-300" />
          <p className="font-semibold text-gray-600 mb-1">No blocked users</p>
          <p className="text-sm">People you block will appear here</p>
        </div>
      </div>
    </AppShell>
  );
}
