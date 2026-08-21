"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * The shared bookkeeping the Anatomy panel's 3D visuals are built on: the
 * visit/focus signals that say when a stage should play its reveal, and the
 * timing and easing every visual's own reveal is built from.
 *
 * This file is deliberately THREE-FREE. `<Anatomy>` imports `StageVisit` and
 * the timing constants below unconditionally, for every part — including the
 * still-image ones, which have nothing to do with a canvas. `<PartStage>`,
 * the actual `<Canvas>` these visuals render into, used to live in this file
 * too, and every one of those unconditional imports was quietly pulling
 * three.js, @react-three/fiber and @react-three/drei into whatever chunk
 * `<Anatomy>` belongs to — regardless of whether a reader ever scrolls far
 * enough to need them. See `PartCanvas.tsx`, where that half now lives, and
 * `KeySwitchStage.tsx`, which is the only thing that imports it — behind
 * `next/dynamic`, so the split actually pays for itself.
 */

/** The three-quarter turn every close-up frames the part from, in radians.
 *  Shared so two visuals of the same object cannot disagree about which way
 *  round it goes. */
export const MODEL_SPIN = -0.42;

/** The wide camera: slightly above the middle of the assembly — enough to see
 *  the dish in the cap and the aperture in the top housing, not so much that
 *  the stack starts to look like it is lying down. Every visual OPENS here,
 *  whatever it then does with the camera. */
export const CAMERA_Y = 0.2;
export const CAMERA_Z = 1.5;
export const FOV = 30;

/** How far the wide camera stands off the middle of the assembly. */
export const FAR = Math.hypot(CAMERA_Y, CAMERA_Z);

/** How much of the z = 0 plane the wide camera sees, top to bottom, in world
 *  units — the conversion between the world the model lives in and the pixels
 *  anything measured in the DOM comes back in. */
export const VIEW_HEIGHT = 2 * FAR * Math.tan(((FOV / 2) * Math.PI) / 180);

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Leaves quickly, arrives gently — what makes a stack look like it is being
 *  taken apart rather than dropped. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Eased at both ends, for moves that start from rest and come to rest: a
 *  camera that begins travelling at full speed reads as a cut. */
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* --- The panel's changeover ----------------------------------------------
 * Parts do not cut, and they do not cross either. The one leaving travels the
 * full height of the panel out through the top; the one arriving comes up from
 * a full height below the bottom. Both are clipped by the panel's own edges on
 * the way, so at no point are two of them sharing the frame.
 *
 * Sequential, not overlapping: the arrival does not begin until the exit is
 * essentially over. That is what the delay below is. It is a timed handoff
 * rather than a watched one — nothing waits for the exit to report itself
 * finished — so the delay and the exit's easing have to be read together; see
 * the note on `pose` in <Anatomy>.
 *
 * The three numbers live here, together, because they are one shape and
 * because two files depend on them: the slot's transition over in <Anatomy>,
 * and the `delayMs` every reveal is given. A model that starts coming apart
 * while it is still on its way in arrives as a cloud of loose parts. It should
 * arrive as the object, and open once it is standing still.
 * ---------------------------------------------------------------------- */

/** The leaving part's travel, in ms. Slow enough to be watched: it is
 *  crossing a whole panel height, and a full frame of travel taken in a third
 *  of a second reads as a cut with a smear on it rather than as a departure. */
export const EXIT_MS = 620;

/** How long the arriving part waits before it starts — near enough all of the
 *  exit, so the frame is clear before anything enters it. Held at about nine
 *  tenths of EXIT_MS; the two move together. */
export const ENTER_DELAY_MS = 560;

/** The arriving part's travel, in ms. Longer than the exit: coming to rest in
 *  front of the reader is worth more time than getting out of the way. */
export const ENTER_MS = 700;

/** From the selection changing to the new part standing still — what a reveal
 *  has to wait out before it can open. */
export const ENTRANCE_MS = ENTER_DELAY_MS + ENTER_MS;

/**
 * How many times the stage the reader is looking at has been arrived at.
 *
 * A stage is built long before it is looked at — see <StageVisit>— so mounting
 * can no longer be what starts its reveal. This is the signal that replaces it:
 * every arrival is a new number, and everything that plays on arrival hangs off
 * that changing rather than off a component appearing.
 */
const VisitContext = createContext(0);

/**
 * How far through its OWN parts the reader is, 0 to 1.
 *
 * A stage usually stands for one part and this is always 0. It is for the one
 * that stands for two: the exploded key and the switch inside it are the same
 * object at two magnifications, so they share a stage, and this is which of
 * them is being asked for — 0 the diagram, 1 the close-up, and every value
 * between them a frame of the move from one to the other.
 */
const FocusContext = createContext(0);

/** Where a shared stage is being asked to look. See <FocusContext>. */
export function useStageFocus() {
  return useContext(FocusContext);
}

/** How many times the stage the reader is currently looking at has been
 *  arrived at. See <VisitContext>. Exported as a hook rather than the raw
 *  context so `PartCanvas.tsx` can read it without this file having to hand
 *  out the context object itself. */
export function useVisit() {
  return useContext(VisitContext);
}

/**
 * Marks one arrival at the stage inside it.
 *
 * A context rather than a prop because what has to hear about it is
 * <useReveal>, called deep inside whichever visual this is wrapping, and
 * threading a number through every visual to reach it would make each of them
 * responsible for a mechanism none of them owns.
 */
export function StageVisit({
  visit,
  focus = 0,
  children,
}: {
  visit: number;
  focus?: number;
  children: React.ReactNode;
}) {
  return (
    <VisitContext.Provider value={visit}>
      <FocusContext.Provider value={focus}>{children}</FocusContext.Provider>
    </VisitContext.Provider>
  );
}

/** Read once, as a state initialiser rather than in an effect — a reader who
 *  has asked for less motion should get the finished frame on the first paint,
 *  not watch it snap into place on the second. */
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One reveal's progress, 0 to 1, LINEAR.
 *
 * Linear on purpose: a reveal made of several moves has to ease each of them
 * on its own, and an eased clock underneath would ease them all twice. The
 * easings above are applied by the caller, per phase.
 *
 * React state rather than a `useFrame` mutation because what these numbers
 * drive is not only meshes — there are DOM labels and rebuilt line geometry
 * hanging off the same value, and one value driving one re-render keeps all of
 * them in the same frame by construction. It is over in about two seconds —
 * which is also how long the stage below keeps drawing unprompted, so a reveal
 * never has to be the thing that asks for its own frames.
 *
 * `delayMs` is 0 by default and was not always: there used to be a fifth of a
 * second of lead-in, from when a stage was built at the moment it was arrived
 * at and needed a beat to have drawn anything before it started moving. Stages
 * are built on load now and have been drawing since — so the beat is no longer
 * a beat, it is just the reader waiting.
 */
export function useReveal(durationMs: number, delayMs = 0) {
  const visit = useVisit();
  const [reduced] = useState(prefersReducedMotion);
  const [progress, setProgress] = useState(reduced ? 1 : 0);
  const [played, setPlayed] = useState(visit);

  // Back to the start on a new arrival — and during the render that hears
  // about it rather than in an effect afterwards, which is React's own way of
  // adjusting state to a changed input. Doing it in an effect would let one
  // frame be painted with the last visit's finished reveal still on screen.
  if (visit !== played) {
    setPlayed(visit);
    setProgress(reduced ? 1 : 0);
  }

  useEffect(() => {
    if (reduced) return;

    let frame = 0;
    let start = 0;

    const step = (now: number) => {
      if (!start) start = now;
      const t = clamp01((now - start - delayMs) / durationMs);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced, durationMs, delayMs, visit]);

  return progress;
}

/**
 * A value that travels to wherever it is pointed, rather than jumping there.
 *
 * <useReveal> plays a reveal once, from a standing start. This is the other
 * shape: a number that is told where to be and eases across from wherever it
 * had got to, every time the target moves. Which is what a stage shared by two
 * parts needs — the reader can turn round halfway and the move has to turn
 * round with them rather than restart.
 *
 * Eased at both ends, because every one of these begins and ends at rest, and
 * timed in proportion to the distance left: turning round a tenth of the way
 * in should take a tenth of the time, or the move looks like it has stalled.
 */
export function useApproach(target: number, durationMs: number) {
  const [reduced] = useState(prefersReducedMotion);
  const [value, setValue] = useState(target);

  // Where the move has actually got to. A ref, and written only from inside
  // the animation frame: it is what a NEW target measures its start from, and
  // reading it out of state would mean re-reading a value React has already
  // moved past.
  const reached = useRef(target);

  useEffect(() => {
    if (reduced) return;

    const start = reached.current;
    const distance = target - start;
    if (distance === 0) return;

    const span = Math.max(1, durationMs * Math.abs(distance));

    let frame = 0;
    let began = 0;

    const step = (now: number) => {
      if (!began) began = now;

      const t = clamp01((now - began) / span);
      reached.current = start + distance * easeInOut(t);
      setValue(reached.current);

      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);

  // Turning round mid-move is the case this exists for: the effect above is
  // keyed on the target alone, so a new one cancels the frame in flight and
  // sets off again from wherever `reached` had got to, rather than snapping
  // back to the start.
  return reduced ? target : value;
}
