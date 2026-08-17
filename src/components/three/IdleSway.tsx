"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

type IdleSwayProps = {
  children: ReactNode;
  /** Set false for `prefers-reduced-motion`, which parks the model square-on. */
  enabled?: boolean;
  /** Half the sweep, in radians. 0.14 rad ≈ 8°. */
  amplitude?: number;
  /** Radians per second of the driving sine wave. */
  speed?: number;
};

/**
 * Slow left-right sway for the diorama.
 *
 * This replaces OrbitControls' `autoRotate`. A full 360° turntable would spend
 * half its time showing the *back* of the room — two blank exterior walls —
 * so instead the model oscillates inside the arc that actually looks good.
 *
 * The rotation is written straight to the object in `useFrame` rather than
 * being held in React state: this runs 60 times a second, and re-rendering the
 * component tree at that rate is exactly what R3F's frame loop exists to avoid.
 */
export function IdleSway({
  children,
  enabled = true,
  amplitude = 0.14,
  speed = 0.25,
}: IdleSwayProps) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    if (!enabled) {
      group.rotation.y = 0;
      return;
    }

    // `elapsedTime` (not delta accumulation) keeps the motion identical no
    // matter how many frames were dropped while the tab was hidden.
    group.rotation.y = Math.sin(state.clock.elapsedTime * speed) * amplitude;
  });

  return <group ref={groupRef}>{children}</group>;
}
