"use client";

import { Html, useProgress } from "@react-three/drei";

/**
 * Suspense fallback that lives *inside* the <Canvas>.
 *
 * A normal `<div>` cannot be a child of the R3F tree (the reconciler only knows
 * about three.js objects), so drei's <Html> portals real DOM on top of the
 * canvas for us. `useProgress` reads three.js' global LoadingManager, which is
 * what gives us a real percentage instead of a spinner that lies.
 */
export function CanvasLoader() {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="flex w-40 flex-col items-center gap-3">
        <div className="h-px w-full bg-line">
          <div
            className="h-px bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-[11px] tracking-[0.2em] text-ink-muted">
          {Math.round(progress)}%
        </span>
      </div>
    </Html>
  );
}
