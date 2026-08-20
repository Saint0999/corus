"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { KeycapExploded } from "@/components/anatomy/KeycapExploded";
import { SwitchFocus } from "@/components/anatomy/SwitchFocus";
import { StaggeredText, type Segment } from "@/components/text/StaggeredText";
import { Container } from "@/components/ui/Container";
import { eyebrow } from "@/lib/styles";

/**
 * The anatomy section: the board taken apart, one part at a time.
 *
 * Replaces the old two-column spec table at the foot of the page. That table
 * asked the reader to scan twenty rows of label/value and work out for
 * themselves what any of it looked like; this asks them to pick a part and
 * look at it.
 *
 * Layout is a fixed pair: the list of parts on the left, the visual on the
 * right. The right-hand panel is deliberately EMPTY scaffolding for now — each
 * part gets its own visual treatment (renders, the exploded switch, the screen
 * running) and they are being built one by one. Everything about the panel
 * that is already settled — its box, its aspect, how it is labelled, how it
 * swaps when the selection changes — lives here, so adding a part's visual is
 * a matter of filling `PARTS[n].visual` rather than touching the layout.
 *
 * A Client Component because the selection is state. It is the whole point of
 * the section: nothing about it works as static markup.
 */

type Part = {
  /** The name in the list, and the caption on the panel. */
  name: string;
  /** One line under the name, only shown on the selected row. */
  detail: string;
  /**
   * The part's visual, if it has one yet. Rows without one fall back to the
   * placeholder panel — they are still being built.
   *
   * `visual` is for the ones that are LIVE — a canvas, a running screen —
   * rather than a still. It takes precedence over `image`; a part has one or
   * the other, never both.
   */
  image?: { src: string; alt: string };
  visual?: ReactNode;
};

/**
 * The six parts, in the order the reader meets them: the whole board first,
 * then down through what it is made of, ending on the screen — which is the
 * thing that makes this board different from every other board.
 *
 * The details are the surviving content of the old spec table. They are one
 * line each on purpose; a part that needs a paragraph needs a visual instead.
 */
const PARTS: readonly Part[] = [
  {
    name: "The Keyboard",
    detail: "CNC aluminium, anodized silver over gun metal",
    image: {
      src: "/media/anatomy/keyboard.webp",
      alt: "The Corus keyboard seen from directly above: silver aluminium case, light grey keycaps with an orange escape key and orange arrow cluster, two knobs and a colour screen at the right.",
    },
  },
  {
    name: "Keycaps",
    detail: "Dye sub PBT, uniform profile",
    // An element, not a component reference: this is a description of what to
    // render, and nothing is mounted until the row is the selected one.
    visual: <KeycapExploded />,
  },
  {
    name: "Switch",
    detail: "Tactile / 55g / two-stage spring / factory lubed",
    // Picks up where the row above leaves off — see the component.
    visual: <SwitchFocus />,
  },
  { name: "Knobs", detail: "ABS plastic, two of them, both programmable" },
  { name: "Screen Glass", detail: "CNC glass with an adhesive black film" },
  { name: "Screen", detail: "100×310 px full-colour LCD" },
] as const;

/** The label above the heading. */
const EYEBROW: readonly Segment[] = [{ text: "Anatomy" }] as const;

/** The section heading. Data rather than markup because <StaggeredText> has
 *  to break it into per-character spans to sweep it. */
const HEADING: readonly Segment[] = [
  { text: "Every part, on its own terms" },
] as const;

export function Anatomy() {
  const [active, setActive] = useState(0);
  const part = PARTS[active];

  return (
    <section className="pt-10 pb-28 sm:pt-14 sm:pb-36">
      <Container>
        {/* The eyebrow gets the heading's sweep too, and leads it: it starts
            a little earlier in the block's travel and steps faster, so seven
            letters at 9px are finished about when the heading's first
            characters are resolving. Same range for both would have a
            wide-tracked mono label crawling alongside a 44px serif. */}
        <StaggeredText
          segments={EYEBROW}
          className={eyebrow}
          reveal="scroll"
          scrollFrom={4}
          scrollStep={1.6}
          scrollSpan={11}
        />
        {/* The hero's per-character blur-resolve, on the scroll timeline
            rather than a timer — this heading is far below the fold, and a
            mount animation down here is over long before anybody arrives.
            `font-normal` walks back the 600 that globals.css puts on every h2:
            at display size the serif's hairlines are the point, and the
            heavier weight thickens them out of existence. The tracking and
            leading are the h1's for the same reason — this is display type,
            not a section label. */}
        <StaggeredText
          as="h2"
          segments={HEADING}
          className="mt-3 max-w-xl text-[2rem] font-normal leading-[1.04] tracking-[-0.03em] text-ink sm:text-[2.75rem]"
          reveal="scroll"
        />

        {/* The pair. `items-start` rather than `stretch` so the list keeps its
            natural height instead of stretching to match the panel, which
            would spread six rows over the height of a square. */}
        <div className="mt-12 grid items-start gap-10 sm:mt-16 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          {/* --- Left: the parts list ---------------------------------------
              Real <button>s in a list, not divs with click handlers: this is a
              set of choices, and buttons come with the keyboard and the focus
              ring already attached. */}
          <ul className="divide-y divide-line border-t border-b border-line">
            {PARTS.map((item, index) => {
              const isActive = index === active;

              return (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    aria-current={isActive ? "true" : undefined}
                    className="group flex w-full items-baseline gap-4 py-5 text-left"
                  >
                    {/* The index. Mono and small so it reads as a marker
                        rather than as part of the name. */}
                    <span
                      className={`font-mono text-[0.7rem] tabular-nums transition-colors duration-200 ${
                        isActive ? "text-accent" : "text-ink-muted/50"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-lg font-light tracking-[-0.01em] transition-colors duration-200 sm:text-xl ${
                          isActive
                            ? "text-ink"
                            : "text-ink-muted group-hover:text-ink"
                        }`}
                      >
                        {item.name}
                      </span>

                      {/* The detail line belongs to the selection, so it is
                          only rendered for the active row — six of these at
                          once turns the list back into the spec table this
                          section replaced. */}
                      {isActive && (
                        <span className="mt-1.5 block text-sm font-light text-ink-muted">
                          {item.detail}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* --- Right: the visual ------------------------------------------
              The slot each part's visual will be built into. `aspect-[4/3]`
              rather than a fixed height so the box keeps its shape at every
              width, and `overflow-hidden` because what lands in here will be
              full-bleed inside it (a canvas, a render) and should be cropped
              by the panel's own corners.

              On a narrow viewport this sits BELOW the list; the grid only
              splits into columns at `lg`, where there is room for a square
              beside a column of type. */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface-raised">
            {part.visual ? (
              /* Keyed like the image below, and for the same reason — but here
                 the remount is load-bearing rather than cosmetic: it is what
                 replays the come-apart, and it is also what releases the WebGL
                 context when the reader moves on to another part. */
              <div key={active} className="blur-fade-in absolute inset-0">
                {part.visual}
              </div>
            ) : part.image ? (
              /* `key` on the index, not the src: it is what makes React swap
                 the element rather than patch it, so the blur-in replays on
                 every change of part instead of only on first paint.

                 `object-contain` because these are cutouts on transparency —
                 the board is a 2.5:1 slab and cropping it to the panel would
                 cut the case off at both ends. */
              <Image
                key={active}
                src={part.image.src}
                alt={part.image.alt}
                fill
                sizes="(min-width: 1024px) 55vw, 90vw"
                // Above the 75 default: the cutout is a smooth grey slab with
                // a hairline chamfer running round it, and that edge is the
                // first thing a low-quality re-encode softens.
                quality={90}
                className="blur-fade-in object-contain p-4 sm:p-6"
              />
            ) : (
              /* Placeholder for the parts whose visuals are still being built.
                 It is here so an empty panel reads as "not yet" rather than as
                 a broken box, and it goes as the last one lands. */
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-muted/60">
                  {String(active + 1).padStart(2, "0")} — {part.name}
                </span>
                <span className="text-sm font-light text-ink-muted/40">
                  Visual to come
                </span>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
