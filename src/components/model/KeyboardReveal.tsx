"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { ReactiveLinesBackdrop } from "@/components/hero/ReactiveLinesBackdrop";

// A TYPE, not a value: `typeof import(...)` is erased entirely at compile
// time, so this line — unlike a real `import` of the module — does not pull
// three.js into this file's chunk. It exists only so the `import()` call
// inside the effect below and the state it fills can be typed.
type KeyboardStageComponent =
  (typeof import("@/components/model/KeyboardStage"))["KeyboardStage"];

/**
 * Scroll-driven 3D reveal of the board.
 *
 * The section scrolls with the page — it is NOT pinned. The board travels up
 * the viewport like everything else on the page, and the rotation is driven by
 * where the section has got to on its way through: it comes in tilted, stands
 * up square to the camera as it reaches the middle of the screen, and holds
 * that pose on its way out. Scroll-linked, not time-based — the same principle
 * as <ScrollRevealText> directly above it, so scrolling back up rewinds the
 * board and the reader sets the pace.
 *
 * The board also LIGHTS as it stands up: it arrives dim, out of the black, and
 * gains most of its exposure over the same stretch of scroll that squares it
 * to the camera, so the reveal reads as one move rather than a fade followed
 * by a rotation.
 *
 * The stack inside the section, back to front:
 *
 *   reactive lines -> glow -> 3D canvas -> vignette
 *
 * The lines are the same field the hero was built on, so the board lands on
 * the site's own backdrop rather than on a bare rectangle of black, and the
 * vignette closes the whole thing back down into the page — then lifts a
 * little the moment the board is square-on, once holding the eye in the middle
 * of the frame has stopped being the point.
 *
 * This file is deliberately THREE-FREE — the board, its lighting rig and its
 * material grade live in `KeyboardStage.tsx`, `import()`-ed below as soon as
 * this component mounts. It used to be a plain top-of-file import, and the
 * canvas itself was already gated behind `useNearViewport` — but a plain
 * import still puts three.js, @react-three/fiber and @react-three/drei in
 * the bundle every reader of "/" downloads on first paint, because React has
 * to evaluate the module to know what NOT to render while `near` is false.
 *
 * The obvious fix is `next/dynamic`, and it is the wrong one: Next's
 * build-time transform preloads a `dynamic()` component's chunk as soon as
 * its JSX reference exists ANYWHERE in the tree, regardless of any condition
 * it is wrapped in — the whole point of the split, undone in one line,
 * confirmed by watching the chunk request fire on a fresh load with no
 * scrolling. A plain `import()` has no such static reference for Next to
 * find, so it only ever runs when the code below actually calls it.
 *
 * FETCHING and MOUNTING are deliberately two separate triggers, not one:
 *
 *  - The `import()` itself fires the instant this component's mount effect
 *    runs — the earliest point a Client Component gets to do anything, and
 *    about as close to "preload on page load" as JavaScript can get. This
 *    used to wait for an idle callback (mirroring `<Anatomy>`'s key-switch
 *    stage), on the reasoning that nothing should compete with the hero's own
 *    first paint. But the `import()` call does not block the main thread —
 *    it only enqueues a network request for a chunk already code-split out
 *    of the critical bundle — so there was nothing here for the hero to
 *    compete WITH, and the idle wait was pure lost lead time: on a busy
 *    device `requestIdleCallback` can legitimately sit for its full 1500 ms
 *    timeout before firing, which is most of the runway a reader gets before
 *    reaching the board on an ordinary scroll. Firing immediately means the
 *    chunk and the 1.5 MB model are fetching from the first possible moment,
 *    maximising the chance both have landed before the reader scrolls this
 *    far — and it still costs a reader who closes the tab during the hero
 *    nothing worse than one wasted background request, not a blocked first
 *    paint.
 *  - The Canvas is still only MOUNTED once `near` is true (see
 *    `useNearViewport`) — GPU work (context creation, shader compilation) is
 *    a genuinely different cost from a network fetch, and there is no reason
 *    to pay it for a reader who never scrolls this far.
 *
 * Performance notes, because a WebGL canvas on a scrolling page is the easy
 * way to make a whole site feel heavy — see `KeyboardStage.tsx` for the ones
 * that live inside the canvas (`frameloop="demand"`, capped `dpr`, scroll
 * progress written to refs rather than state).
 */

export function KeyboardReveal() {
  const sectionRef = useRef<HTMLElement>(null);
  /**
   * How far the section has travelled through the viewport: 0 as its top
   * touches the bottom of the screen, 1 as its bottom clears the top. Read
   * during a frame, never rendered.
   */
  const progressRef = useRef(0);
  /** 0 while the board is still below the fold, 1 once it is fully up. */
  const fadeRef = useRef(0);
  /** The glow behind the board, faded in step with it by the same rAF. */
  const glowRef = useRef<HTMLDivElement>(null);
  /** The vignette, lifted by that same rAF once the board is square-on. */
  const vignetteRef = useRef<HTMLDivElement>(null);
  const near = useNearViewport(sectionRef);

  /**
   * The `<Canvas>` component itself. See the note at the top of this file:
   * fetched as soon as this component mounts, regardless of scroll position,
   * mounted only once `near` is true — two different triggers for two
   * different costs.
   */
  const [Stage, setStage] = useState<ComponentType<{
    sectionRef: React.RefObject<HTMLElement | null>;
    progressRef: React.RefObject<number>;
    fadeRef: React.RefObject<number>;
    glowRef: React.RefObject<HTMLDivElement | null>;
    vignetteRef: React.RefObject<HTMLDivElement | null>;
  }> | null>(null);

  useEffect(() => {
    // Guards against setting state after a fetch that lands post-unmount —
    // this component never unmounts in practice, but the pattern is cheap
    // insurance against a warning that costs nothing to avoid.
    let cancelled = false;

    // Fired the moment this effect commits — the earliest a Client Component
    // gets to run anything, and as close to "the instant the site loads" as
    // JavaScript can start a fetch. This used to wait for an idle callback,
    // on the reasoning that nothing should compete with the hero's own first
    // paint; the `import()` call itself does not block anything, though — it
    // only enqueues a network request, on a chunk already code-split out of
    // the critical bundle, so there is nothing here for the hero to compete
    // WITH. Waiting for idle was buying a guarantee nothing needed at the
    // cost of the board's own lead time.
    import("@/components/model/KeyboardStage").then(
      ({ KeyboardStage }: { KeyboardStage: KeyboardStageComponent }) => {
        if (!cancelled) setStage(() => KeyboardStage);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // `overflow-hidden` is load-bearing: the line field's box is deliberately
    // bigger than the section and rotated inside it, and this is what keeps
    // the overhang off the sections either side.
    <section ref={sectionRef} className="relative h-[74svh] overflow-hidden">
      {near && (
        <>
          {/* The hero's own line field, reused. It is opaque and repaints #000
              every frame, so it has to be the bottom layer — the 3D canvas
              above it is transparent and composites straight onto it.

              Its own box is the hero's, which is far too big here: the hero
              wants the field filling a whole viewport behind a full-bleed
              product, this wants a horizon UNDER one. So it gets a shorter box
              and a firm anticlockwise tilt, which lifts the right-hand end of
              the field and drops the left. The angle is large because the
              field's own curves are close to level through the middle of the
              box — a couple of degrees is lost in them and reads as no tilt at
              all. The sideways overscan is what keeps the rotated box running
              past both edges of the section instead of pulling its corners
              into view. */}
          {/* Softening layer. The field is drawn crisp, at one device pixel a
              line, and cut off square by the section's own edges — which is
              what made this block read as a panel sitting ON the page rather
              than as depth behind the board.

              Two things fix that, and both belong out here rather than in the
              vendored component:

               - A one-pixel BLUR. It is barely a blur at all on any single
                 line; what it does is take the aliased stair-stepping off a
                 field of near-horizontal curves, which is the actual source of
                 the roughness.
               - A vertical MASK that fades the field out at the top and bottom
                 of the section, so the curves dissolve instead of ending on a
                 straight edge. The fades are asymmetric: the top one is long
                 and starts immediately, because up there the field is only
                 texture behind the board, and the bottom one is short and late,
                 because the curves down there are the horizon the board floats
                 above and cutting into them takes the floor out.

              The mask is safe to hang on this layer precisely because the
              field's canvas paints opaque #000: what shows through where it is
              masked away is the page's own black, so the fade has no seam to
              give away. Putting the same mask on the SECTION would instead eat
              the top edge of the board, which sits only a few pixels below it.

              `overflow-hidden` here as well as on the section: the blur is a
              filter, and a filter on a box whose contents overhang it will
              happily bleed those contents past its edges. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{
              filter: "blur(1px)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, " +
                "rgba(0,0,0,0.45) 14%, #000 32%, #000 84%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, " +
                "rgba(0,0,0,0.45) 14%, #000 32%, #000 84%, transparent 100%)",
            }}
          >
            <ReactiveLinesBackdrop
              className="pointer-events-none absolute -inset-x-[14%] bottom-[10%] h-[150%] -rotate-[8deg]"
              // Thinned right down from the hero's 108/15. The hero runs the
              // field at full density behind a full-bleed product where it
              // reads as texture; here it is a horizon behind a floating
              // object, and at that density the curves compete with the keycap
              // rows for the same attention.
              minLines={42}
              maxLines={10}
            />
          </div>

          {/* Glow. One soft white ellipse behind the board — no colour, so it
              reads as light on the backdrop rather than as a tint. It sits
              between the line field and the canvas, which is what gives the
              board something to be silhouetted against: the curves behind it
              are lifted just enough to separate case from field, and the
              vignette then closes the same frame back down at the corners.
              Centred above the middle of the section because the board is
              (see MODEL_LIFT), so the light stays behind the object.

              Its opacity is written by the scroll rAF, off the same value as
              the board's own fade, so the two arrive together. */}
          <div
            ref={glowRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1] opacity-0"
            style={{
              background:
                "radial-gradient(ellipse 64% 38% at 50% 36%, " +
                "rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.055) 45%, " +
                "transparent 75%)",
            }}
          />

          {/* `null` for the brief window between `near` flipping and the
              chunk's fetch/parse landing — the backdrop and glow above are
              already up, so this reads as the board fading in a beat later
              rather than as anything missing. */}
          {Stage && (
            <Stage
              sectionRef={sectionRef}
              progressRef={progressRef}
              fadeRef={fadeRef}
              glowRef={glowRef}
              vignetteRef={vignetteRef}
            />
          )}
        </>
      )}

      {/* Vignette. A CSS gradient rather than a post-processing pass: it is
          free, it is resolution-independent, and it composites against the
          page's own black instead of a second one. It sits ABOVE the canvas
          and is `pointer-events-none`, so it darkens without intercepting
          anything.

          The ellipse is wide and its centre sits above the middle of the box,
          where the board does — a vignette centred on the box itself crushes
          the top corners, which are further from its centre than the bottom
          ones are once the board has been lifted. The outermost stop stops
          short of solid black for the same reason: the corners should settle
          INTO the page, not punch a hole darker than it.

          Its opacity is written by the scroll rAF — see VIGNETTE_HOLD in
          KeyboardStage.tsx. */}
      <div
        ref={vignetteRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 92% 78% at 50% 44%, transparent 0%, " +
            "rgba(0,0,0,0.16) 60%, rgba(0,0,0,0.46) 84%, rgba(0,0,0,0.74) 100%)",
        }}
      />
    </section>
  );
}

/**
 * True while the element is within a few hundred pixels of the fold, so the
 * CANVAS — the GPU context, the shader compiles, the mesh upload — is only
 * ever created just before it is needed, not on page load.
 *
 * This governs GPU work only, not the fetch any more (see the note at the
 * top of this file for why those two are now separate triggers). It still
 * matters on its own terms: mounting `<Canvas>` for a reader who is nowhere
 * near this section would hold a WebGL context and run its render loop for
 * no reason.
 *
 * `rootMargin` used to be a full extra viewport ("100% 0px"), which sounds
 * like the conservative choice and is actually the opposite of one: on this
 * page the hero is itself close to a full viewport tall, so a full extra
 * viewport of lead-in reaches back past the statement paragraph and covers
 * the fold ITSELF — this was mounting the canvas at scroll position zero, on
 * every ordinary screen, which is exactly what this hook exists to prevent.
 *
 * 320px is comfortably short of that: on every viewport height this was
 * checked against, the gap between the fold and this section's top is
 * 370–620px, so the section stays non-intersecting until the reader has
 * actually started scrolling towards it. By the time it does, the module
 * fetched on mount above has almost always already landed, so the mount
 * itself is the only cost left to pay — a GPU init, not a network round trip.
 *
 * It only ever flips false -> true. Tearing the context back down on the way
 * past would mean re-uploading every texture to the GPU on the way back, and
 * the reader is one flick of the wheel from doing exactly that.
 */
function useNearViewport(ref: React.RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, near]);

  return near;
}
