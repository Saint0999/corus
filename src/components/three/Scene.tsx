"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, ContactShadows, OrbitControls, Preload } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { CAMERA, CONTROLS, SWAY } from "@/lib/scene-config";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { CanvasLoader } from "./CanvasLoader";
import { DioramaModel } from "./DioramaModel";
import { IdleSway } from "./IdleSway";

/**
 * The WebGL scene itself.
 *
 * This module is only ever imported through HeroCanvas.tsx, which loads it
 * lazily with `ssr: false` — <Canvas> needs a real DOM node and a WebGL
 * context, neither of which exists while Next.js renders on the server.
 */
export function Scene() {
  // Respect the OS "reduce motion" setting: no idle sway for users who asked
  // for less movement. They can still drag the model themselves.
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <Canvas
      // `dpr` caps the resolution on high-density screens. Without the cap a
      // 3x phone renders ~9x the pixels for almost no visible gain.
      dpr={[1, 1.75]}
      camera={{ position: CAMERA.position, fov: CAMERA.fov }}
      // Shadow *maps* stay off: 14 baked point lights x shadow map would be
      // brutal on mobile, and <ContactShadows> below fakes the only shadow the
      // composition actually needs.
      shadows={false}
      gl={{
        antialias: true,
        // Filmic tone mapping keeps the diorama's bright amber LEDs from
        // clipping to flat white. Swap to `NoToneMapping` for a punchier,
        // more saturated look.
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      // Transparent clear colour so the page's charcoal shows through and the
      // hero never shows a seam between DOM and canvas.
      style={{ background: "transparent" }}
    >
      {/* --- Ambience -------------------------------------------------------
          Kept intentionally low. The GLB carries its own golden-hour lighting;
          these two lights only stop the *outside* of the diorama (plinth,
          wall backs) from going completely black. */}
      <ambientLight intensity={0.25} color="#ffd9a8" />
      <directionalLight position={[6, 8, 4]} intensity={0.9} color="#ffb066" />
      {/* A dim, slightly cool rim light separates the model from the charcoal
          background — the classic warm-key / cool-fill pairing. */}
      <directionalLight position={[-6, 3, -5]} intensity={0.3} color="#8aa2ff" />

      {/* --- Camera rig -----------------------------------------------------
          `enableZoom` is off deliberately: a scroll-to-zoom canvas that fills
          the hero would trap the page scroll. `enablePan` is off so the model
          can never be dragged out of frame, and the azimuth clamp keeps the
          blank back of the room permanently off limits.
          Declared before <Bounds> so `makeDefault` has registered the controls
          by the time Bounds asks the scene for them. */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={CONTROLS.minPolarAngle}
        maxPolarAngle={CONTROLS.maxPolarAngle}
        minAzimuthAngle={CONTROLS.minAzimuthAngle}
        maxAzimuthAngle={CONTROLS.maxAzimuthAngle}
        minDistance={CONTROLS.minDistance}
        maxDistance={CONTROLS.maxDistance}
      />

      {/* Everything that can suspend (i.e. anything that downloads) goes inside
          the boundary, so the loader shows instead of an empty frame. */}
      <Suspense fallback={<CanvasLoader />}>
        {/* <Bounds> measures its children and dollies the camera until they
            fit the frame, keeping the direction set in CAMERA.position.
            `observe` re-runs that fit whenever the canvas is resized, which is
            what makes one camera work for a wide desktop column and a short
            mobile strip alike — no per-breakpoint camera maths.
            ContactShadows deliberately sits OUTSIDE it: anything inside is
            part of the measured bounding box.

            The margin also leaves room for the sway — a rotating box sweeps a
            wider silhouette than the one measured at the moment of the fit. */}
        <Bounds fit clip observe margin={1.25}>
          <IdleSway
            enabled={!prefersReducedMotion}
            amplitude={SWAY.amplitude}
            speed={SWAY.speed}
          >
            <DioramaModel />
          </IdleSway>
        </Bounds>

        {/* A soft blurred blob under the model. Much cheaper than a real shadow
            map and it is what makes the diorama feel like it is resting on the
            page rather than floating in front of it. */}
        <ContactShadows
          position={[0, -1.4, 0]}
          scale={9}
          far={4}
          blur={2.6}
          opacity={0.55}
          color="#000000"
        />

        {/* Compiles every material before the first frame, avoiding the little
            stutter you otherwise get as objects enter the frustum. */}
        <Preload all />
      </Suspense>
    </Canvas>
  );
}
