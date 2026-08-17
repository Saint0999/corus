"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the 3D hero.
 *
 * Two things are happening here, and both matter:
 *
 * 1. `ssr: false` — <Canvas> touches `window` and asks for a WebGL context, so
 *    it must never run during server rendering. In the App Router, `ssr: false`
 *    is only allowed inside a Client Component, which is exactly why this thin
 *    wrapper exists: `page.tsx` can stay a Server Component and still use it.
 *
 * 2. Code splitting — three.js + drei is a large dependency. Loading it in its
 *    own chunk means the headline and CTA paint immediately and the 3D arrives
 *    a moment later, instead of the whole hero waiting on WebGL.
 */
const Scene = dynamic(() => import("./Scene").then((mod) => mod.Scene), {
  ssr: false,
  // Shown while the three.js chunk downloads — before the model itself starts,
  // which is when <CanvasLoader> takes over inside the canvas.
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-mono text-[11px] tracking-[0.2em] text-ink-muted">
        LOADING STUDIO
      </span>
    </div>
  ),
});

export function HeroCanvas() {
  return (
    <div className="h-full w-full">
      <Scene />
    </div>
  );
}
