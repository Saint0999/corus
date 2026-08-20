"use client";

import { Fragment, type ElementType, type ReactNode } from "react";

/**
 * Staggered entrance reveal: the copy is split into individual characters, each
 * of which resolves out of a heavy blur a beat after the one before it, so the
 * line reads as it comes into focus left to right.
 *
 * Two ways to drive it, and the choice is about WHERE on the page the copy is:
 *
 *  - `reveal="mount"` (the default) fires once on mount, on a timer. This is
 *    for copy that is on screen at load — the hero.
 *  - `reveal="scroll"` hands the same keyframes to the element's own travel
 *    through the viewport, so the sweep runs as the reader scrolls the block
 *    into view rather than being over before they arrive. Identical move,
 *    identical order; the beat comes from the wheel instead of a clock.
 *
 * The scroll mode is not <ScrollRevealText>: that one lights whole WORDS up
 * out of dim copy that is already legible, which is how a paragraph is meant
 * to be read. This is the hero's per-CHARACTER resolve, for a display line
 * that is meant to arrive rather than to be read through.
 *
 * Structure, from the outside in: words -> characters. The word wrapper is what
 * keeps the copy wrapping normally — a line can only break between words, and
 * splitting straight to characters would let a break land mid-word. The spaces
 * between words are real text nodes outside the animated spans, so they stay
 * break opportunities.
 *
 * The animation itself is pure CSS (`.stagger-char` / `.stagger-char-scroll` in
 * globals.css); the only thing computed here is where each character sits in
 * the sweep — an `animation-delay` in mount mode, an `animation-range` in
 * scroll mode, and nothing else either way. No rAF loop, no
 * state, and no work at all once the last character lands.
 * `prefers-reduced-motion` is handled in the stylesheet.
 */

export type Segment = {
  text: string;
  /** Applied to every word in this segment — e.g. the brand colour. */
  className?: string;
};

export function StaggeredText({
  segments,
  as: Tag = "p",
  className = "",
  stagger = 45,
  delay = 0,
  reveal = "mount",
  scrollFrom = 10,
  scrollStep = 1.2,
  scrollSpan = 14,
}: {
  segments: readonly Segment[];
  as?: ElementType<{ className?: string; children?: ReactNode }>;
  className?: string;
  /** Beat between consecutive characters, in ms. `mount` only. */
  stagger?: number;
  /**
   * Delay before the first character, in ms — used to order two blocks.
   * `mount` only.
   */
  delay?: number;
  /** What drives the sweep: the clock, or the reader's scroll. */
  reveal?: "mount" | "scroll";
  /**
   * The `scroll` equivalents of `delay`, `stagger` and the animation's own
   * duration, all as percentages of the block's pass across the viewport (0%
   * is its top edge touching the bottom of the screen, 100% its bottom edge
   * leaving the top).
   *
   * A scroll-driven animation has no time to be delayed by, so the stagger has
   * to be an offset in SCROLL DISTANCE: each character gets the same window,
   * shifted `scrollStep` further down the block's travel than the one before
   * it. `scrollSpan` is how much of that travel one character takes to resolve
   * — the windows overlap heavily on purpose, which is what makes the sweep
   * read as one move rather than as characters taking turns.
   */
  scrollFrom?: number;
  scrollStep?: number;
  scrollSpan?: number;
}) {
  const words = segments.flatMap((segment) =>
    segment.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ word, className: segment.className })),
  );

  // Counted across the whole block, not per word, so the sweep runs at one
  // even rate through the paragraph instead of restarting at each word.
  let charIndex = 0;

  return (
    <Tag className={className}>
      {words.map(({ word, className: wordClassName }, wordIndex) => (
        <Fragment key={wordIndex}>
          {/* `inline-block` on the word is what stops a break mid-word. */}
          <span className={`inline-block ${wordClassName ?? ""}`}>
            {Array.from(word).map((char, i) => {
              const index = charIndex++;
              const start = scrollFrom + index * scrollStep;

              return (
                <span
                  key={i}
                  // `inline-block` again: `filter` and `transform` do not apply
                  // to a non-replaced inline box.
                  className={`${
                    reveal === "scroll" ? "stagger-char-scroll" : "stagger-char"
                  } inline-block`}
                  style={
                    reveal === "scroll"
                      ? {
                          animationRange: `cover ${start}% cover ${
                            start + scrollSpan
                          }%`,
                        }
                      : { animationDelay: `${delay + index * stagger}ms` }
                  }
                >
                  {char}
                </span>
              );
            })}
          </span>{" "}
        </Fragment>
      ))}
    </Tag>
  );
}
