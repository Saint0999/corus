"use client";

import { useEffect } from "react";
import ReactiveLines from "@/components/originkit/reactive-lines";

/**
 * Originkit's "Reactive Lines" as the hero backdrop.
 *
 * The component itself is vendored byte-for-byte in
 * `src/components/originkit/reactive-lines.tsx` so a re-add or upgrade from the
 * registry applies cleanly. Everything this site needs to change about it is
 * done from out here, through props and one mount effect.
 */
export function ReactiveLinesBackdrop() {
  useEffect(() => {
    /**
     * Kick the animation loop once on mount.
     *
     * Two details of the component make this necessary, and neither is a bug
     * so much as an assumption that does not hold for a full-bleed backdrop:
     *
     *  1. Its canvas is created with `{ alpha: false }`, so the drawing buffer
     *     starts as opaque BLACK rather than transparent. Nothing behind it
     *     shows through — the charcoal page included.
     *  2. It starts deferred (`deferStart: true`) and only begins drawing on
     *     the first `mousemove`.
     *
     * Together that means the hero renders as a black rectangle until the
     * pointer moves — and on a touch device, where `mousemove` never fires at
     * all, permanently. Dispatching one synthetic move paints the first frame
     * immediately; after that the real pointer drives it as designed.
     *
     * rAF, not a bare call: child effects run before parent effects, so the
     * component's own listener is already attached by now, but waiting a frame
     * also guarantees layout has settled so it reads a correct bounding box.
     */
    const frame = requestAnimationFrame(() => {
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
        }),
      );
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <ReactiveLines
      // Sits at the very bottom of the hero's stacking order: lines -> glow ->
      // 3D canvas -> copy.
      style={{ zIndex: 0 }}
      // MUST track `--color-surface` in globals.css. The canvas is opaque and
      // repaints this colour every frame, so any drift shows up as a visible
      // charcoal-on-charcoal seam where the hero meets the rest of the page.
      backgroundColor="#1a1a1a"
      // Warm and very low alpha: this is a texture behind a lit 3D scene, not
      // a foreground element, and it must never compete with the headline.
      lineColor="rgba(245, 158, 11, 0.16)"
      lineWidth={1}
      // Fades the field out towards the edges, which keeps the bottom corners
      // calm enough for the headline and spec line to stay legible.
      fade
      fadeIntensity={20}
    />
  );
}
