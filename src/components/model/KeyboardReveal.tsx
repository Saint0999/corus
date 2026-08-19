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
 * vignette closes the whole thing back down into the page.
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
const EXPOSURE_DIM = 0.5;
const EXPOSURE_LIT = 0.92;

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
 * Edge falloff, as a fraction of the surface's own lit colour removed where it
 * turns fully away from the camera, and the curve it is ramped in on. This is
 * deliberately the OPPOSITE of a physical fresnel rim — the point is to take
 * the silhouette down towards the background rather than to light it up, so
 * the board dissolves into the page at its edges.
 */
const EDGE_FALLOFF = 0.55;
const EDGE_POWER = 2.2;

/**
 * The case, restyled to matte silver.
 *
 * The .glb ships the shell as a near-white aluminium that measures within a
 * few points of the off-white keycaps, so on a dark page the board reads as
 * one undifferentiated slab. Dropping the shell's value and cooling it puts a
 * clear step between case and keycaps — the keycaps themselves are left
 * exactly as authored. High roughness with the metalness kept mid keeps it
 * MATTE: a bead-blasted anodised finish, not chrome.
 *
 * Named materials, not mesh names: `aluminium-silver` is the case shell, the
 * right-hand shelf and the USB-C bezel, which is precisely the run of surfaces
 * meant to change together.
 */
const CASE_MATERIAL = "aluminium-silver";
const CASE_COLOR = "#8b9199";
const CASE_METALNESS = 0.52;
const CASE_ROUGHNESS = 0.62;

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
  const near = useNearViewport(sectionRef);

  return (
    // `overflow-hidden` is load-bearing: the line field's box is deliberately
    // bigger than the section and rotated inside it, and this is what keeps
    // the overhang off the sections either side.
    <section
      ref={sectionRef}
      className="relative h-[74svh] overflow-hidden"
    >
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
          <ReactiveLinesBackdrop
            className="pointer-events-none absolute -inset-x-[14%] bottom-[10%] h-[150%] -rotate-[8deg]"
            // Thinned right down from the hero's 108/15. The hero runs the
            // field at full density behind a full-bleed product where it reads
            // as texture; here it is a horizon behind a floating object, and
            // at that density the curves compete with the keycap rows for the
            // same attention.
            minLines={42}
            maxLines={10}
          />

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
              />
            </Suspense>
          </Canvas>
        </>
      )}

      {/* Vignette. A CSS gradient rather than a post-processing pass: it is
          free, it is resolution-independent, and it composites against the
          page's own black instead of a second one. It sits ABOVE the canvas
          and is `pointer-events-none`, so it darkens without intercepting
          anything. The centre stop is wide enough to leave the keycaps and
          the screen untouched — only the far ends of the board and the empty
          corners are pulled down. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 78% 62% at 50% 50%, transparent 0%, " +
            "rgba(0,0,0,0.35) 62%, rgba(0,0,0,0.8) 84%, #000 100%)",
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
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  progressRef: React.RefObject<number>;
  fadeRef: React.RefObject<number>;
  glowRef: React.RefObject<HTMLDivElement | null>;
}) {
  const invalidate = useThree((state) => state.invalidate);

  useScrollProgress(sectionRef, progressRef, fadeRef, glowRef, invalidate);

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
    const lit = EXPOSURE_DIM + (EXPOSURE_LIT - EXPOSURE_DIM) * tilt(progressRef);
    state.gl.toneMappingExposure = lit * fadeRef.current;
  });

  return (
    <>
      {/* Lighting. Every material in the file is dielectric or near enough
          (metalness tops out at 0.32), so punctual lights carry it and the
          environment below is there for the specular roll-off on the
          anodised case rather than to make the metal exist at all. */}
      <ambientLight intensity={0.22} />
      {/* Key: high and camera-left, so the keycap tops catch it while the
          board is still tilted. */}
      <directionalLight position={[-4, 6, 5]} intensity={1.9} />
      {/* Fill: opposite side, weak, keeps the shadow side off pure black. */}
      <directionalLight position={[5, 1, 4]} intensity={0.5} />
      {/* Rim: behind and above, draws the top edge of the case out of the
          page once the board is standing up. */}
      <directionalLight position={[0, 3, -6]} intensity={1.1} />

      {/* Rendered into a cubemap once, on mount — no HDR is fetched, so this
          costs one small offscreen pass and nothing over the network. */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          intensity={1.4}
          position={[0, 3, 2]}
          scale={[8, 3, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={0.6}
          position={[-4, 0, 2]}
          scale={[3, 6, 1]}
          color="#cdea1b"
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
        matteSilverCase(one);
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
 * Restyles the case shell to matte silver, and only the case shell — every
 * keycap material is left exactly as it was authored.
 *
 * Like `edgeFalloff` below, this runs against materials that come out of
 * useGLTF's shared cache, so it is written to be idempotent: re-applying the
 * same three values on a remount is a no-op rather than a drift.
 */
function matteSilverCase(material: Material) {
  if (material.name !== CASE_MATERIAL) return;
  if (!(material instanceof MeshStandardMaterial)) return;

  material.color = new Color(CASE_COLOR);
  material.metalness = CASE_METALNESS;
  material.roughness = CASE_ROUGHNESS;
  // The environment is two lightformers rather than a real studio, so the
  // silver needs the reflection pushed a little to read as metal at all.
  material.envMapIntensity = 1.25;
}

/**
 * Patches a few lines into a material's fragment shader that darken the
 * surface as it turns away from the camera.
 *
 * This is the "too bright against the black" fix that a vignette alone cannot
 * do: the vignette works in screen space and knows nothing about the object,
 * so it cannot tell the middle of the spacebar from the case edge beside it.
 * This works in surface space — the further a fragment's normal leans away
 * from the viewer, the more of its lit colour is taken off, so every edge of
 * the board rolls down into the page while the faces that are square-on to
 * the reader keep their full value.
 *
 * `geometryNormal` and `geometryViewDir` are three's own view-space variables,
 * set up by <lights_fragment_begin> and still in scope at <opaque_fragment>,
 * where `outgoingLight` is the final lit colour before tone mapping. Patching
 * BEFORE tone mapping is what makes the falloff grade smoothly with everything
 * else rather than fighting the ACES curve after it.
 *
 * Materials come out of useGLTF's cache, which is shared and outlives this
 * component, so the patch is flagged and applied exactly once — running
 * `onBeforeCompile` twice would inject the same block twice and fail to
 * compile.
 */
function edgeFalloff(material: Material) {
  if (material.userData.corusEdgeFalloff) return;
  material.userData.corusEdgeFalloff = true;

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      float corusEdge = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
      outgoingLight *= mix(
        1.0,
        1.0 - ${EDGE_FALLOFF.toFixed(3)},
        pow( corusEdge, ${EDGE_POWER.toFixed(3)} )
      );

      #include <opaque_fragment>
      `,
    );
  };

  material.needsUpdate = true;
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
  }, [sectionRef, progressRef, fadeRef, glowRef, invalidate]);
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
