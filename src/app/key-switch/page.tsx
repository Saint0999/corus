"use client";

import { useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ACESFilmicToneMapping, Vector3 } from "three";
import {
  KeySwitch,
  layerY,
  type PartName,
} from "@/components/model/keyswitch/KeySwitch";

/**
 * A bench for looking at the key-switch assembly on its own: orbit it, take it
 * apart with the slider, and frame any single layer to check it up close.
 *
 * This route is SCAFFOLDING. The lighting rig below is a copy of the board's,
 * kept here only so the part can be judged under the light it will finally be
 * seen in — once <KeySwitch> lands inside <KeyboardReveal>'s canvas it will be
 * lit by that scene's own rig and this copy goes away with the route.
 */

/** How close to sit to each layer, in world units — roughly its own size. */
const FOCUS: Record<
  PartName | "all",
  { part: PartName | null; distance: number }
> = {
  all: { part: null, distance: 1.45 },
  keycap: { part: "keycap", distance: 0.42 },
  stem: { part: "stem", distance: 0.3 },
  upper: { part: "upper", distance: 0.36 },
  lower: { part: "lower", distance: 0.4 },
  pins: { part: "pins", distance: 0.3 },
};

type FocusKey = keyof typeof FOCUS;

/** The three-quarter angle everything is framed from, so switching subject
 *  changes what is being looked at and not how it is being lit. */
const EYE = new Vector3(0.42, 0.26, 1).normalize();

function Framing({ focus, explode }: { focus: FocusKey; explode: number }) {
  const controls = useThree(
    (state) => state.controls,
  ) as OrbitControlsImpl | null;
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!controls) return;
    const { part, distance } = FOCUS[focus];
    const y = part ? layerY(part, explode) : 0;
    controls.target.set(0, y, 0);
    camera.position.copy(controls.target).addScaledVector(EYE, distance);
    controls.update();
    // Deliberately NOT re-running on `explode`: re-framing mid-drag would drag
    // the camera around with the slider. Picking a subject re-frames; moving
    // the stack does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, controls, camera]);

  return null;
}

export default function KeySwitchPreview() {
  const [explode, setExplode] = useState(1);
  const [focus, setFocus] = useState<FocusKey>("all");

  return (
    <main className="relative h-svh w-full bg-black">
      <Canvas
        camera={{ position: [0.6, 0.37, 1.42], fov: 30 }}
        gl={{
          antialias: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1,
        }}
        dpr={[1, 2]}
      >
        {/* The board's rig, third copy — see the original in KeyboardReveal.
            This one had been left behind: it was still carrying the warm values
            from before the hero was first pulled back, so the same switch was
            lit hotter here than in the anatomy section. It renders the same
            materials, so it gets the same light. */}
        <ambientLight intensity={0.14} color="#fafcff" />
        <directionalLight
          position={[-4, 6, 5]}
          intensity={2.1}
          color="#fdfaf6"
        />
        <directionalLight
          position={[5, 1, 4]}
          intensity={0.55}
          color="#c4d3ea"
        />
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

        <KeySwitch explode={explode} />
        <OrbitControls
          makeDefault
          enablePan
          minDistance={0.12}
          maxDistance={6}
        />
        <Framing focus={focus} explode={explode} />
      </Canvas>

      <div className="absolute bottom-8 left-1/2 flex w-[min(34rem,86vw)] -translate-x-1/2 flex-col gap-3">
        <div className="flex justify-center gap-1.5">
          {(Object.keys(FOCUS) as FocusKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setFocus(key)}
              className={`rounded-full px-3 py-1.5 text-[0.7rem] tracking-widest uppercase transition ${
                focus === key
                  ? "bg-[#a8401d] text-white"
                  : "bg-white/5 text-white/45 hover:text-white/80"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 rounded-full bg-white/5 px-5 py-3 backdrop-blur">
          <span className="text-[0.7rem] tracking-widest text-white/45 uppercase">
            Explode
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={explode}
            onChange={(event) => setExplode(Number(event.target.value))}
            className="h-1 flex-1 accent-[#a8401d]"
          />
          <span className="w-9 text-right text-xs tabular-nums text-white/45">
            {explode.toFixed(2)}
          </span>
        </div>
      </div>
    </main>
  );
}
