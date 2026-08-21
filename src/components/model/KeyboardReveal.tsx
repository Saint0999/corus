"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  Group,
  MathUtils,
  Material,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { ReactiveLinesBackdrop } from "@/components/hero/ReactiveLinesBackdrop";
import { edgeFalloff } from "@/components/model/edgeFalloff";

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
 * An off-white board on true black is a hard thing to look at: with nothing
 * else lit on the page, the eye reads the keycaps as a light source rather
 * than an object. Two things pull it back, neither of them a post-processing
 * pass (which would mean a second full-screen render every frame):
 *
 *  - The lighting is tuned DOWN and the whole canvas is graded through ACES
 *    tone mapping, so the highlights on the keycaps roll off instead of
 *    clipping to paper white.
 *  - Every material gets a few lines of shader patched into it that darken
 *    the surface as it turns away from the camera, so the silhouette falls
 *    off into the page instead of ending on a hard bright edge (see
 *    `edgeFalloff`).
 *
 * Performance notes, because a WebGL canvas on a scrolling page is the easy
 * way to make a whole site feel heavy:
 *
 *  - `frameloop="demand"`. The default render loop draws 60 times a second
 *    forever, whether or not anything moved. Here nothing moves except on
 *    scroll, so frames are requested explicitly and an idle canvas costs zero
 *    GPU. This is the single most important line in the file.
 *  - Scroll progress is written to a ref inside a rAF, never to React state.
 *    No component re-renders while scrolling; the value is read by the frame
 *    that the same scroll handler asked for.
 *  - The canvas is only mounted once the section is anywhere near the
 *    viewport (see `useNearViewport`), so the 1.5 MB model is not fetched and
 *    no GL context exists for a reader who never scrolls this far.
 */

/** Where the model sits in its own file: flat, top face up, ~33 cm wide. */
const MODEL_URL = "/models/corus-keyboard.glb";

/**
 * Rotation about X, in degrees. 0 is flat on a desk, 90 is face-on.
 *
 * The entry angle is far enough over to catch the sides of the keycaps and
 * read as an object with real depth, and stops short of the point where the
 * board is looked at edge-on and the layout stops being legible.
 */
const TILT_START = 64;
const TILT_END = 90;

/**
 * The model is normalised so its longest edge is this many world units, which
 * makes everything downstream independent of what units the .glb happens to be
 * authored in — swap in a re-export at a different scale and nothing here
 * changes. The board is then scaled off this by the framing below; this is a
 * reference length, not a size.
 */
const MODEL_SPAN = 3.2;

/**
 * Framing. The board is sized to the VIEWPORT every render, not to a fixed
 * scale with a ceiling — a fixed scale is why it read as a stamp on a large
 * display and as a crop on a phone.
 *
 * Two limits, and the tighter one wins:
 *
 *  - `FRAME_WIDTH`: the fraction of the visible width the board may span. This
 *    is what governs on anything from a phone up to a normal laptop, where the
 *    frame is not much wider than it is tall.
 *  - `FRAME_HEIGHT`: the fraction of the visible height the board may occupy
 *    once it is STANDING UP, which is when it is at its tallest on screen. On
 *    a wide or ultrawide display the width limit alone would size the board
 *    past the top of the frame, so this is what takes over there. The lift is
 *    part of the sum because the board is not centred (see MODEL_LIFT) — it is
 *    the raised top edge that runs out of room first.
 */
const FRAME_WIDTH = 0.82;
const FRAME_HEIGHT = 0.86;

/**
 * The board's on-screen height when erect, as a fraction of its width. Only a
 * starting value: it is measured off the real geometry on mount, and this is
 * what the first frame is framed with in the meantime.
 */
const DEFAULT_ASPECT = 0.39;

/**
 * How far above the centre of the canvas the board sits, in world units. The
 * pinned box is a whole viewport tall and the board is a wide, shallow object,
 * so dead-centring it leaves it low against the line field below — this lifts
 * it clear of the horizon and gives the composition its weight in the upper
 * half, where the eye already is coming off the paragraph above.
 */
const MODEL_LIFT = 0.45;

/**
 * Exposure the scene is graded at across the reveal: dim on the way in, up to
 * `LIT` by the time the board is square to the camera. The board lighting UP
 * as it stands up is what ties the two halves of the move together — a board
 * that stood up at a constant value read as a rotating object, not a reveal.
 *
 * Both ends stay below 1 on purpose: the keycaps are near-white plastic and
 * the page behind them is #000, and at 1.0 the highlights clip and the board
 * glares.
 */
const EXPOSURE_DIM = 0.52;
const EXPOSURE_LIT = 1.0;

/**
 * How far through the section's travel the board finishes standing up, where 0
 * is the section's top touching the bottom of the viewport and 1 is its bottom
 * leaving the top. 0.5 puts the square-on pose exactly where the section is
 * centred on screen — the board is done turning at the moment the reader is
 * looking straight at it, and holds that pose on the way out.
 */
const TILT_UNTIL = 0.5;

/**
 * The fade window, as fractions of the viewport height: the board starts
 * lifting out of the black when the section's top edge has risen to 90% of the
 * way down the screen, and has fully arrived by the time that edge reaches
 * 35%. It closes early on purpose — the fade is the board turning up, and the
 * brightening that follows is the board being LOOKED at.
 */
const FADE_START = 0.9;
const FADE_END = 0.35;

/**
 * The vignette lifts a little once the board is square to the camera: the
 * frame is doing its job while the board is turning — holding the eye in the
 * middle — and the moment the pose settles it gets out of the way so the ends
 * of the board and the line field behind it come back up.
 *
 * `HOLD` is the fraction of the stand-up it stays at full strength for, so the
 * lift reads as a beat AFTER the rotation rather than as something fading the
 * whole way through it. `DROP` is how much of it goes.
 */
const VIGNETTE_HOLD = 0.78;
const VIGNETTE_DROP = 0.3;

/**
 * The grade.
 *
 * One table, keyed by the .glb's own MATERIAL names — not mesh names, because
 * a material is exactly the run of surfaces that is meant to change together
 * (`aluminium-silver` is the shell, the right-hand shelf and the USB-C bezel;
 * `plastic-black` is both knobs, the screen bezel and the port cavity).
 *
 * What it is grading TOWARDS is the cinematic product render: warm titanium
 * case, creamy caps, terracotta accents, machined gunmetal knobs. The board as
 * authored is cooler and flatter than that on every surface, and the fix is
 * the same one in each row — take the blue out of the albedo, and let
 * roughness rather than colour decide how much light each surface returns.
 *
 * Three notes on the numbers, because they are the ones that are easy to get
 * backwards in three's flavour of PBR:
 *
 *  - `metalness` is not a gloss slider. It is a yes/no about what the surface
 *    IS, and a value in between is only ever a fudge for a coating. The caps
 *    and the accents are plastic, so they are 0 — the old 0.3 on the caps was
 *    buying a highlight at the cost of the diffuse that makes cream read as
 *    cream. Gloss is `roughness`, which is what carries it now.
 *  - The metals (case, knobs) go the other way and commit: past ~0.6 a surface
 *    stops having a diffuse to fall back on, so what it looks like is entirely
 *    what it can see. That is what `envMapIntensity` is for here, and it is
 *    why the metals carry the high values in the table.
 *  - Everything is authored in sRGB hex and `Color` converts on assignment
 *    (three's colour management is on by default), so these are the numbers
 *    an eyedropper on the reference would report — not linear values.
 */
const GRADE: Record<
  string,
  {
    color: string;
    metalness: number;
    roughness: number;
    env: number;
    emissive?: string;
    emissiveIntensity?: number;
  }
> = {
  // Case shell. Cool light titanium.
  //
  // This has been round the houses. It started at #8b9199, a blue-grey, which
  // on a black page beside near-white caps was the single thing that made the
  // render read as CG. The correction went to #ababa3 — and overshot: red and
  // green level with blue eight points under them is not a warm silver, it is
  // a khaki, and the board read olive.
  //
  // #a8abaf is the middle of those two. It sits four points to the COOL side
  // of neutral rather than fourteen, which is the difference between anodised
  // aluminium under a daylight lamp and a blue plastic prop. Green above red
  // is what takes the khaki out; the spread across the three channels is seven
  // points, where #8b9199 spent fourteen, so it stays a grey rather than
  // becoming a colour.
  //
  // Roughness stays at the bead-blasted 0.36 so the top rail keeps the long
  // soft highlight down its left edge.
  "aluminium-silver": {
    color: "#a8abaf",
    metalness: 0.6,
    roughness: 0.36,
    env: 1.5,
  },

  // Alphanumerics. Off-white PBT with a semi-matte sheen, a couple of points
  // to the cool side of neutral — dye-sub PBT in daylight, rather than the
  // cream #ece9e1 was. Cream is what a warm room does TO a white cap, and
  // baking it into the base colour meant the caps carried the room twice: once
  // here and again in everything they reflected. Metalness back to 0 — see the
  // note above — and the sheen moved into roughness, which keeps the legends
  // dark instead of greying them out the way a metal fresnel does.
  "keycap-offwhite": {
    color: "#e9eaed",
    metalness: 0,
    roughness: 0.42,
    env: 1.15,
  },

  // Esc and the arrow cluster. The .glb's #d84a24 is a signal orange; the
  // reference is terracotta — the same hue rotated a few degrees to the red
  // and dropped in value, so it reads as a deep pigment under a warm light
  // rather than as a saturated swatch. Lower roughness than the off-white
  // caps: the accents in the reference are visibly glossier than their
  // neighbours.
  "keycap-orange": {
    color: "#a8401d",
    metalness: 0,
    roughness: 0.34,
    env: 1.25,
  },

  // The small accent hardware — power nub, indicator dots. Half a step
  // brighter than the caps so it still registers at that size.
  "accent-orange": {
    color: "#b4441f",
    metalness: 0,
    roughness: 0.32,
    env: 1.25,
  },

  // Both knobs, their caps, and the screen bezel. Flat black in the .glb;
  // machined dark gunmetal here. This is the one row where metalness is doing
  // the whole job: a knob is only ever as interesting as the highlight running
  // round its knurl, and at 0.88/0.30 the environment panels below draw that
  // edge out of the dark instead of leaving a black cylinder.
  "plastic-black": {
    color: "#46464a",
    metalness: 0.8,
    roughness: 0.28,
    env: 2.6,
  },

  // The plate under the caps. Stays near-black — it is a hole, not a surface —
  // and now tracks the caps instead of leaning against them: a few points cool,
  // the same way they are, so the gaps read as shadow rather than as a
  // different material.
  "switch-plate": {
    color: "#292a2d",
    metalness: 0.35,
    roughness: 0.55,
    env: 1,
  },

  // Inner floor and bottom weight. Barely seen from the front, graded only so
  // it belongs to the shell above it — which now means a touch cool rather
  // than a touch warm.
  "aluminium-gunmetal": {
    color: "#46484c",
    metalness: 0.7,
    roughness: 0.45,
    env: 1.4,
  },

  // The display. Its gradient is a texture, so the colour cannot be replaced
  // here — but the emissive it is multiplied by can, and a warm cream tint is
  // what turns the authored white-to-orange ramp into the amber-to-white GLOW
  // the reference has. Kept just above 1: the screen is the brightest thing on
  // the board and the only emissive surface on it, and past about 1.4 it
  // blooms through the ACES curve and takes the bezel with it.
  "screen-display": {
    color: "#ffffff",
    metalness: 0,
    roughness: 0.22,
    env: 1,
    emissive: "#ffd9a8",
    emissiveIntensity: 1.25,
  },
};

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

          <Canvas
            // See the note above: the whole design of this component hangs
            // off rendering on demand.
            frameloop="demand"
            camera={{ position: [0, 0, 6], fov: 30 }}
            // `alpha` is what lets the line field below show through — the
            // canvas paints the board and nothing else.
            //
            // ACES is what keeps the near-white keycaps from clipping; the
            // exposure starts at 0 so the very first frame is already black
            // and the board fades up from nothing rather than blinking in.
            gl={{
              antialias: true,
              alpha: true,
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 0,
            }}
            // Capped at 2: a 3x phone would render nine times the pixels of
            // a 1x screen for a difference nobody can see on a 6-inch panel.
            dpr={[1, 2]}
            className="!absolute inset-0 z-[2]"
          >
            <Suspense fallback={null}>
              <Scene
                sectionRef={sectionRef}
                progressRef={progressRef}
                fadeRef={fadeRef}
                glowRef={glowRef}
                vignetteRef={vignetteRef}
              />
            </Suspense>
          </Canvas>
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

          Its opacity is written by the scroll rAF — see VIGNETTE_HOLD. */}
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

function Scene({
  sectionRef,
  progressRef,
  fadeRef,
  glowRef,
  vignetteRef,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  progressRef: React.RefObject<number>;
  fadeRef: React.RefObject<number>;
  glowRef: React.RefObject<HTMLDivElement | null>;
  vignetteRef: React.RefObject<HTMLDivElement | null>;
}) {
  const invalidate = useThree((state) => state.invalidate);

  useScrollProgress(
    sectionRef,
    progressRef,
    fadeRef,
    glowRef,
    vignetteRef,
    invalidate,
  );

  // Both the entry fade and the brighten-as-it-stands-up are done with
  // EXPOSURE, not with material opacity. Fading a hundred-odd opaque meshes by
  // turning them transparent means depth sorting them against each other for
  // the length of the fade, and the inside of the case shows through the
  // keycaps while it runs. Grading the whole frame costs nothing, has no
  // sorting to get wrong, and against a black page is indistinguishable from
  // the object itself fading — the emissive screen included, which a
  // material-opacity fade would leave glowing.
  //
  // The two multiply rather than compete: the fade decides whether the board
  // is there at all, the tilt decides how brightly it is lit once it is.
  //
  // The renderer is taken off the frame state rather than out of `useThree`
  // at render time: it is being written to, and a value a hook handed back is
  // not this component's to mutate.
  useFrame((state) => {
    const lit =
      EXPOSURE_DIM + (EXPOSURE_LIT - EXPOSURE_DIM) * tilt(progressRef);
    state.gl.toneMappingExposure = lit * fadeRef.current;
  });

  return (
    <>
      {/* Lighting. Every material in the file is dielectric or near enough
          (metalness tops out at 0.32), so punctual lights carry it and the
          environment below is there for the specular roll-off on the
          anodised case rather than to make the metal exist at all. */}
      {/* The rig is DAYLIGHT now, not a warm room.
 
          A metal is mostly whatever it can see, and the case is metallic at
          env 1.5 — so the lights here decide its colour more than its own
          base colour does. That is why cooling the material table alone was
          never going to be enough, and why the last pass, which pulled each
          source back by a third and stopped there, left the board still
          sitting in amber: five warm sources at two thirds strength are still
          five warm sources.

          So the balance is inverted instead of trimmed. Ambient, the broad
          environment panel and the rim all cross to the cool side, and the
          screen's amber spill — the single biggest warm contributor, because
          it is the one saturated thing the case can see — is halved in
          intensity and lifted towards cream.

          What is deliberately KEPT is the split: the key stays on the warm
          side of neutral and the fill stays cool. That opposition is most of
          what reads as photographic rather than lit, and it survives being
          moved wholesale towards daylight — it is the DIFFERENCE between the
          two that does the work, not where the pair sits. The key's warmth is
          down from twenty-two points of red-over-blue to seven; the fill's
          coolness goes the other way, from twenty-five to thirty-eight, and
          up in intensity, so the gap is wider than before while the average of
          the two lands cool. */}
      {/* Ambient is TINTED and low. On a black page it is the one light with
          nowhere to fall off, so it is the fastest way to flatten a render —
          but a few points of it in the key light's own colour is what stops
          the shadow side going blue by default. */}
      <ambientLight intensity={0.14} color="#fafcff" />
      {/* Key: high and camera-left, so the keycap tops catch it while the
          board is still tilted. Still the warm half of the split, but barely —
          a hair off white rather than the 5000K lamp it was. It is the light
          doing the grading, so every point taken out of it comes off every
          surface in the table above at once. */}
      <directionalLight position={[-4, 6, 5]} intensity={2.1} color="#fdfaf6" />
      {/* Fill: opposite side, weak, keeps the shadow side off pure black —
          and deliberately COOL against a warm key. That split is most of what
          reads as photographic rather than lit; a warm fill under a warm key
          just raises the black point. */}
      <directionalLight position={[5, 1, 4]} intensity={0.55} color="#c4d3ea" />
      {/* Rim: behind and above, draws the top edge of the case out of the page
          once the board is standing up. Crossed over to cool — at intensity
          1.15 it is the second strongest source here, and it lands on the one
          part of the case that is nothing BUT a highlight, so a warm rim was
          putting amber on the exact edge that should read as machined metal. */}
      <directionalLight
        position={[0, 3, -6]}
        intensity={1.15}
        color="#eff3fa"
      />

      {/* Rendered into a cubemap once, on mount — no HDR is fetched, so this
          costs one small offscreen pass and nothing over the network. */}
      <Environment resolution={128} frames={1}>
        {/* The broad one, above and in FRONT of the board. Square-on, this is
            what the polished caps actually reflect — the sheen across their
            faces is this panel, not a directional light, which is why it is
            worth its size and intensity. */}
        <Lightformer
          intensity={2.2}
          position={[0, 3.2, 2.5]}
          scale={[10, 5, 1]}
          color="#f8fbff"
        />
        {/* Low and camera-right, in the screen's own amber, roughly where the
            display sits on the board. It is not lighting the screen — the
            screen is emissive and lights itself — it is the SPILL that a real
            display would throw onto the shelf and the knobs beside it, which
            is what ties the one hot object on the board into the rest of it.

            This replaced a chartreuse panel that put the brand's accent green
            into the environment, and then became the same problem in the other
            direction: it is the one SATURATED thing in the rig, the case is
            metallic, and so the case wore it. Halved in intensity and lifted
            from amber towards cream, it still reads as a display throwing light
            on the shelf beside it without grading the whole board. */}
        <Lightformer
          intensity={0.34}
          position={[3.4, -1.2, 2.2]}
          scale={[3, 4, 1]}
          color="#ffd6ae"
        />
      </Environment>

      <Board progressRef={progressRef} />
    </>
  );
}

function Board({ progressRef }: { progressRef: React.RefObject<number> }) {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef = useRef<Group>(null);

  /**
   * The board's own proportions, measured on mount: its erect on-screen height
   * as a fraction of its width. Held in state rather than a ref because the
   * framing below is computed during render and has to re-run when it lands.
   */
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);

  // The visible world at the model's depth, in the same units MODEL_SPAN is.
  // r3f recomputes this whenever the canvas resizes, so the board re-frames
  // itself on a window drag with no listener of our own.
  const viewport = useThree((state) => state.viewport);

  // The two limits from FRAME_WIDTH / FRAME_HEIGHT, resolved into one span.
  // The height limit is solved for the board's top edge: the board sits
  // MODEL_LIFT above centre and stands half its own height above that, and
  // all of it has to stay inside the allowed fraction of the frame.
  const widthLimit = viewport.width * FRAME_WIDTH;
  const heightLimit =
    ((viewport.height * FRAME_HEIGHT) / 2 - MODEL_LIFT) * (2 / aspect);
  const fit = Math.max(0, Math.min(widthLimit, heightLimit)) / MODEL_SPAN;

  // Recentre and normalise the imported scene once. The .glb is modelled
  // around its own origin in metres with a slight authoring tilt baked into
  // the root node; measuring it here means the component never hard-codes a
  // number that only holds for one export of one model.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Measured DETACHED, with the transforms below wound back to identity.
    // `Box3.setFromObject` works in world space, so a scene still parented to
    // this group would be measured through the group's own fit scale and
    // rotation — normalising against that cancels the fit out exactly, and
    // the board is sized to the viewport it is already being scaled to fit.
    // Off the graph, "world" is the model's own space, which is what the
    // normalisation is defined in.
    const parent = scene.parent;
    parent?.remove(scene);
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);

    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    const scale = MODEL_SPAN / Math.max(size.x, size.y, size.z);
    scene.scale.setScalar(scale);
    // Applied after the scale, so it is in the same space the offset is
    // measured in — the model's centre lands exactly on the pivot, and the
    // board therefore rotates about itself rather than swinging around a
    // corner.
    scene.position.copy(center).multiplyScalar(-scale);

    // Erect, the board's height on screen is its DEPTH (z), not its own y —
    // it has been rotated a quarter turn towards the camera by then. That is
    // the proportion the height limit above is solved against.
    setAspect(size.z / Math.max(size.x, size.y, size.z));

    parent?.add(scene);

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material: Material | Material[] = object.material;
      for (const one of Array.isArray(material) ? material : [material]) {
        grade(one);
        edgeFalloff(one);
      }
    });
  }, [scene]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const eased = tilt(progressRef);
    group.rotation.x = MathUtils.degToRad(
      TILT_START + (TILT_END - TILT_START) * eased,
    );
  });

  return (
    <group ref={groupRef} position={[0, MODEL_LIFT, 0]} scale={fit}>
      <primitive object={scene} />
    </group>
  );
}

/**
 * Applies the grade above to one material, if it is named in it.
 *
 * Absolute values, never deltas, and every field written every time: these
 * materials come out of useGLTF's shared cache, which outlives this component,
 * so a remount re-runs this against materials it has already graded. Setting
 * `roughness = roughness * 0.8` would compound; setting it to a number cannot.
 *
 * Anything not in the table — the rubber feet, the engraving floor — is left
 * exactly as authored. Silence is the default on purpose: a fallback grade
 * would quietly restyle whatever a future export happens to add.
 */
function grade(material: Material) {
  const target = GRADE[material.name];
  if (!target) return;
  if (!(material instanceof MeshStandardMaterial)) return;

  // The base colour MULTIPLIES the base-colour texture where there is one, so
  // on the caps this tints the moulding without touching the legends printed
  // into it, and on the screen it is left white so the display's own gradient
  // comes through unaltered.
  material.color = new Color(target.color);
  material.metalness = target.metalness;
  material.roughness = target.roughness;
  material.envMapIntensity = target.env;

  if (target.emissive) {
    material.emissive = new Color(target.emissive);
    material.emissiveIntensity = target.emissiveIntensity ?? 1;
  }
}

/**
 * How far through the stand-up the board is, 0..1, from the section's travel.
 *
 * Read by BOTH the rotation and the exposure, from one place, so the board is
 * guaranteed to reach full brightness exactly as it reaches square-on — two
 * copies of this expression would be two things to keep in step by hand.
 *
 * Cubic ease-in-out. The raw scroll ratio is linear, which makes the board
 * start and stop dead; this eases both ends, and does it harder than the sine
 * curve it replaces — the cubic sits flatter at 0 and 1 and steeper through
 * the middle, so the board leans into the turn and settles out of it instead
 * of tracking the wheel one-to-one.
 *
 * The exposure ramp reads the same curve, so the brightening accelerates and
 * settles with the rotation rather than crossfading linearly underneath it.
 */
function tilt(progressRef: React.RefObject<number>) {
  const t = Math.min(1, progressRef.current / TILT_UNTIL);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Tracks how far through its pass across the viewport the section is, as
 * 0..1, plus the earlier entry fade, and asks for a frame whenever either
 * changes.
 *
 * `invalidate` is what pairs with `frameloop="demand"`: this is the only thing
 * in the component that ever causes a draw.
 */
function useScrollProgress(
  sectionRef: React.RefObject<HTMLElement | null>,
  progressRef: React.RefObject<number>,
  fadeRef: React.RefObject<number>,
  glowRef: React.RefObject<HTMLDivElement | null>,
  vignetteRef: React.RefObject<HTMLDivElement | null>,
  invalidate: () => void,
) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Reduced motion gets the destination, not the journey — the same
    // contract the hero video and the text reveals honour: the board is
    // simply already standing up, and fully lit.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      progressRef.current = 1;
      fadeRef.current = 1;
      if (glowRef.current) glowRef.current.style.opacity = "1";
      if (vignetteRef.current) {
        vignetteRef.current.style.opacity = String(1 - VIGNETTE_DROP);
      }
      invalidate();
      return;
    }

    let frame = 0;

    const measure = () => {
      frame = 0;

      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();

      // The section's whole pass across the screen, from its top touching the
      // bottom edge to its bottom clearing the top one. Derived from the live
      // rect rather than from the height in the class list, so editing one
      // does not silently desync the other.
      const travel = Math.max(1, rect.height + vh);
      progressRef.current = Math.min(1, Math.max(0, (vh - rect.top) / travel));

      // The fade is a separate, earlier window, measured off the top edge on
      // its way up the screen: the board is meant to already be present, dim,
      // by the time the tilt is doing anything interesting. Tying it to
      // `progress` instead would spend the reveal on the part of the pass
      // where the section is still mostly below the fold.
      const fadeTravel = Math.max(1, (FADE_START - FADE_END) * vh);
      fadeRef.current = Math.min(
        1,
        Math.max(0, (FADE_START * vh - rect.top) / fadeTravel),
      );

      // The glow rides the same value, written straight to the node: it is one
      // property on one element, and routing it through state would re-render
      // the whole subtree — canvas included — on every scroll frame.
      if (glowRef.current) {
        glowRef.current.style.opacity = String(fadeRef.current);
      }

      // The vignette holds at full strength for the whole turn and only lets
      // go over the last stretch of it, so the lift lands as the board squares
      // up rather than tracking the scroll the way everything else here does.
      if (vignetteRef.current) {
        const settled = Math.min(
          1,
          Math.max(
            0,
            (tilt(progressRef) - VIGNETTE_HOLD) / (1 - VIGNETTE_HOLD),
          ),
        );
        const eased = 0.5 - Math.cos(Math.PI * settled) / 2;
        vignetteRef.current.style.opacity = String(1 - VIGNETTE_DROP * eased);
      }

      invalidate();
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sectionRef, progressRef, fadeRef, glowRef, vignetteRef, invalidate]);
}

/**
 * True while the element is within a viewport of the fold, so the canvas —
 * and the model download behind it — is created just before it is needed and
 * not on page load.
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
      { rootMargin: "100% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, near]);

  return near;
}

useGLTF.preload(MODEL_URL);
