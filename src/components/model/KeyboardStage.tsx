"use client";

import { Suspense, useEffect, useRef, useState, type RefObject } from "react";
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
import { edgeFalloff } from "@/components/model/edgeFalloff";
import { MODEL_URL } from "@/components/model/modelUrl";

/**
 * The actual 3D board — everything that touches three.js, @react-three/fiber
 * or @react-three/drei. Split out of `KeyboardReveal.tsx` on purpose: that
 * file renders unconditionally on "/", and a static import of this module
 * from there would put the whole three.js stack (and the 1.5 MB model this
 * file preloads) in every homepage visitor's initial bundle — four screens
 * before any of it is needed. `KeyboardReveal.tsx` now pulls this component in
 * through a bare `import()` (NOT `next/dynamic` — see the note there for why
 * that distinction matters), so the chunk itself follows the reader rather
 * than arriving with the hero.
 *
 * Everything in this file is otherwise unchanged from before the split — see
 * `KeyboardReveal.tsx` for the composition this sits inside of, and the doc
 * comment there for the performance notes that still apply (`frameloop`
 * "demand", scroll progress written to refs rather than state, capped `dpr`).
 */

// The model file itself — flat, top face up, ~33 cm wide in its own space.
// Imported rather than declared here so <KeyboardReveal> can preload the same
// URL without importing this (three-heavy) module. See `modelUrl.ts`.

/**
 * Loader configuration, as `[useDraco, useMeshopt]` — passed identically to
 * `useGLTF` and to its `preload`, so both resolve to the same cache entry.
 *
 * Draco OFF. drei defaults it ON, and an enabled DRACOLoader points at a
 * `gstatic.com` CDN for its ~200 kB WebAssembly decoder. Nothing fetches it
 * while the model carries no Draco payload, but leaving it armed means one
 * re-export with the wrong exporter flag silently adds a third-party request
 * to the model's critical path. The build pipeline commits to meshopt (see
 * `scripts/optimize-model.mjs`), so say so here.
 *
 * Meshopt ON — which is also drei's default, but this file depends on it
 * rather than merely tolerating it: the served .glb is EXT_meshopt_compression
 * encoded and will not load without it. Its decoder is bundled inside
 * `three-stdlib`, already in this chunk, so it costs no request.
 */
const LOADER_ARGS = [false, true] as const;

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

type StageRefs = {
  sectionRef: RefObject<HTMLElement | null>;
  progressRef: RefObject<number>;
  fadeRef: RefObject<number>;
  glowRef: RefObject<HTMLDivElement | null>;
  vignetteRef: RefObject<HTMLDivElement | null>;
};

/**
 * The `<Canvas>` itself, plus the scene inside it. This is the component
 * `KeyboardReveal.tsx` loads through `next/dynamic` — see the note at the top
 * of this file for why it is not a plain import.
 */
export function KeyboardStage({
  sectionRef,
  progressRef,
  fadeRef,
  glowRef,
  vignetteRef,
}: StageRefs) {
  return (
    <Canvas
      // See the note at the top of this file: the whole design hangs off
      // rendering on demand.
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
  );
}

function Scene({
  sectionRef,
  progressRef,
  fadeRef,
  glowRef,
  vignetteRef,
}: StageRefs) {
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

function Board({ progressRef }: { progressRef: RefObject<number> }) {
  const { scene } = useGLTF(MODEL_URL, ...LOADER_ARGS);
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
  const invalidate = useThree((state) => state.invalidate);

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

    // Draw a frame now that there is actually something to draw.
    //
    // The canvas mounts at page load, but <Board> is inside <Suspense> and
    // `useGLTF` suspends until the .glb has landed, so the frame forced when
    // the scroll hook set up rendered an EMPTY scene — a GL context and not
    // much else. This is the frame that does the expensive half: compiling
    // the graded materials' programs (each one is a patched shader, see
    // `edgeFalloff`) and uploading the geometry and textures to the GPU.
    //
    // Under `frameloop="demand"` nothing would otherwise redraw here, because
    // the reader is not scrolling — they are still in the hero, which is
    // exactly the dead time this is meant to use.
    invalidate();
  }, [scene, invalidate]);

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
function tilt(progressRef: RefObject<number>) {
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
  sectionRef: RefObject<HTMLElement | null>,
  progressRef: RefObject<number>,
  fadeRef: RefObject<number>,
  glowRef: RefObject<HTMLDivElement | null>,
  vignetteRef: RefObject<HTMLDivElement | null>,
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

      // Draw ONLY while the section is somewhere on screen.
      //
      // This gate is what makes mounting the canvas at page load affordable.
      // The refs above are updated on every scroll frame regardless — they are
      // arithmetic on a rect and two writes to a style property, and keeping
      // them current means the first frame after the section appears is
      // already correct rather than a frame behind. What is skipped is the
      // WebGL draw, which is the part that actually costs something, and which
      // there is no reason to pay while the board is four screens away.
      //
      // Without this, a canvas mounted from load would re-render the board on
      // every scroll frame through the entire hero — handing straight back the
      // cost that mounting early was meant to save.
      if (rect.bottom > 0 && rect.top < vh) invalidate();
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    // Fill the refs for wherever the reader has actually landed (a reload
    // partway down the page, or a jump to an anchor), then force ONE frame
    // whether or not the section is on screen. That first frame is the point
    // of mounting early: it is what creates the GL context, compiles this
    // scene's shaders and uploads the geometry, so arriving at the section
    // later costs nothing but a redraw. It renders black — the exposure
    // starts at 0 and the fade has not begun — so warming up is invisible.
    measure();
    invalidate();
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
 * Warm drei's GLTF cache the moment this chunk executes, so the parse and the
 * GPU upload are done before <Board> ever mounts.
 *
 * This is NOT what gets the model off the network in good time — it cannot
 * be, since nothing here runs until the chunk it lives in has been fetched
 * and evaluated. `<KeyboardReveal>` preloads the bytes from the HTML for
 * that. By the time this line runs they are already in the preload cache and
 * this is a decode, not a download. Both are wanted; only one of them can
 * happen this late.
 */
useGLTF.preload(MODEL_URL, ...LOADER_ARGS);
