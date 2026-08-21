"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  type BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
} from "three";
import { MM } from "@/components/model/keyswitch/geometry";
import {
  KeySwitch,
  layerY,
  type PartName,
} from "@/components/model/keyswitch/KeySwitch";
import {
  CAMERA_Y,
  CAMERA_Z,
  ENTRANCE_MS,
  FAR,
  MODEL_SPIN,
  VIEW_HEIGHT,
  clamp01,
  easeOut,
  useApproach,
  useReveal,
  useStageFocus,
} from "@/components/anatomy/PartStage";
// The actual `<Canvas>` this stage renders into — kept in its own,
// three-dependent file. See the note at the top of PartCanvas.tsx.
import { PartStage } from "@/components/anatomy/PartCanvas";

/**
 * The key, taken apart and called out, and then the switch inside it — the
 * Anatomy panel's "Keycaps" AND "Switch" visuals, which are one stage.
 *
 * They were two, and two was wrong. A reader scrolling from Keycaps to Switch
 * was shown the exploded key leave the frame and a second, identical exploded
 * key arrive and come apart again, before the camera finally moved in on the
 * stem. The switch had been on screen the whole time; throwing it away and
 * rebuilding it to look at it more closely is not a zoom, it is a cut
 * pretending to be one.
 *
 * So the model stays. `focus` — 0 for the diagram, 1 for the close-up — is the
 * only thing that changes between the two parts, and every difference between
 * them is a function of it: the camera dollies in, the callouts go, the four
 * layers that are not the stem scatter and soften out of frame, and the colour
 * swatches resolve in behind them. Turning round halfway plays it backwards,
 * because it is a position rather than a sequence.
 *
 * The come-apart still plays, but only on ARRIVING at the pair. Moving between
 * its two halves is not an arrival.
 *
 * <KeySwitch> already models the five layers and already knows where each one
 * sits at a given explode value; everything here is the DIAGRAM built around
 * it: the framing, the come-apart, and the leader lines and labels that name
 * the parts. It is deliberately not a toy — there is no orbit and no slider.
 * The stack opens once, the labels resolve onto it, and then it holds still
 * and can be read. `/key-switch` remains the bench for poking at the part.
 *
 * Every anchor is derived from `layerY`, the same expression the meshes are
 * positioned by, so a label cannot drift off its part: change a layer's travel
 * in <KeySwitch> and its callout follows on the next render.
 *
 * The whole thing renders ON DEMAND. Nothing here loops — the come-apart is
 * driven from React state, each step invalidates exactly one frame, and once
 * the stack is open the canvas stops drawing entirely. An idle 3D panel three
 * quarters of the way down a page should not be costing anybody a GPU.
 */

/** `--color-keycap`. The site's neon orange, as a literal because three's
 *  materials are set from JS and cannot read a CSS custom property. The DOM
 *  labels below use the `text-keycap` utility, so the token stays the source
 *  of truth for everything the browser paints. */
const NEON = "#ff6b1f";

/* --- Framing -------------------------------------------------------------
 * The composition is a fixed pair: the stack standing on the left, its labels
 * in a column down the right. Everything below is in world units at z = 0,
 * measured from the assembly's own axis — where that axis then lands in the
 * frame is worked out at render time, in <Diagram>, because half of what has
 * to be balanced is type and type does not scale with the panel.
 */

/**
 * The label column's x, corrected for perspective.
 *
 * The camera looks slightly DOWN at the z = 0 plane, so that plane is not
 * fronto-parallel: depth along the camera's forward axis falls off as
 * `D − CAMERA_Y·y/D`, and a set of points sharing one world x therefore
 * project further out at the bottom of the frame than at the top. Left alone
 * it puts a two-pixel lean in what is supposed to be a column.
 *
 * Scaling x by that same factor holds `x / depth` — and so the projected x —
 * exactly constant. The leaders are unaffected either way: both ends of one
 * share a y and a z, so they share a depth and stay level.
 */
const columnX = (x: number, y: number) =>
  x * (1 - (CAMERA_Y * y) / (CAMERA_Y ** 2 + CAMERA_Z ** 2));

/* --- The come-apart ------------------------------------------------------ */

/** Long enough to watch a five-layer stack separate without the last two
 *  layers still moving when the reader has finished reading the labels. */
const OPEN_MS = 1400;

/** Where in the come-apart the labels begin to resolve, how much of it each
 *  one takes, and how far apart their turns are. They are expressed in explode
 *  progress rather than in milliseconds so they stay pinned to the geometry:
 *  a label arrives when its part has travelled, whatever the duration is. */
const LABEL_START = 0.45;
const LABEL_SPAN = 0.28;
const LABEL_STEP = 0.045;

/**
 * The five callouts, top to bottom — the order they stand in when the stack is
 * open, so the column reads down the object.
 *
 * `offset` is millimetres from the layer's OWN origin to the height the leader
 * points at, which is roughly the middle of each part rather than its base.
 *
 * `hx` and `hz` are the part's half-extents in millimetres, straight off the
 * geometry, before the assembly is turned; `silhouette` below is what the
 * camera actually sees of that footprint at `MODEL_SPIN`. Kept as the raw
 * footprint rather than as five hand-measured widths so that re-angling the
 * assembly moves every leader with it instead of leaving the numbers behind.
 */
type Callout = {
  part: PartName;
  name: string;
  offset: number;
  hx: number;
  hz: number;
};

const CALLOUTS: readonly Callout[] = [
  { part: "keycap", name: "Keycap", offset: 4.3, hx: 9.3, hz: 9.3 },
  { part: "stem", name: "Switch", offset: -1.2, hx: 3.5, hz: 2.7 },
  { part: "upper", name: "Upper housing", offset: 2.9, hx: 7.0, hz: 7.0 },
  { part: "lower", name: "Lower housing", offset: 2.8, hx: 6.85, hz: 6.85 },
  // Not a centred box like the others — this is the far corner of the outermost
  // contact, which is what actually sets the part's edge.
  { part: "pins", name: "Contacts", offset: -5.2, hx: 3.29, hz: 5.51 },
] as const;

/** Half the width a part presents to the camera, in millimetres: a footprint
 *  turned by θ shows `hx·cos θ + hz·sin θ`. */
const silhouette = (callout: Callout) =>
  callout.hx * Math.abs(Math.cos(MODEL_SPIN)) +
  callout.hz * Math.abs(Math.sin(MODEL_SPIN));

/** Millimetres of daylight between a part's silhouette and the start of its
 *  leader. One figure for all five, so the lines begin a consistent distance
 *  from the OBJECT rather than at a consistent x — which is what makes them
 *  fan out from a straight stack instead of sitting in a second column. */
const LEADER_CLEAR = 1.2;

const reach = (callout: Callout) => (silhouette(callout) + LEADER_CLEAR) * MM;

/** The composition's left edge — the widest part's silhouette, by symmetry
 *  about the assembly's axis. What the centring in <Diagram> balances the
 *  label column against. */
const LEFT_EDGE = -Math.max(...CALLOUTS.map(silhouette)) * MM;

/** The shortest a leader is allowed to be. The part whose silhouette pushes
 *  furthest right still needs a visible tick between it and its label, and
 *  that part is what sets the column for all five. */
const LEADER_GAP = 0.055;

/** Where every leader ends and every label begins. One x for all five is what
 *  makes them read as a column of callouts rather than as five captions. */
const LABEL_X = Math.max(...CALLOUTS.map(reach)) + LEADER_GAP;

/** The labels' type, in one place: the real ones and the hidden copy the
 *  column's width is measured from have to be set identically or the
 *  measurement stops meaning anything. */
const LABEL_TYPE =
  "flex items-center gap-1.5 pl-1.5 font-mono text-[0.55rem] tracking-[0.18em] whitespace-nowrap text-keycap uppercase sm:text-[0.65rem]";
const LABEL_DOT = "h-[3px] w-[3px] shrink-0 rounded-full bg-keycap";

/** The label the column's width is measured from — see <KeycapExploded>.
 *  Longest name wins, and in a monospace that is genuinely the widest one. */
const WIDEST = CALLOUTS.reduce((a, b) =>
  b.name.length > a.name.length ? b : a,
);

/* --- The close-up ---------------------------------------------------------
 * Everything that is true of the second half of this stage and not the first.
 * All of it is a function of `focus`, so there is no second timeline to keep
 * in step with the first — the stage is wherever the reader has put it.
 * ---------------------------------------------------------------------- */

/** How long the move between the diagram and the close-up takes, at full
 *  travel. Slower than the panel's own changeover: this one is not getting out
 *  of the way, it is the thing being watched. */
const FOCUS_MS = 1100;

/** How much of the move the four leaving layers take to go. They are gone well
 *  before the end of it: past about a third the camera has left them outside
 *  the frame anyway, and a part fading out beyond the edge of the panel is
 *  work nobody sees. */
const FADE_SPAN = 0.4;

/**
 * How far the leaving layers are defocused by the time they are gone, in
 * millimetres — see `TAPS` in <KeySwitch> for how that is done.
 *
 * They go soft as they go, rather than simply dimming: dimming alone, against
 * a near-black panel, reads as the lights going down on parts that are still
 * there. Softening says they are being set aside. It is also the move the rest
 * of the site resolves things IN on — see `.blur-fade-in` in globals.css —
 * played backwards.
 */
const BLUR_MM = 2.5;

/**
 * Which way each of the four goes as it leaves, in millimetres at full travel.
 *
 * Scattered rather than simply lifted away, because they are not being put
 * back: a stack that opens further is still a stack, and still reads as
 * something the reader is meant to follow. Sent four different ways it reads
 * as the frame being cleared.
 *
 * Signed so nothing crosses the stem on its way out — the cap and the top
 * housing leave upward and apart, the base and the contacts downward and
 * apart — and weighted so the two that were furthest out already go furthest,
 * which keeps the group from bunching as it thins.
 */
const SCATTER: Partial<Record<PartName, readonly [number, number, number]>> = {
  keycap: [-6, 10, -2],
  upper: [7, 3.5, 1.5],
  lower: [-7, -5, 1.5],
  pins: [5, -11, -2],
};

/**
 * The stem, in millimetres about its own origin: the barrel runs down to
 * −6.6 and the cross stands up to +3.85 — see `buildStem`. What the close
 * framing is derived from, rather than a distance picked by eye, so the part
 * fills the same share of the panel however the geometry is revised.
 */
const STEM_TOP = 3.85;
const STEM_BOTTOM = -6.6;
const STEM_HEIGHT = STEM_TOP - STEM_BOTTOM;

/** The middle of the part, in world units, with the stack fully open. Read
 *  through `layerY` like every other anchor in this section. */
const FOCUS_Y = layerY("stem", 1) + ((STEM_TOP + STEM_BOTTOM) / 2) * MM;

/**
 * How much of the panel's height the part ends up filling — the figure the
 * framing below solves for, at the plane through the middle of the part.
 *
 * It lands nearer three fifths than the half it asks for, and that is correct:
 * at a third of a unit away this is a wide-angle view of an object a tenth of
 * a unit deep, so the face turned towards the camera is magnified over the
 * middle by about a tenth. A part cropped to the edges reads as a texture
 * rather than an object, and the falloff on this model's silhouette needs some
 * black around it to fall off INTO. The swatches want their own air too.
 */
const FILL = 0.44;

/** Where the dolly ends. Straight out of the framing above: the visible height
 *  of the z = 0 plane scales with distance, so this is the distance at which
 *  it equals the part's own height over `FILL`. */
const NEAR = (FAR * (STEM_HEIGHT * MM)) / FILL / VIEW_HEIGHT;

/**
 * How far above the middle of the panel the part finally sits, as a fraction
 * of the frame's height. A fraction rather than a distance, so it holds at
 * every panel size: the swatches take a bite out of the bottom of the box, and
 * a part centred on the box itself then sits low against them.
 */
const LIFT = 0.06;

/** The direction the camera sits in from whatever it is looking at — the wide
 *  camera's own, kept for the close one so the move is a pure dolly. Changing
 *  the angle on the way in makes the part appear to turn as the camera
 *  travels, and then it is not clear which of the two is moving. */
const EYE = new Vector3(0, CAMERA_Y, CAMERA_Z).normalize();

/**
 * A few degrees of turn as the camera arrives, so the part is not perfectly
 * still at the moment it becomes the whole frame. Applied to the OBJECT, not
 * the camera: this way it reads as the part being turned to be looked at.
 *
 * Signed to turn the part TOWARDS the reader, which is the opposite of the
 * first thing to try. Turning it further away lands the close-up near 45°,
 * where a square-section part presents a diamond silhouette with both faces
 * equally foreshortened and reads as a blob — the cross on top, which is the
 * detail that says what the part is, goes edge-on exactly there.
 */
const TURN = -0.16;

/**
 * The four switches, by the colour their slider is moulded in — the way the
 * part has been sold for forty years, and the reason the model's stem is a
 * colour at all.
 *
 * These are the MATERIAL colours, handed to the renderer and painted on the
 * swatch unchanged, so what is picked is what appears. They read differently
 * in the panel than in the row of squares because the part is lit and tone
 * mapped and the squares are not; matching them by eye would mean lying in one
 * place or the other.
 */
const SWITCHES = [
  { name: "Blue", color: "#2f5fc4" },
  { name: "Red", color: "#c62f28" },
  { name: "Silver", color: "#b9bcc2" },
  // Darker and less saturated than the swatch alone suggests it needs to be:
  // the rig on this stage is warm on every axis — see <PartStage> — and a
  // mid-brown lit by it and run through ACES comes back out as tan.
  { name: "Brown", color: "#56341c" },
] as const;

/**
 * The camera, from the diagram's wide shot to the part.
 *
 * At `zoom` 0 this IS the diagram's framing, and deliberately so — one
 * expression covering both ends means the wide shot cannot drift away from the
 * place the close-up starts from. The target is the middle of the assembly and
 * the camera is directly above it, which keeps the view direction in the yz
 * plane and therefore keeps the camera's right vector on world x: the
 * guarantee that a leader line — two points at the same height, at different
 * distances out from the axis — projects to something actually horizontal.
 *
 * The distance is interpolated GEOMETRICALLY rather than linearly. A dolly
 * that covers equal ratios per unit time reads as an even move, where equal
 * distances per unit time crawls at the start and lunges at the end; it is the
 * same reason a zoom control is a log scale.
 *
 * The target rises from the middle of the assembly to the middle of the stem
 * and the camera holds station off it, so the part is dead centre when the
 * move lands.
 */
function Dolly({ zoom }: { zoom: number }) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  // Every render of this component is one step of the move, so this runs on
  // every render, without a dependency array.
  useLayoutEffect(() => {
    const distance = FAR * Math.pow(NEAR / FAR, zoom);
    // The lift is a fraction of what the camera can see at the distance it has
    // reached, so it grows with the move rather than sliding the wide shot off
    // centre before the dolly has started.
    const framed = (distance / FAR) * VIEW_HEIGHT;
    // Subtracted, not added: the target is the middle of the frame, so
    // dropping it BELOW the part is what puts the part above centre.
    const y = (FOCUS_Y - framed * LIFT) * zoom;

    camera.position.set(0, y + EYE.y * distance, EYE.z * distance);
    camera.lookAt(0, y, 0);
    // The other half of `frameloop="demand"`: the camera moved, so ask for the
    // one frame that shows it.
    invalidate();
  });

  return null;
}

/**
 * The assembly, its leader lines and its labels — everything that has to stay
 * in register with everything else, in one place and on one axis.
 *
 * The lines are a single `lineSegments` with five segments in it, and its
 * geometry is allocated once and rewritten in place on each step of the
 * come-apart: building a fresh BufferGeometry sixty times a second would hand
 * the driver a new buffer every frame and leave the old ones to be collected.
 *
 * The labels are DOM, not textures. At nine pixels of tracked-out mono a
 * canvas-rendered label is a smudge on any display, and this way they are real
 * selectable text that carries the part names into the accessibility tree.
 *
 * Which is also what makes centring the thing a measurement rather than a
 * constant. The BODY of this diagram is the stack AND its labels — the two
 * together are what should sit in the middle of the panel — but the stack
 * scales with the panel and the labels, being type, do not, so the column eats
 * a bigger share of a phone-sized panel than of a desktop one. `labelPx` is
 * the width of the widest label, measured outside the canvas and handed in;
 * converted through the camera's own framing it says exactly how far the pair
 * has to shift for its two ends to be equidistant from the edges, at any
 * width. Nothing here is hand-placed — move a layer, rename a label, resize
 * the panel, and it re-centres itself.
 */
function Diagram({
  explode,
  zoom,
  tint,
  labelPx,
}: {
  explode: number;
  zoom: number;
  tint: string;
  labelPx: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const height = useThree((state) => state.size.height);

  // Left edge is the widest part, right edge is the end of the longest label;
  // the shift is half the difference, which puts the midpoint of the whole
  // body on the middle of the frame.
  //
  // Undone as the camera closes in. The shift exists to balance the model
  // against its column of labels, and by the end of the move there are no
  // labels — the part alone is the composition, and the dolly is aimed down
  // x = 0. Letting it decay with `zoom` is what puts the stem where the camera
  // is already looking.
  const shift =
    (-(LEFT_EDGE + LABEL_X + labelPx / (height / VIEW_HEIGHT)) / 2) *
    (1 - zoom);

  // The four that are not the stem, leaving together rather than in sequence:
  // staggering them would draw the eye BACK to each in turn, which is the
  // opposite of what this move is for.
  const going = clamp01(zoom / FADE_SPAN);
  const leaving = 1 - going;

  const fade = {
    keycap: leaving,
    upper: leaving,
    lower: leaving,
    pins: leaving,
  };

  const blur = {
    keycap: going * BLUR_MM,
    upper: going * BLUR_MM,
    lower: going * BLUR_MM,
    pins: going * BLUR_MM,
  };

  const drift = Object.fromEntries(
    Object.entries(SCATTER).map(([name, [x, y, z]]) => [
      name,
      [x * going, y * going, z * going] as const,
    ]),
  ) as Partial<Record<PartName, readonly [number, number, number]>>;

  // The callouts go first and quickly: they are type, and type sliding out of
  // a frame that is also moving is two things to read at once.
  const labelled = 1 - clamp01(zoom / 0.28);

  const leaders = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(CALLOUTS.length * 6), 3),
    );
    return geometry;
  }, []);

  useEffect(() => () => leaders.dispose(), [leaders]);

  // The one place a callout's position is decided, shared by the line that
  // points at the part and the label at the end of it.
  //
  // In WORLD space, shift included — the callouts sit outside the group that
  // carries it, because the column's x has to be corrected per label and a
  // group position cannot do that.
  const anchors = CALLOUTS.map((callout) => {
    const y = layerY(callout.part, explode) + callout.offset * MM;
    return {
      from: reach(callout) + shift,
      to: columnX(LABEL_X + shift, y),
      y,
    };
  });

  // Deliberately without a dependency array: `anchors` is rebuilt every render
  // and this has to follow it. Every render of this component is already one
  // step of the come-apart, so "every render" is exactly the right cadence.
  useLayoutEffect(() => {
    const position = leaders.getAttribute("position") as BufferAttribute;

    anchors.forEach((anchor, index) => {
      position.setXYZ(index * 2, anchor.from, anchor.y, 0);
      position.setXYZ(index * 2 + 1, anchor.to, anchor.y, 0);
    });

    position.needsUpdate = true;
    leaders.computeBoundingSphere();
    // The other half of `frameloop="demand"`: something moved, so ask for the
    // one frame that shows it.
    invalidate();
  });

  return (
    <>
      <group
        position={[shift, 0, 0]}
        rotation={[0, MODEL_SPIN - TURN * zoom, 0]}
      >
        <KeySwitch
          explode={explode}
          fade={fade}
          blur={blur}
          drift={drift}
          tint={{ stem: tint }}
        />
      </group>

      <lineSegments geometry={leaders} frustumCulled={false}>
        {/* `depthTest` off so a leader is never half-swallowed by the part it
            points at — a line that fades out behind a housing reads as a
            rendering fault rather than as depth. */}
        <lineBasicMaterial
          color={NEON}
          transparent
          depthTest={false}
          opacity={
            clamp01((explode - LABEL_START + 0.05) / LABEL_SPAN) *
            0.7 *
            labelled
          }
        />
      </lineSegments>

      {CALLOUTS.map((callout, index) => {
        // Each label resolves out of blur as its own part finishes travelling
        // — the hero's move (see `.blur-fade-in` in globals.css), driven by the
        // come-apart instead of by a timer so the two cannot fall out of step.
        const shown =
          clamp01((explode - LABEL_START - index * LABEL_STEP) / LABEL_SPAN) *
          labelled;

        return (
          <Html
            key={callout.part}
            position={[anchors[index].to, anchors[index].y, 0]}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            {/* `-translate-y-1/2` centres the text on the anchor: drei puts the
                element's top-left corner there, and the leader arrives at the
                middle of the line of type, not at the cap height. */}
            <span
              className={`${LABEL_TYPE} -translate-y-1/2`}
              style={{
                opacity: shown,
                filter: `blur(${(1 - shown) * 5}px)`,
              }}
            >
              <span aria-hidden="true" className={LABEL_DOT} />
              {callout.name}
            </span>
          </Html>
        );
      })}
    </>
  );
}

export function KeySwitchStage() {
  // Where the reader is between this stage's two parts: 0 the diagram, 1 the
  // close-up. `useApproach` is what turns a step into a move, and what lets
  // the reader turn round in the middle of one.
  const zoom = useApproach(useStageFocus(), FOCUS_MS);

  // The come-apart. Held closed until the stage has finished rising into the
  // panel — see ENTRANCE_MS — and played only on ARRIVING here; moving between
  // this stage's two parts is not an arrival, so it does not restart.
  const revealed = easeOut(useReveal(OPEN_MS, ENTRANCE_MS));

  // Whichever is further on. Arriving at the pair on its Keycaps half, `zoom`
  // is 0 and this is the come-apart; arriving on its Switch half — scrolling
  // up from Knobs, say — `zoom` is already 1 and the stack is simply open,
  // which is right, because a close-up of a stem is not a shot that should
  // begin by assembling a keyboard key. Between the two it is monotonic, so a
  // reader who moves on mid-reveal is never shown the stack closing.
  const explode = Math.max(revealed, zoom);

  const [choice, setChoice] = useState(0);
  const [labelPx, setLabelPx] = useState(0);

  // The swatches land with the camera: held out of the way — and out of reach,
  // see `pointer-events` — until the move is essentially over. Nothing should
  // be competing with the part while the camera is still travelling towards
  // it.
  const arrived = clamp01((zoom - 0.75) / 0.25);

  // Measured from a hidden copy of the widest label, in the ordinary DOM,
  // BEFORE the canvas exists.
  //
  // The obvious version of this reads the real label inside <Html> — and it
  // works, one render too late: the width arrives on the second pass, the
  // shift it feeds is wrong on the first, and the diagram is seen jumping from
  // the middle of the panel to its final place. There is nothing to animate
  // away there; the first position was never a position, just a missing
  // measurement. So it is taken from a copy that costs nothing, and the canvas
  // waits the one frame it takes to arrive.
  //
  // An observer rather than a one-off read, because the labels step up a type
  // size at the `sm` breakpoint and the panel is fluid on either side of it.
  const measure = useCallback((node: HTMLSpanElement) => {
    const observer = new ResizeObserver(([entry]) =>
      setLabelPx(entry.borderBoxSize[0].inlineSize),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span
        ref={measure}
        aria-hidden="true"
        className={`${LABEL_TYPE} invisible absolute top-0 left-0`}
      >
        <span className={LABEL_DOT} />
        {WIDEST.name}
      </span>

      {labelPx > 0 && (
        <PartStage>
          <Dolly zoom={zoom} />
          <Diagram
            explode={explode}
            zoom={zoom}
            tint={SWITCHES[choice].color}
            labelPx={labelPx}
          />
        </PartStage>
      )}

      <div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2.5 pb-5"
        style={{
          opacity: arrived,
          filter: `blur(${(1 - arrived) * 6}px)`,
          pointerEvents: arrived > 0.9 ? "auto" : "none",
        }}
        // Hidden from the reader who cannot see it: for most of this stage's
        // life the swatches are a row of invisible buttons over a diagram of
        // something else.
        aria-hidden={arrived < 0.9}
      >
        {/* Names the swatch that is selected, so the row is not four unlabelled
            squares. One line for all four rather than a caption each: at this
            size four captions is a paragraph. */}
        <span className="font-mono text-[0.55rem] tracking-[0.18em] text-ink-muted uppercase">
          {SWITCHES[choice].name}
        </span>

        {/* The gap is wider than it looks like it needs to be, because each
            swatch's hit area is wider than the swatch — see below. At this
            spacing the two meet exactly and never overlap, so a thumb aiming
            at brown cannot land on silver. */}
        <div className="flex gap-3">
          {SWITCHES.map((option, index) => (
            <button
              key={option.name}
              type="button"
              onClick={() => setChoice(index)}
              // Real buttons in a row, not divs with handlers: this is a set of
              // choices and it should be reachable from the keyboard. `pressed`
              // rather than `selected` because that is what a toggle in a group
              // of toggles is.
              aria-pressed={index === choice}
              aria-label={`${option.name} switch`}
              tabIndex={arrived > 0.9 ? undefined : -1}
              // A 24px square is the right SIZE for four of these under a
              // close-up, and the wrong target for a thumb. The `::after`
              // grows the button's hit area to 36 without touching what is
              // drawn — the square stays a square.
              className={`relative h-6 w-6 rounded-md ring-offset-2 ring-offset-surface-raised transition duration-200 after:absolute after:-inset-1.5 after:content-[''] ${
                index === choice
                  ? "ring-1 ring-ink/70"
                  : "opacity-55 hover:opacity-100"
              }`}
              style={{ backgroundColor: option.color }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
