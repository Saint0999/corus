"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { preload } from "react-dom";
import { ReactiveLinesBackdrop } from "@/components/hero/ReactiveLinesBackdrop";
import { MODEL_URL } from "@/components/model/modelUrl";

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
 * this component mounts. It used to be a plain top-of-file import, which put
 * three.js, @react-three/fiber and @react-three/drei in the bundle every
 * reader of "/" downloads on first paint, four screens before any of it is
 * needed. Splitting the CODE out is still worth it even though the canvas is
 * now mounted at load: the chunk arrives on its own connection, in parallel,
 * instead of making the hero's own scripts queue behind a megabyte of
 * renderer.
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
 *  - The MODEL's bytes are fetched by the `preload()` call in the component
 *    body below, which is a `<link rel="preload">` in the server-rendered
 *    HTML — found by the browser's preload scanner before a line of our
 *    JavaScript has run, let alone hydrated.
 *  - The CODE chunk is fetched by the `import()` in the mount effect — the
 *    earliest point a Client Component gets to do anything. This used to wait
 *    for an idle callback (mirroring `<Anatomy>`'s key-switch stage), on the
 *    reasoning that nothing should compete with the hero's own first paint.
 *    But the `import()` call does not block the main thread — it only
 *    enqueues a network request for a chunk already code-split out of the
 *    critical bundle — so there was nothing here for the hero to compete
 *    WITH, and the idle wait was pure lost lead time: on a busy device
 *    `requestIdleCallback` can legitimately sit for its full 1500 ms timeout
 *    before firing, which is most of the runway a reader gets before reaching
 *    the board on an ordinary scroll.
 *
 *    Splitting those two apart is the whole point, and it is worth being
 *    precise about WHY, because getting it wrong is invisible in every
 *    profile taken on a fast connection. `KeyboardStage.tsx` ends with a
 *    module-scope `useGLTF.preload(MODEL_URL)`, and for a while that was the
 *    only thing fetching the model. Module scope means it runs when the
 *    module RUNS — so the sequence was: hydrate, then request the ~260 kB
 *    (gzipped) three.js chunk, then wait for it to arrive, then parse and
 *    execute it, and only THEN start asking for a ~300 kB model. Three
 *    dependent round trips deep, when nothing about the .glb depends on any
 *    of them: it is a static file at a URL known at build time. Measured
 *    against a production build on localhost — where transfer time is
 *    essentially zero and only the chaining shows — the chunk started at
 *    86 ms and the model not until 128 ms. Put that same chain on a phone
 *    connection and each link costs a round trip plus its transfer, which is
 *    how a model that used to be ready on arrival turns into one the reader
 *    watches load.
 *
 *    The `preload()` below cuts the model out of that chain entirely. It now
 *    starts in parallel with the page's own scripts, and `useGLTF.preload()`
 *    stays where it is: by the time the chunk executes, the bytes are already
 *    in the browser's preload cache, so it goes straight to decoding them.
 *  - The Canvas is MOUNTED as soon as that chunk resolves, at page load,
 *    with no scroll condition on it at all. It used to wait for a
 *    `useNearViewport` check, on the reasoning that GPU work (context
 *    creation, shader compilation, mesh upload) is a different cost from a
 *    network fetch and should not be paid by a reader who never scrolls this
 *    far. That is true as far as it goes, and it is beside the point: the
 *    reader who DOES scroll this far is the one the section exists for, and
 *    making them wait at the moment of arrival — for the exact work that
 *    could have been done while they read the hero — is the whole complaint.
 *    Warming everything at load means that by the time the board comes up the
 *    screen there is nothing left to do but draw a frame.
 *
 *    Mounting early would ordinarily hand back the cost it saves, because
 *    `useScrollProgress` invalidates the canvas on every scroll frame and a
 *    mounted canvas would therefore re-render the board through the whole
 *    hero. It does not, because that hook now skips `invalidate()` while the
 *    section is off screen — see the note on it in `KeyboardStage.tsx`. The
 *    canvas is warm from load and idle until it is looked at.
 *
 * Performance notes, because a WebGL canvas on a scrolling page is the easy
 * way to make a whole site feel heavy — see `KeyboardStage.tsx` for the ones
 * that live inside the canvas (`frameloop="demand"`, capped `dpr`, scroll
 * progress written to refs rather than state).
 */

export function KeyboardReveal() {
  /**
   * Start the model downloading from the HTML itself.
   *
   * Called during render, not in an effect, and that is the entire point:
   * this component is server-rendered as part of the static "/" document, so
   * React emits the hint as a `<link rel="preload">` in the streamed <head>.
   * The preload scanner acts on it while the HTML is still being parsed —
   * before hydration, before the `import()` in the effect below, and long
   * before anything three.js-shaped has been evaluated. The model's ~300 kB
   * then transfers alongside the page's own scripts instead of queueing
   * behind them.
   *
   * `as: "fetch"` because that is how the bytes are eventually asked for:
   * three's `FileLoader` runs a plain same-origin `fetch()` under
   * `useGLTF`. The `as` has to match the real request for the browser to hand
   * over the preloaded response rather than fetching the file a second time —
   * `as: "image"` or a bare hint would download 300 kB twice and be slower
   * than doing nothing at all.
   *
   * React dedupes by href, so calling this on every render costs one map
   * lookup and emits one tag. It is scoped to this component rather than the
   * layout on purpose: "/" is the only route that renders the board, and a
   * preload in the shell would pull the model down on /about and /features
   * too — the same trap `edgeFalloff.ts` was split out of the way of.
   */
  preload(MODEL_URL, { as: "fetch" });

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

  /**
   * The `<Canvas>` component itself, fetched as soon as this component mounts
   * and rendered the moment it lands — no scroll condition on either step.
   * See the note at the top of this file.
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

      {/* `null` only for the window between this component mounting and the
          chunk's fetch/parse landing — a fraction of a second at page load,
          four screens above where anyone can see it. By the time the section
          is reachable the canvas has long since mounted, drawn its first
          frame, and gone idle. */}
      {Stage && (
        <Stage
          sectionRef={sectionRef}
          progressRef={progressRef}
          fadeRef={fadeRef}
          glowRef={glowRef}
          vignetteRef={vignetteRef}
        />
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
