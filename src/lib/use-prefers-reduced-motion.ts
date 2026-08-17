"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Reads the user's OS-level "reduce motion" setting.
 *
 * `useSyncExternalStore` is the React-recommended way to subscribe to a browser
 * API: it takes a server snapshot (third argument) so the value is defined
 * during SSR, and it re-renders if the user flips the setting mid-session.
 * We use it to stop the hero auto-rotating for people who get motion sick.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches, // client snapshot
    () => false, // server snapshot — assume motion is fine until we know
  );
}
