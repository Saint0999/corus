"use client";

import { Fragment, type ElementType, type ReactNode } from "react";

/**
 * Staggered entrance reveal: the copy is split into individual characters, each
 * of which resolves out of a heavy blur a beat after the one before it, so the
 * line reads as it comes into focus left to right.
 *
 * Use this for copy that is ON SCREEN AT LOAD — it fires once on mount. For
 * copy further down the page, reach for <ScrollRevealText> instead, which ties
 * the reveal to scroll position so it is not already over by the time the
 * reader arrives.
 *
 * Structure, from the outside in: words -> characters. The word wrapper is what
 * keeps the copy wrapping normally — a line can only break between words, and
 * splitting straight to characters would let a break land mid-word. The spaces
 * between words are real text nodes outside the animated spans, so they stay
 * break opportunities.
 *
 * The animation itself is pure CSS (`.stagger-char` in globals.css); the only
 * thing computed here is each character's `animation-delay`. No rAF loop, no
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
}: {
  segments: readonly Segment[];
  as?: ElementType<{ className?: string; children?: ReactNode }>;
  className?: string;
  /** Beat between consecutive characters, in ms. */
  stagger?: number;
  /** Delay before the first character, in ms — used to order two blocks. */
  delay?: number;
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
            {Array.from(word).map((char, i) => (
              <span
                key={i}
                // `inline-block` again: `filter` and `transform` do not apply
                // to a non-replaced inline box.
                className="stagger-char inline-block"
                style={{ animationDelay: `${delay + charIndex++ * stagger}ms` }}
              >
                {char}
              </span>
            ))}
          </span>{" "}
        </Fragment>
      ))}
    </Tag>
  );
}
