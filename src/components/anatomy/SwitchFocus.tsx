"use client";

import { useLayoutEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { MM } from "@/components/model/keyswitch/geometry";
import { KeySwitch, layerY } from "@/components/model/keyswitch/KeySwitch";
import {
  CAMERA_Y,
  CAMERA_Z,
  FAR,
  MODEL_SPIN,
  PartStage,
  VIEW_HEIGHT,
  clamp01,
  easeInOut,
  easeOut,
  ENTRANCE_MS,
  useReveal,
} from "@/components/anatomy/PartStage";

/**
 * The switch, on its own — the Anatomy panel's "Switch" visual.
 *
 * It opens on the same shot the "Keycaps" panel above it ends on: the whole
 * key coming apart, from the same angle, on the same stage. That is the point
 * of starting there rather than on the part itself — the reader has just been
 * shown where the switch SITS, so the close-up arrives as a continuation of
 * that drawing rather than as an unrelated render of an orange object.
 *
 * Then the other four layers go and the camera closes on the one that is
 * left. By the end there is nothing else in frame: no callouts, no leader
 * lines, no keycap at the top edge to look at instead. The part is the shot.
 *
 * Three moves on one clock, and the clock is <useReveal>'s, so this cannot
 * drift out of step with itself:
 *
 *   come apart  →  a beat  →  the others fade as the camera dollies in
 *
 * Like every visual on this stage it renders on demand and then stops: the
 * dolly is a function of a React state value, not a loop, and once it reaches
 * the end the canvas draws nothing further. Picking a colour asks for one more
 * frame and then it stops again.
 *
 * The colour swatches arrive with the shot rather than before it: they resolve
 * in as the dolly lands, so nothing is competing with the part while the
 * camera is still moving towards it.
 */

/** The come-apart, a beat to take it in, then the move in. Shorter than the
 *  "Keycaps" panel's come-apart on purpose — there it is the whole point, here
 *  it is the preamble, and the reader has almost certainly just watched it. */
const OPEN_MS = 1000;
const HOLD_MS = 200;
const ZOOM_MS = 950;
const TOTAL_MS = OPEN_MS + HOLD_MS + ZOOM_MS;

/** How much of the dolly the other four layers take to leave. They are gone
 *  well before the end of it: past about a third of the move they are outside
 *  the frame anyway, and a part fading out on the far side of the edge of the
 *  panel is work nobody sees. */
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
 *
 * Two and a half millimetres is small next to parts that are fourteen to
 * nineteen across, and still a dozen or so pixels of spread at the width this
 * panel is first seen at.
 */
const BLUR_MM = 2.5;

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
 *  through `layerY` like every other anchor in this section — the layer's
 *  travel is defined once, in <KeySwitch>, and everything that points at it
 *  reads it from there. */
const FOCUS_Y = layerY("stem", 1) + ((STEM_TOP + STEM_BOTTOM) / 2) * MM;

/**
 * How much of the panel's height the part ends up filling — the figure the
 * framing below solves for, at the plane through the middle of the part.
 *
 * It lands nearer three fifths than the half it asks for, and that is correct:
 * at a third of a unit away this is a wide-angle view of an object a tenth of
 * a unit deep, so the face turned towards the camera is magnified over the
 * middle by about a tenth. Solving for the far side instead would leave the
 * part looking small; this is the compromise, set so the MAGNIFIED silhouette
 * is the one that sits comfortably inside the panel.
 *
 * A part cropped to the edges reads as a texture rather than an object, and
 * the falloff on this model's silhouette (see `edgeFalloff`) needs some black
 * around it to fall off INTO. The swatches along the bottom want their own
 * air too.
 */
const FILL = 0.44;

/** Where the dolly ends. Straight out of the framing above: the visible height
 *  of the z = 0 plane scales with distance, so this is the distance at which
 *  it equals the part's own height over `FILL`. */
const NEAR = (FAR * (STEM_HEIGHT * MM)) / FILL / VIEW_HEIGHT;

/**
 * How far above the middle of the panel the part finally sits, as a fraction
 * of the frame's height.
 *
 * A fraction rather than a distance, so it holds at every panel size: the
 * swatches take a bite out of the bottom of the box, and a part centred on the
 * box itself then sits low against them. This lifts it back onto the middle of
 * what is left.
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
 * detail that says what the part is, goes edge-on exactly there. Coming back
 * to about 15° keeps the front face square enough to read the cross and the
 * collar, and still shows enough of the side for the leg to sit on.
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
 * The camera, from the wide shot to the part.
 *
 * The distance is interpolated GEOMETRICALLY rather than linearly — a dolly
 * that covers equal ratios per unit time reads as an even move, where equal
 * distances per unit time crawls at the start and lunges at the end. It is the
 * same reason a zoom control is a log scale.
 *
 * The target rises from the middle of the assembly to the middle of the stem,
 * and the camera holds station off it, so the part is dead centre when the
 * move lands. Both target and camera stay on x = 0: unlike the callout diagram
 * next door there is nothing beside the object that has to be balanced against
 * it, so the object simply IS the composition.
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

export function SwitchFocus() {
  // Waits out the arrival before it opens — see ENTRANCE_MS.
  const t = useReveal(TOTAL_MS, ENTRANCE_MS);
  const [choice, setChoice] = useState(0);

  const elapsed = t * TOTAL_MS;

  const explode = easeOut(clamp01(elapsed / OPEN_MS));
  const travel = clamp01((elapsed - OPEN_MS - HOLD_MS) / ZOOM_MS);
  const zoom = easeInOut(travel);

  // One opacity, and one radius, for the four that are leaving. They go
  // together rather than in sequence: staggering them would draw the eye BACK
  // to each in turn, which is the opposite of what this move is for.
  const going = clamp01(travel / FADE_SPAN);
  const leaving = 1 - going;
  const softening = going * BLUR_MM;

  const fade = { keycap: leaving, upper: leaving, lower: leaving, pins: leaving };
  const blur = {
    keycap: softening,
    upper: softening,
    lower: softening,
    pins: softening,
  };

  // The swatches land with the camera: they are held out of the way — and out
  // of reach, see `pointer-events` — until the move is essentially over.
  const arrived = clamp01((zoom - 0.75) / 0.25);

  return (
    <>
      <PartStage>
        <Dolly zoom={zoom} />

        <group rotation={[0, MODEL_SPIN - TURN * zoom, 0]}>
          <KeySwitch
            explode={explode}
            fade={fade}
            blur={blur}
            tint={{ stem: SWITCHES[choice].color }}
          />
        </group>
      </PartStage>

      <div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2.5 pb-5"
        style={{
          opacity: arrived,
          filter: `blur(${(1 - arrived) * 6}px)`,
          pointerEvents: arrived > 0.9 ? "auto" : "none",
        }}
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
