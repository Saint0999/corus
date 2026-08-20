"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  type BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
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
  MODEL_SPIN,
  PartStage,
  VIEW_HEIGHT,
  clamp01,
  easeOut,
  ENTRANCE_MS,
  useReveal,
} from "@/components/anatomy/PartStage";

/**
 * The key, taken apart and called out — the Anatomy panel's "Keycaps" visual.
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
const WIDEST = CALLOUTS.reduce((a, b) => (b.name.length > a.name.length ? b : a));

/**
 * Camera placement.
 *
 * Set here rather than left to the `camera` prop's defaults because the LOOK
 * is what the diagram depends on: the target is the middle of the assembly and
 * the camera is directly above it, which keeps the view direction in the yz
 * plane and therefore keeps the camera's right vector on world x. That is the
 * guarantee that a leader line — two points at the same height, at different
 * distances out from the axis — projects to something actually horizontal.
 */
function Framing() {
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    camera.position.set(0, CAMERA_Y, CAMERA_Z);
    camera.lookAt(0, 0, 0);
  }, [camera]);

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
function Diagram({ explode, labelPx }: { explode: number; labelPx: number }) {
  const invalidate = useThree((state) => state.invalidate);
  const height = useThree((state) => state.size.height);

  // Left edge is the widest part, right edge is the end of the longest label;
  // the shift is half the difference, which puts the midpoint of the whole
  // body on the middle of the frame.
  const shift = -(LEFT_EDGE + LABEL_X + labelPx / (height / VIEW_HEIGHT)) / 2;

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
      <group position={[shift, 0, 0]} rotation={[0, MODEL_SPIN, 0]}>
        <KeySwitch explode={explode} />
      </group>

      <lineSegments geometry={leaders} frustumCulled={false}>
        {/* `depthTest` off so a leader is never half-swallowed by the part it
            points at — a line that fades out behind a housing reads as a
            rendering fault rather than as depth. */}
        <lineBasicMaterial
          color={NEON}
          transparent
          depthTest={false}
          opacity={clamp01((explode - LABEL_START + 0.05) / LABEL_SPAN) * 0.7}
        />
      </lineSegments>

      {CALLOUTS.map((callout, index) => {
        // Each label resolves out of blur as its own part finishes travelling
        // — the hero's move (see `.blur-fade-in` in globals.css), driven by the
        // come-apart instead of by a timer so the two cannot fall out of step.
        const shown = clamp01(
          (explode - LABEL_START - index * LABEL_STEP) / LABEL_SPAN,
        );

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

export function KeycapExploded() {
  // Held closed until the stack has finished rising into the frame — see
  // ENTRANCE_MS. The keycap arrives as one object and comes apart after.
  const explode = easeOut(useReveal(OPEN_MS, ENTRANCE_MS));
  const [labelPx, setLabelPx] = useState(0);

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
          <Framing />
          <Diagram explode={explode} labelPx={labelPx} />
        </PartStage>
      )}
    </>
  );
}
