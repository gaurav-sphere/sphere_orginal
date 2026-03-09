import { useCallback } from "react";
import { useNavigate } from "react-router";

/**
 * A reliable back-navigation hook.
 * Uses window.history.back() (lower-level, more reliable on Android)
 * and falls back to a specified route if there's no previous history.
 */
export function useBack(fallback = "/feed") {
  const navigate = useNavigate();
  return useCallback(() => {
    // If we have actual previous pages in history, go back natively
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // No history — navigate to the fallback route
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback]);
}
