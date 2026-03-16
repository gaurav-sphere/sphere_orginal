import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { GuestPostPage } from "./GuestPostPage";
import { LoginPostPage } from "./LoginPostPage";

/* ══════════════════════════════════════════════════════════════
   QuotePage — Route: /quote/:id
   Canonical URL for all quotes on Sphere.
   sphere.com/quote/[quote_id]

   Smart router:
   • Guest (not logged in) → GuestPostPage (restricted view)
   • Logged in             → LoginPostPage (full view)

   Security: each page is a completely separate component.
   Removing guest access means deleting GuestPostPage only.
══════════════════════════════════════════════════════════════ */
export function QuotePage() {
  const { user, loading } = useAuth();

  /* While auth is loading, show nothing (avoids flash) */
  if (loading) return null;

  return user ? <LoginPostPage /> : <GuestPostPage />;
}
