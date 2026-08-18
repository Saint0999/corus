"use client";

import { Fragment, useEffect, useRef } from "react";

/**
 * A block of copy that starts dimmed and lights up word by word as it is
 * scrolled through the viewport.
 *
 * The reveal is SCROLL-LINKED, not time-based: it is tied to the block's
 * position, so scrolling back up un-reveals it and the effect is scrubbable
 * rather than a one-shot animation that has already finished by the time you
 * look at it.
 *
 * Implementation notes:
 *
 *  - Words are laid out as individual inline spans. `white-space: pre` on the
 *    space that follows each one keeps the natural word gaps while letting the
 *    line still wrap between spans.
 *  - Opacity is written straight to `style` inside a rAF instead of going
 *    through React state. There is one style write per word per frame and no
 *    re-render, which keeps a 40-word paragraph off the main-thread budget.
 *  - `opacity` alone is animated (no transform, no layout property), so each
 *    frame stays on the compositor.
 *  - Reduced motion gets the destination: fully lit, no scroll dependency.
 */

/** Opacity of a word that has not been reached yet. */
const DIM = 0.4;

/**
 * How many words are mid-fade at once. 1 would be a hard on/off per word; a
 * fractional overlap makes the leading edge read as a soft sweep instead of a
 * row of switches flipping.
 */
const FEATHER = 2.5;

/**
 * The reveal window, as fractions of the viewport height. The sweep starts
 * when the block's top edge crosses `START` (just above the fold) and
 * completes when it has travelled up to `END`. The window is wide on purpose:
 * a short paragraph would otherwise finish revealing within a single flick of
 * the wheel, which reads as a flicker rather than a sweep.
 */
const START = 0.9;
const END = 0.25;

export type Segment = {
  text: string;
  /** Applied to every word in this segment — e.g. the brand colour. */
  className?: string;
};

export function ScrollRevealText({
  segments,
  className = "",
}: {
  segments: readonly Segment[];
  className?: string;
}) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const words = wordsRef.current.filter((n): n is HTMLSpanElement => !!n);
    if (!container || words.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const word of words) word.style.opacity = "1";
      return;
    }

    let frame = 0;

    const paint = () => {
      frame = 0;

      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * START;

      // Distance the block travels between "not started" and "fully lit". The
      // block's own height is part of it, so a tall paragraph reveals over a
      // longer scroll than a short one and the sweep speed stays even.
      const travel = rect.height + (START - END) * vh;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / travel));

      // Scaled past the word count by FEATHER so the final word finishes
      // fading exactly at progress 1 instead of being cut off mid-fade.
      const edge = progress * (words.length + FEATHER);

      words.forEach((word, i) => {
        const lit = Math.min(1, Math.max(0, (edge - i) / FEATHER));
        word.style.opacity = String(DIM + (1 - DIM) * lit);
      });
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [segments]);

  // Flattened once per render: the animation indexes words globally, across
  // segment boundaries, so the sweep does not restart at each colour change.
  const words = segments.flatMap((segment) =>
    segment.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ word, className: segment.className })),
  );

  return (
    <p ref={containerRef} className={className}>
      {words.map(({ word, className: wordClassName }, index) => (
        // The space AFTER the span, not inside it: a space inside an animated
        // span would inherit its opacity, and — more importantly — any space
        // wrapped in an element with `white-space: pre` stops being a
        // line-break opportunity, which puts the whole paragraph on one line.
        <Fragment key={index}>
          <span
            // Slots are written by index and cleared on unmount, so the list
            // never accumulates detached nodes.
            ref={(node) => {
              wordsRef.current[index] = node;
              return () => {
                wordsRef.current[index] = null;
              };
            }}
            // The starting opacity is inline rather than a utility so the
            // server-rendered HTML is already dimmed — no flash of fully lit
            // text before hydration.
            style={{ opacity: DIM }}
            className={wordClassName}
          >
            {word}
          </span>{" "}
        </Fragment>
      ))}
    </p>
  );
}
