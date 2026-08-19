"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Smooth scrolling, for the landing page only.
 *
 * Mounted from `app/page.tsx` rather than the root layout, so it lives and
 * dies with that one route: the configurator and the spec pages keep the
 * browser's native scrolling, where a reader is looking things up rather than
 * being walked through a sequence and an eased scroll just feels like lag.
 *
 * Lenis drives the REAL document scroll — it animates `window.scrollTo` rather
 * than transforming a wrapper — which is why the rest of the page needs to
 * know nothing about it: `window.scroll` still fires, `scrollY` is still the
 * truth, and the scroll-linked pieces on this page (<ScrollRevealText>, the
 * 3D reveal) keep working through their own listeners with no integration
 * code. It also means anchor links, the scrollbar and find-in-page all behave
 * as they always did.
 *
 * Renders nothing.
 */
export function SmoothScroll() {
  useEffect(() => {
    // Reduced motion means native scrolling, full stop. Easing the page under
    // someone who has asked for less movement is exactly the thing they turned
    // off, and unlike a decorative animation there is no "destination state"
    // to fall back to — the destination IS the browser's own behaviour.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      // Shorter than the 1.2s default. The page is a sequence of scroll-linked
      // reveals, and a long ease puts the animation noticeably behind the
      // wheel — the board would still be turning after the wheel had stopped.
      duration: 0.9,
      smoothWheel: true,
      // Touch is left NATIVE on purpose. Momentum scrolling on a phone is
      // already smooth and is tuned by the OS; overriding it costs a frame of
      // latency on every drag and breaks the rubber-band at the ends.
      syncTouch: false,
    });

    // Lenis can run its own loop, but owning it here means the teardown below
    // is guaranteed to stop it — a stray rAF outliving the route is the one
    // way this could leak into the pages that are meant to scroll natively.
    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      // Removes the `lenis` classes from <html> and restores native scrolling.
      lenis.destroy();
    };
  }, []);

  return null;
}
