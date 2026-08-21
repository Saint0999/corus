"use client";

import { useLayoutEffect, useMemo } from "react";
import { BufferGeometry, Color, MeshStandardMaterial } from "three";
import { edgeFalloff } from "@/components/model/edgeFalloff";
import {
  MM,
  buildKeycap,
  buildLowerCasing,
  buildLowerCasingPins,
  buildStem,
  buildUpperCasing,
} from "./geometry";

/**
 * One key, taken apart: keycap, stem, upper casing, lower casing.
 *
 * The geometry is in `./geometry`; this file is the part that makes it belong
 * to the rest of the site. Everything below — the four colours, the shader
 * patch, the way the layers are stacked — is downstream of the board's own
 * grade in <KeyboardReveal>, and the numbers are lifted from it rather than
 * matched to it by eye.
 *
 * The stack, top to bottom, is also a VALUE ramp: cream cap, coloured stem,
 * mid gunmetal upper casing, near-black lower casing. That was the deciding
 * factor in which palette entry went where — four parts of similar tone read
 * as one blurry object floating apart, and four descending values read as a
 * stack even before the eye has worked out what any of them are. It also puts
 * the one saturated colour on the stem, which is the part with the most shape
 * in it and the one a real switch is colour-coded by.
 *
 * Layers move symmetrically about the middle of the assembly, so exploding it
 * expands the object in place rather than sliding it up the frame — see
 * `LAYERS`.
 */

/** The grade, keyed the same way the board's is, and drawn from the same set.
 *
 * Every row is a palette entry already in use on the board — nothing new is
 * invented here. The keycap and the stem ARE the board's cap materials, at
 * their exact numbers, because they are the same part in the fiction. The two
 * casings borrow the plate and gunmetal rows, and the contacts borrow the
 * case's own aluminium, which is the only metal the site has.
 */
const PARTS = {
  keycap: {
    // `keycap-offwhite`. Off-white PBT, a touch cool, with a semi-matte sheen.
    color: "#e9eaed",
    metalness: 0,
    roughness: 0.42,
    env: 1.15,
  },
  stem: {
    // Blue, and the default rather than a choice: a switch's slider is the one
    // part of a keyboard that is colour-coded by convention, and blue is the
    // one everybody knows. It is also the value this part needs — a mid,
    // saturated hue holds its own between the off-white cap above it and the
    // two near-black housings below, which is what the terracotta that used to
    // be here was doing.
    //
    // Overridable per layer through `tint` — see below. The switch close-up
    // offers the usual four.
    color: "#2f5fc4",
    metalness: 0,
    roughness: 0.34,
    env: 1.25,
  },
  upper: {
    // `aluminium-gunmetal`. Mid-dark, the value step between the off-white
    // above it and the near-black below.
    color: "#46484c",
    metalness: 0.7,
    roughness: 0.45,
    env: 1.4,
  },
  lower: {
    // `switch-plate`. Near-black: on the board this is the surface the caps
    // sit in, and it is the right floor for the stack for the same
    // reason — it anchors the bottom without competing with anything above it.
    //
    // Colour, metalness and roughness are the board's numbers exactly. The
    // environment intensity is the one figure raised, from 1 to 1.7, and the
    // reason is that the row was graded for a surface which BARELY SEES the
    // room: on the board it is the floor of a trench between keycaps, and a
    // low env there is physically right. Here the same material is a
    // free-standing object with nothing above it, and left at 1 it read as a
    // black hole in the page rather than as the bottom of the stack. Raising
    // what it can see is the honest fix; lightening the colour would have put
    // a fifth grey into a palette that has enough.
    color: "#292a2d",
    metalness: 0.35,
    roughness: 0.55,
    env: 1.7,
  },
  pins: {
    // `aluminium-silver`. The case metal, and the only metal on the site.
    color: "#a8abaf",
    metalness: 0.6,
    roughness: 0.36,
    env: 1.5,
  },
} as const;

export type PartName = keyof typeof PARTS;

/**
 * Where each layer sits when assembled, and how far it travels when the stack
 * comes apart — both in millimetres, in the same space the geometry is
 * authored in.
 *
 * `rest` is where the part actually belongs: the upper casing's skirt lands on
 * the ledge moulded into the lower casing, the stem's collar sits just under
 * the top plate with its cross through the aperture, and the cap hangs four
 * tenths of a millimetre clear of the housing — the gap a pressed key closes.
 * Assembled, this is a switch that would work.
 *
 * `travel` is signed and roughly balanced, so the assembly grows about its own
 * middle. One-directional offsets — everything sliding up off a fixed bottom
 * housing — leave the stack's centre of mass climbing out of frame as it
 * opens, which then has to be undone by moving the camera.
 */
export const LAYERS: Record<PartName, { rest: number; travel: number }> = {
  keycap: { rest: 10.45, travel: 18 },
  stem: { rest: 9.4, travel: 8 },
  upper: { rest: 4.2, travel: -5.5 },
  lower: { rest: 0, travel: -18 },
  pins: { rest: 0, travel: -18 },
};

/**
 * The assembly's own middle, in millimetres — from the tips of the contacts to
 * the top of the cap. Subtracted at the root so the group's origin is the
 * middle of the object and it can be positioned and rotated like any other
 * prop, rather than pivoting around the underside of the bottom housing.
 *
 * A measured `Box3` would drift as the stack opened and quietly rescale the
 * object mid-animation; this is authored, so it does not.
 */
const CENTRE = 7.0;

/**
 * Where a layer's origin sits, in WORLD units, at a given explode value.
 *
 * The same expression the meshes are positioned by, exported so that anything
 * wanting to point at a layer — a camera, a caption, a leader line — reads it
 * from here instead of re-deriving it and slowly going out of step.
 */
export function layerY(part: PartName, explode: number) {
  const { rest, travel } = LAYERS[part];
  return (rest + travel * explode - CENTRE) * MM;
}

/**
 * Where the copies of a defocused layer are drawn, as unit offsets on a disc.
 *
 * There is no such thing as blurring one object in a 3D scene: a fragment
 * cannot see its neighbours, and the usual answer — render the scene to a
 * target and blur that — blurs everything in it, which is the opposite of what
 * is wanted when the point is that ONE part is going soft while another stays
 * sharp. So the layer is accumulated instead: drawn several times, spread over
 * a small disc, each at a fraction of its opacity. Overlapping copies sum back
 * to roughly the original in the middle and trail off at the edges, which is
 * what a defocus looks like.
 *
 * Six around one is the smallest arrangement that reads as a disc — four reads
 * as a cross, and two reads as a double exposure. It is only ever used on
 * layers that are on their way out, so it costs nothing in the still frames at
 * either end of a reveal.
 *
 * The offsets are in the assembly's own xy plane rather than in screen space,
 * so a turned assembly squashes the disc slightly and gives the copies a hair
 * of depth between them. At these radii neither is visible, and the alternative
 * is threading the camera's basis through the model.
 */
const TAPS: readonly [number, number][] = [
  [0, 0],
  ...Array.from({ length: 6 }, (_, i): [number, number] => {
    const angle = (i / 6) * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  }),
];

function material(part: PartName) {
  const spec = PARTS[part];
  const made = new MeshStandardMaterial({
    color: new Color(spec.color),
    metalness: spec.metalness,
    roughness: spec.roughness,
    envMapIntensity: spec.env,
  });
  // The house treatment: the silhouette rolls down into the page instead of
  // ending on a hard bright edge. Same function the board's materials get.
  edgeFalloff(made);
  return made;
}

/**
 * The four layers, plus the contacts that travel with the lower casing.
 *
 * `explode` is 0 for a working switch and 1 for the stack fully open, and
 * nothing here decides which — it is driven from outside, so the same
 * component serves a scroll-linked reveal, a hover, or a static hero frame.
 *
 * `fade`, `blur`, `tint` and `drift` are the same idea applied to how a layer
 * is drawn: per-layer opacity, per-layer defocus in millimetres, per-layer
 * colour, and a per-layer offset in millimetres away from where the stack puts
 * it. Which layers are leaving, which way they go, how soft they get on the
 * way out and what colour the switch is all belong to the shot rather than to
 * the model. Anything left out of a map keeps the default, so the plain case
 * costs nothing.
 *
 * `drift` is deliberately not part of `explode`. The come-apart is the stack
 * opening ALONG its axis and every layer shares it; a drift is one layer being
 * sent somewhere, which is what a part being dismissed from the shot looks
 * like. Folding the second into the first would mean the camera could no
 * longer trust `layerY` to say where anything is.
 */
export function KeySwitch({
  explode = 0,
  fade,
  blur,
  tint,
  drift,
}: {
  explode?: number;
  fade?: Partial<Record<PartName, number>>;
  blur?: Partial<Record<PartName, number>>;
  tint?: Partial<Record<PartName, string>>;
  drift?: Partial<Record<PartName, readonly [number, number, number]>>;
}) {
  // Built once. These are a few thousand triangles of trigonometry and shape
  // triangulation, and none of it depends on anything that changes.
  const parts = useMemo(
    () => ({
      keycap: buildKeycap(),
      stem: buildStem(),
      upper: buildUpperCasing(),
      lower: buildLowerCasing(),
      pins: buildLowerCasingPins(),
    }),
    [],
  );

  const materials = useMemo(
    () => ({
      keycap: material("keycap"),
      stem: material("stem"),
      upper: material("upper"),
      lower: material("lower"),
      pins: material("pins"),
    }),
    [],
  );

  // Applied to the materials rather than passed down as a prop, because these
  // are built imperatively — see `material` — and there is no JSX element to
  // hang an `opacity` on.
  //
  // Deliberately without a dependency array: `fade` is a fresh object on every
  // render and this has to follow it. Setting five numbers is cheaper than
  // deciding whether it needs to be set.
  useLayoutEffect(() => {
    (Object.keys(materials) as PartName[]).forEach((name) => {
      const value = fade?.[name] ?? 1;
      const made = materials[name];
      const shade = tint?.[name];

      if (shade) made.color.set(shade);

      made.transparent = value < 1;
      // Split across the copies when the layer is being accumulated, so a
      // defocused layer is no denser than a sharp one.
      made.opacity = (blur?.[name] ?? 0) > 0 ? value / TAPS.length : value;
      // A half-faded layer must not write depth, or it punches a hole in
      // whatever is behind it: these five parts overlap on screen for most of
      // the come-apart, and the ones on their way out are exactly the ones
      // that would be doing the punching.
      made.depthWrite = value >= 1;
    });
  });

  const layer = (name: PartName, geometry: BufferGeometry) => {
    // Fully faded is not drawn at all: it saves the draw calls, and more to the
    // point it keeps a part that is no longer there out of the transparent
    // sort.
    if ((fade?.[name] ?? 1) <= 0) return null;

    // Divided back out of world units so positions are expressed in the
    // millimetres this group is scaled from — `layerY` is the shared
    // definition, and this is the one place it has to be unwound.
    const [driftX, driftY, driftZ] = drift?.[name] ?? [0, 0, 0];
    const x = driftX;
    const y = layerY(name, explode) / MM + driftY;
    const z = driftZ;
    const radius = blur?.[name] ?? 0;

    if (radius <= 0) {
      return (
        <mesh
          key={name}
          geometry={geometry}
          material={materials[name]}
          position={[x, y, z]}
        />
      );
    }

    return TAPS.map(([dx, dy], index) => (
      <mesh
        key={`${name}-${index}`}
        geometry={geometry}
        material={materials[name]}
        position={[x + dx * radius, y + dy * radius, z]}
      />
    ));
  };

  // Scaled from millimetres at the root, once. Everything inside is at the
  // part's real dimensions — see the note at the top of ./geometry.
  return (
    <group scale={MM}>
      {layer("keycap", parts.keycap)}
      {layer("stem", parts.stem)}
      {layer("upper", parts.upper)}
      {layer("lower", parts.lower)}
      {layer("pins", parts.pins)}
    </group>
  );
}
