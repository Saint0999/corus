"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { CAMERA_Y, CAMERA_Z, FOV, useVisit } from "@/components/anatomy/PartStage";

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
 *
 * Split out of `PartStage.tsx` on purpose — this half is the only half that
 * touches three.js, @react-three/fiber and @react-three/drei, and it is only
 * ever imported by `KeySwitchStage.tsx`, itself loaded through `next/dynamic`.
 * Everything <Anatomy> needs unconditionally — `StageVisit`, the timing
 * constants — lives in `PartStage.tsx`, which stays three-free so importing
 * it never pulls this file's dependencies along for the ride.
 */

/**
 * How long a stage keeps drawing every frame after it mounts.
 *
 * Long enough to cover the longest reveal built on it — <SwitchFocus>'s, at
 * 2150ms — plus <useReveal>'s lead-in and a margin. Overrun costs a second of
 * frames on a panel the reader is looking at anyway; underrun leaves a reveal
 * half drawn, so it errs long.
 */
const SETTLE_MS = 2800;

/**
 * Asks for a frame while the page is moving.
 *
 * `demand` rests on the last frame it drew still being on screen, and most of
 * the time it is. But this panel lives in a section that PINS, and a sticky
 * box changes compositing layers as it takes hold and lets go; a canvas whose
 * drawing buffer is not preserved can come back from that cleared, with
 * nothing left that would ask for the frame to fill it in again. One
 * invalidation per scrolled frame is close to free and makes that state
 * unreachable.
 */
function RedrawWhileScrolling() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        invalidate();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [invalidate]);

  return null;
}

export function PartStage({ children }: { children: ReactNode }) {
  /**
   * `demand` is what this stage wants to settle into: nothing on it animates
   * of its own accord, and an idle 3D panel three quarters of the way down a
   * page should not be costing anybody a GPU.
   *
   * It cannot start there, though. `demand` only draws when something asks,
   * and on the way in there is a window where nothing does: <useReveal> holds
   * at 0 through its lead-in, and setting state to the value it already has is
   * not a render, so it is not a frame either. Arrive in that window with a
   * canvas R3F has not measured yet — which is exactly what arriving by
   * SCROLL does, since the measurement is debounced while the page moves — and
   * the one frame that gets drawn is drawn at no size, with nothing left to
   * ask for another. The panel then simply stays empty, which is what the
   * keycap and switch visuals were doing when scrolled to rather than clicked.
   *
   * So it draws every frame until the reveal has landed, and goes quiet after.
   */
  const visit = useVisit();
  const [settled, setSettled] = useState(false);
  const [drawn, setDrawn] = useState(visit);

  // Every arrival reopens the window, not just the first: a stage that has
  // gone quiet and is then come back to has a reveal to draw, and this is what
  // guarantees it gets drawn.
  if (visit !== drawn) {
    setDrawn(visit);
    setSettled(false);
  }

  useEffect(() => {
    if (settled) return;

    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [settled]);

  return (
    <Canvas
      frameloop={settled ? "demand" : "always"}
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
          lit by, so the cap and the stem land on the same values here as they
          do on the hero render. Which means these numbers are COPIES: they
          crossed to daylight with the hero's, and if those move again these
          have to move with them. See the rig in KeyboardReveal for why each
          one is where it is; nothing here is decided locally. */}
      <ambientLight intensity={0.14} color="#fafcff" />
      <directionalLight position={[-4, 6, 5]} intensity={2.1} color="#fdfaf6" />
      <directionalLight position={[5, 1, 4]} intensity={0.55} color="#c4d3ea" />
      <directionalLight
        position={[0, 3, -6]}
        intensity={1.15}
        color="#eff3fa"
      />

      <Environment resolution={128} frames={1}>
        <Lightformer
          intensity={2.2}
          position={[0, 3.2, 2.5]}
          scale={[10, 5, 1]}
          color="#f8fbff"
        />
        <Lightformer
          intensity={0.34}
          position={[3.4, -1.2, 2.2]}
          scale={[3, 4, 1]}
          color="#ffd6ae"
        />
      </Environment>

      <RedrawWhileScrolling />

      {children}
    </Canvas>
  );
}
