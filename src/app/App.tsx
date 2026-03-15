import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../contexts/AuthContext";
import { GuestProvider } from "../contexts/GuestContext";
import { ThemeProvider } from "../contexts/ThemeContext";

/* ══════════════════════════════════════════════════════════════
   GLOBAL COPY PROTECTION
   — Copy is blocked everywhere on the site
   — Paste is always allowed (no interference)
   — The ONLY exception: elements that have the class "allow-copy"
     Use this on quote text inside PostCard:
       <div className="allow-copy">{post.content}</div>
   — Right-click context menu is disabled site-wide
   — Keyboard shortcuts Ctrl+C / Cmd+C blocked outside allow-copy
══════════════════════════════════════════════════════════════ */
function useCopyProtection() {
  useEffect(() => {
    /* Block copy event unless inside .allow-copy */
    const handleCopy = (e: ClipboardEvent) => {
      const sel      = window.getSelection();
      const node     = sel?.anchorNode?.parentElement;
      const inAllowed = node?.closest(".allow-copy") !== null;
      if (!inAllowed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    /* Block cut event entirely */
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    /* Block right-click context menu */
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    /* Block Ctrl+C / Cmd+C outside allow-copy zones */
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCopy = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c";
      if (!isCopy) return;
      const sel       = window.getSelection();
      const node      = sel?.anchorNode?.parentElement;
      const inAllowed = node?.closest(".allow-copy") !== null;
      if (!inAllowed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("copy",        handleCopy,        true);
    document.addEventListener("cut",         handleCut,         true);
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("keydown",     handleKeyDown,     true);

    return () => {
      document.removeEventListener("copy",        handleCopy,        true);
      document.removeEventListener("cut",         handleCut,         true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("keydown",     handleKeyDown,     true);
    };
  }, []);
}

export default function App() {
  useCopyProtection();

  return (
    <ThemeProvider>
      <GuestProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </GuestProvider>
    </ThemeProvider>
  );
}
