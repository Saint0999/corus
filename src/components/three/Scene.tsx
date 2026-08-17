"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, ContactShadows, Preload } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { CAMERA } from "@/lib/scene-config";
import { CanvasLoader } from "./CanvasLoader";
import { DioramaModel } from "./DioramaModel";

/**
 * The WebGL scene itself.
 *
 * This module is only ever imported through HeroCanvas.tsx, which loads it
 * lazily with `ssr: false` — <Canvas> needs a real DOM node and a WebGL
 * context, neither of which exists while Next.js renders on the server.
 *
 * The scene is deliberately non-interactive: the diorama is framed once and
 * held there, like a photograph. There are no OrbitControls, so the camera
 * angle in `scene-config.ts` is the only angle it will ever be seen from.
 */
export function Scene() {
  return (
    <Canvas
      // `dpr` caps the resolution on high-density screens. Without the cap a
      // 3x phone renders ~9x the pixels for almost no visible gain.
      dpr={[1, 1.75]}
      camera={{ position: CAMERA.position, fov: CAMERA.fov }}
      // The hero is a fixed product shot: no controls, no animation, nothing
      // that changes after the model has loaded. `demand` therefore renders
      // only when React actually changes something (mount, model load, resize)
      // instead of running a 60fps loop forever — the GPU goes idle once the
      // first frame is on screen.
      frameloop="demand"
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

      {/* Everything that can suspend (i.e. anything that downloads) goes inside
          the boundary, so the loader shows instead of an empty frame. */}
      <Suspense fallback={<CanvasLoader />}>
        {/* <Bounds> measures its children and dollies the camera until they
            fit the frame, keeping the direction set in CAMERA.position.
            `observe` re-runs that fit whenever the canvas is resized, which is
            what makes one camera work for a wide desktop column and a short
            mobile strip alike — no per-breakpoint camera maths. With no
            controls in the scene, Bounds moves the camera itself.
            ContactShadows deliberately sits OUTSIDE it: anything inside is
            part of the measured bounding box. */}
        <Bounds fit clip observe margin={1.12}>
          <DioramaModel />
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
