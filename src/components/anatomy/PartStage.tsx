"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";

/**
 * The shared stage the Anatomy panel's 3D visuals are shot on.
 *
 * The parts of a close-up that are NOT about any one part: the canvas, the
 * lighting rig, the house camera angle, and the clock the reveals run on. Each
 * visual then supplies only what makes it itself — <KeycapExploded> its
 * callouts, <SwitchFocus> its dolly.
 *
 * It exists because the rig had already been copied once, onto the `/key-switch`
 * bench, and a third copy is the point at which "the part is lit the way the
 * site is lit" quietly stops being true. The numbers below are the board's,
 * from <KeyboardReveal>.
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
export const VIEW_HEIGHT =
  2 * FAR * Math.tan(((FOV / 2) * Math.PI) / 180);

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Leaves quickly, arrives gently — what makes a stack look like it is being
 *  taken apart rather than dropped. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Eased at both ends, for moves that start from rest and come to rest: a
 *  camera that begins travelling at full speed reads as a cut. */
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
 * them in the same frame by construction. It is over in about two seconds, and
 * the canvas is on `frameloop="demand"`, so this is also the only thing asking
 * for frames at all.
 */
export function useReveal(durationMs: number, delayMs = 220) {
  const [reduced] = useState(prefersReducedMotion);
  const [progress, setProgress] = useState(reduced ? 1 : 0);

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
  }, [reduced, durationMs, delayMs]);

  return progress;
}

export function PartStage({ children }: { children: ReactNode }) {
  return (
    <Canvas
      // Nothing on this stage animates on its own: every frame it draws is one
      // a reveal asked for, and once a reveal has landed it stops drawing.
      frameloop="demand"
      camera={{
        position: [0, CAMERA_Y, CAMERA_Z],
        fov: FOV,
        // Tightened right in around the subject. These parts are a few
        // hundredths of a world unit across and a close-up ends up a third of
        // a unit from them; the default 0.1–1000 spreads the depth buffer over
        // a range four orders of magnitude bigger than anything being drawn,
        // and the housings start to z-fight against their own inside faces.
        near: 0.05,
        far: 10,
      }}
      // `alpha` so the panel's own `bg-surface-raised` is the background and
      // the canvas is not a second, slightly different black inside it.
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
      dpr={[1, 2]}
      className="!absolute inset-0"
    >
      {/* The board's rig — the part is lit by the light the rest of the site is
          lit by, so the cream cap and the terracotta stem land on the same
          values here as they do on the hero render. */}
      <ambientLight intensity={0.14} color="#fff9f3" />
      <directionalLight position={[-4, 6, 5]} intensity={2.1} color="#fff1dd" />
      <directionalLight position={[5, 1, 4]} intensity={0.4} color="#cfd8e8" />
      <directionalLight position={[0, 3, -6]} intensity={1.15} color="#ffe6c8" />

      <Environment resolution={128} frames={1}>
        <Lightformer
          intensity={2.2}
          position={[0, 3.2, 2.5]}
          scale={[10, 5, 1]}
          color="#fff6ec"
        />
        <Lightformer
          intensity={0.7}
          position={[3.4, -1.2, 2.2]}
          scale={[3, 4, 1]}
          color="#ffb46a"
        />
      </Environment>

      {children}
    </Canvas>
  );
}
