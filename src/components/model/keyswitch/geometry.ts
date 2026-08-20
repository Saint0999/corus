/**
 * The key and its switch, modelled in code.
 *
 * None of this exists in `corus-keyboard.glb`. That file has keycaps as 336-
 * triangle shells with nothing underneath them, and its "switch plate" is a
 * twelve-triangle slab — fine at board scale, where a cap is forty pixels
 * across, and nowhere near enough for a part that is meant to fill the frame.
 * So the close-up is built here instead, at a density chosen for a hero shot
 * rather than for a hundred repeats of the same object.
 *
 * Everything is authored in MILLIMETRES, at the real dimensions of the part:
 * the cap is 18.6 mm square and 8.5 mm tall because that is what the caps on
 * the board measure, and the switch under it is a Cherry MX footprint. Working
 * at true scale is what keeps the proportions between the four layers honest —
 * the stem really is that small next to the cap that hides it. `MM` at the
 * bottom converts to world units once, at the assembly's root.
 *
 * The surfaces are built by LOFTING rounded-rectangle rings. A keycap, a top
 * housing and a bottom housing are the same thing geometrically — a tapered
 * tube with a rounded profile, closed at one end — so one ring loft with a
 * per-point height function does all three, and the shapes differ only in
 * their tables of rings. Boxes and cylinders are left to three's own
 * primitives, and the two cross-sections (the stem's mount and the socket it
 * goes into) are extruded shapes.
 *
 * Two conventions the whole file depends on:
 *
 *  - Rings run counterclockwise in the XZ plane, and a loft from ring A to
 *    ring B winds so its normal is (B - A) x tangent. Lofting bottom-to-top
 *    therefore faces OUTWARD, and lofting outer-to-inner across a flat step
 *    faces UP. `flip` reverses both, which is how the inside of a cavity and
 *    the underside of a rim get built from the same helper.
 *  - Each SURFACE is its own geometry, normalised on its own, and the pieces
 *    are merged afterwards. Merging welds nothing, so a surface is smooth
 *    along itself — round a corner, up a taper — while the joins between
 *    surfaces stay as hard edges. Building one geometry and smoothing it
 *    globally would round off every edge in the part; building it all as
 *    loose triangles would facet the corners. This gets both.
 */

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Points per 90 degrees of corner. Every ring in a loft has to carry the same
 * count for its vertices to correspond, so this is global rather than per
 * shape.
 *
 * Nine is chosen with headroom rather than to a measurement: the corners are
 * already clean at seven on a half-width view, and the whole assembly at nine
 * is under 7k triangles — a rounding error for one object on screen, and a
 * cheaper insurance policy than discovering faceting on a retina display at
 * full frame. The board's hundred-odd keycaps are the place to count
 * triangles; this is one part, and it is meant to be looked at.
 */
const CORNER = 9;

/** Millimetres to world units. The board is ~330 mm across and spans 3.2. */
export const MM = 3.2 / 330;

/**
 * A rounded-rectangle ring: half-extents, corner radius, and a height that is
 * either flat or a function of position — which is what lets the dished top of
 * the keycap be a ring like any other rather than a special case.
 */
type Ring = {
  hx: number;
  hz: number;
  r: number;
  y: number | ((x: number, z: number) => number);
};

/**
 * One ring, as a flat [x, y, z, ...] run.
 *
 * The four corner arcs are swept in turn and the straight edges between them
 * fall out of the gaps — the last point of one arc and the first of the next
 * are the ends of an edge, so no separate edge points are needed and the ring
 * closes without a duplicated seam vertex. That matters: a duplicated seam is
 * a hard crease down the side of every part, because the two copies each
 * average only half the faces that meet there.
 */
function ringVertices(ring: Ring, scale = 1): number[] {
  const hx = ring.hx * scale;
  const hz = ring.hz * scale;
  // Clamped away from zero: a radius of 0 collapses each corner arc to the
  // same point repeated, and a fan of degenerate triangles has no normal.
  const r = Math.max(0.02, Math.min(ring.r * scale, Math.min(hx, hz)));

  const cx = hx - r;
  const cz = hz - r;
  const centres: [number, number][] = [
    [cx, cz],
    [-cx, cz],
    [-cx, -cz],
    [cx, -cz],
  ];

  const out: number[] = [];
  for (let c = 0; c < 4; c++) {
    const [ox, oz] = centres[c];
    for (let s = 0; s <= CORNER; s++) {
      const a = ((c + s / CORNER) * Math.PI) / 2;
      const x = ox + r * Math.cos(a);
      const z = oz + r * Math.sin(a);
      out.push(x, typeof ring.y === "function" ? ring.y(x, z) : ring.y, z);
    }
  }
  return out;
}

/**
 * Lofts a stack of rings into a surface, optionally closing the last one to a
 * point.
 *
 * `apex` is what makes a dish or a dome possible: the innermost ring is
 * stitched to a single vertex instead of to another ring. Insetting rings all
 * the way to zero instead would end in a ring of coincident points, and every
 * triangle touching it would be degenerate.
 */
function loft(
  rings: number[][],
  flip = false,
  apex?: [number, number, number],
): BufferGeometry {
  const count = rings[0].length / 3;
  const position: number[] = [];
  for (const ring of rings) position.push(...ring);

  const apexIndex = rings.length * count;
  if (apex) position.push(...apex);

  const index: number[] = [];
  const quad = (a: number, b: number, c: number) => {
    // One place decides handedness for the whole file.
    if (flip) index.push(a, c, b);
    else index.push(a, b, c);
  };

  for (let r = 0; r + 1 < rings.length; r++) {
    const lo = r * count;
    const hi = (r + 1) * count;
    for (let i = 0; i < count; i++) {
      // Wraps rather than duplicating the seam — see `ringVertices`.
      const j = (i + 1) % count;
      quad(lo + i, hi + i, lo + j);
      quad(lo + j, hi + i, hi + j);
    }
  }

  if (apex) {
    const last = (rings.length - 1) * count;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      quad(last + i, apexIndex, last + j);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A tapered tube: rings bottom to top, facing out (or in, flipped). */
function tube(rings: Ring[], flip = false) {
  return loft(rings.map((ring) => ringVertices(ring)), flip);
}

/**
 * A flat step between two outlines at the same height — a rim, a shoulder, the
 * ledge a housing sits on. Outer first faces up; `flip` faces it down.
 */
function step(outer: Ring, inner: Ring, flip = false) {
  return loft([ringVertices(outer), ringVertices(inner)], flip);
}

/**
 * Closes a ring off with a surface, by insetting it towards its own centre in
 * `steps` stages and finishing on a point. The ring's height function is
 * evaluated afresh at every inset ring, so a dish, a dome or a flat lid are
 * the same call with a different `y`.
 */
function lid(boundary: Ring, steps: number, flip = false) {
  const rings: number[][] = [];
  for (let i = 0; i < steps; i++) {
    // Eased rather than linear: the inset rings bunch up towards the RIM,
    // where a dished surface bends hardest, and thin out across the middle,
    // which is nearly flat and does not need them.
    const t = i / steps;
    rings.push(ringVertices(boundary, 1 - t * t));
  }
  const centre = typeof boundary.y === "function" ? boundary.y(0, 0) : boundary.y;
  return loft(rings, flip, [0, centre, 0]);
}

/** Strips a geometry down to what every other piece here also carries. */
function prep(geometry: BufferGeometry): BufferGeometry {
  // `mergeGeometries` refuses a set that disagrees about attributes or about
  // being indexed at all — and three's primitives arrive with UVs and their
  // own indexing while the lofts above arrive without. Nothing in this file is
  // textured, so the fix is to drop UVs and flatten everything to non-indexed.
  // Un-indexing preserves the normals already computed, so the smooth shading
  // established per surface survives the merge.
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.deleteAttribute("uv");
  flat.deleteAttribute("uv1");
  return flat;
}

/** Merges a set of surfaces into the one geometry a single mesh can draw. */
function weld(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts.map(prep), false);
  if (!merged) throw new Error("key-switch: geometry merge failed");
  return merged;
}

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

function cylinder(
  rTop: number,
  rBottom: number,
  h: number,
  x: number,
  y: number,
  z: number,
): BufferGeometry {
  const geometry = new CylinderGeometry(rTop, rBottom, h, 24);
  geometry.translate(x, y, z);
  return geometry;
}

/**
 * The MX cross, as a plane figure. Used twice and at two sizes: as the stem's
 * mount, and — grown by the moulding clearance — as the hole through the boss
 * inside the keycap that receives it. Deriving both from one function is what
 * guarantees the two actually fit.
 */
function crossShape(arm: number, thickness: number): Shape {
  const a = arm / 2;
  const t = thickness / 2;
  const shape = new Shape();
  shape.moveTo(t, t);
  shape.lineTo(a, t);
  shape.lineTo(a, -t);
  shape.lineTo(t, -t);
  shape.lineTo(t, -a);
  shape.lineTo(-t, -a);
  shape.lineTo(-t, -t);
  shape.lineTo(-a, -t);
  shape.lineTo(-a, t);
  shape.lineTo(-t, t);
  shape.lineTo(-t, a);
  shape.lineTo(t, a);
  shape.closePath();
  return shape;
}

/**
 * A rounded rectangle, for extruded plates that need the same profile.
 *
 * Offset is taken as arguments rather than applied afterwards: `Shape` has no
 * transform of its own, and the rail slots below are the same outline placed
 * twice.
 */
function roundedRect(
  hx: number,
  hz: number,
  r: number,
  ox = 0,
  oz = 0,
): Shape {
  const shape = new Shape();
  shape.moveTo(ox - hx + r, oz - hz);
  shape.lineTo(ox + hx - r, oz - hz);
  shape.quadraticCurveTo(ox + hx, oz - hz, ox + hx, oz - hz + r);
  shape.lineTo(ox + hx, oz + hz - r);
  shape.quadraticCurveTo(ox + hx, oz + hz, ox + hx - r, oz + hz);
  shape.lineTo(ox - hx + r, oz + hz);
  shape.quadraticCurveTo(ox - hx, oz + hz, ox - hx, oz + hz - r);
  shape.lineTo(ox - hx, oz - hz + r);
  shape.quadraticCurveTo(ox - hx, oz - hz, ox - hx + r, oz - hz);
  return shape;
}

/**
 * Extrudes a shape upwards in Y. Shapes are authored in XY and three extrudes
 * along Z, so everything here is built lying down and stood up afterwards.
 */
function extrude(
  shape: Shape,
  depth: number,
  y: number,
  bevel = 0,
): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

/* ------------------------------------------------------------------ keycap */

/** Matches the caps on the board: 18.6 mm square, 8.5 mm tall. */
const CAP_H = 8.5;
const CAP_WALL = 1.25;
const CAP_CEIL = 1.5;

/**
 * The dish, as a drop from the top plane.
 *
 * Cherry profile is a CYLINDRICAL dish whose axis runs left to right, so the
 * valley runs along X and the depth is governed by z — the front and back
 * edges of the cap stand full height and the middle of each side dips. A
 * little of the same in x on top of it keeps the four corners from standing
 * proud of everything around them.
 *
 * It is evaluated per vertex rather than baked into a ring's height, so the
 * top RIM dips with it. That dip is the detail that reads as a real keycap
 * from the side: a flat-rimmed dish looks like a bowl set into a block.
 */
function dish(x: number, z: number, hx: number, hz: number): number {
  const u = Math.min(1, Math.abs(x) / hx);
  const v = Math.min(1, Math.abs(z) / hz);
  return -(0.78 * (1 - v * v) + 0.2 * (1 - u * u));
}

export function buildKeycap(): BufferGeometry {
  // The taper, as a table. Reading down the hx column is the cap's silhouette:
  // nearly straight for the first half millimetre, then drawing in steadily,
  // with the corner radius opening out the whole way — a cap is much rounder
  // at the top than at the skirt, and that changing radius is most of what
  // separates a moulded cap from a truncated pyramid.
  //
  // The radii are the numbers to be careful with. They were half again as
  // large to begin with, and the cap came out as a bar of soap: past roughly a
  // quarter of the half-width the four corner arcs meet before the straight
  // edges between them have any length left, and the square stops being a
  // square. The last two rows are close together for the same reason — the
  // roll from the wall over into the dish is a real edge on a real cap, and
  // spreading it over the top third of the height inflates it into a pillow.
  const profile: [number, number, number][] = [
    [0.0, 9.3, 0.85],
    [0.5, 9.28, 0.9],
    [3.0, 8.62, 1.15],
    [5.6, 7.9, 1.45],
    [7.5, 7.35, 1.7],
    [8.05, 7.15, 1.88],
    [8.32, 7.0, 2.05],
  ];

  // The top ring's own half-extent is what the dish is normalised against, so
  // the drop reaches full depth exactly at the rim and nowhere short of it.
  const rim = profile[profile.length - 1][1];
  const topY = (x: number, z: number) => CAP_H + dish(x, z, rim, rim);

  const outer: Ring[] = profile.map(([y, hx, r], i) =>
    i === profile.length - 1
      ? { hx, hz: hx, r, y: topY }
      : { hx, hz: hx, r, y },
  );

  // The cavity mirrors the outside one wall thickness in, so the cap has an
  // even section everywhere instead of pooling plastic in the corners.
  const inner: Ring[] = profile.map(([y, hx, r]) => ({
    hx: hx - CAP_WALL,
    hz: hx - CAP_WALL,
    r: Math.max(0.4, r - CAP_WALL * 0.5),
    y,
  }));
  const ceilingRing = inner[inner.length - 1];
  const ceiling: Ring = {
    ...ceilingRing,
    y: (x: number, z: number) => topY(x, z) - CAP_CEIL,
  };
  inner[inner.length - 1] = ceiling;

  // The socket. A boss hanging off the underside of the ceiling with the mount
  // cross bored through it — the part that actually grips the stem, and the
  // only reason the underside of a keycap is worth modelling at all.
  const bossH = 4.1;
  const bossY = (typeof ceiling.y === "function" ? ceiling.y(0, 0) : ceiling.y) - bossH;
  const boss = roundedRect(2.85, 2.35, 0.7);
  boss.holes.push(crossShape(4.35, 1.5));

  return weld([
    tube(outer),
    lid(outer[outer.length - 1], 7),
    tube(inner, true),
    lid(ceiling, 5, true),
    step(outer[0], inner[0], true),
    extrude(boss, bossH, bossY),
    // Four ribs bracing the boss to the walls, as moulded caps have. They are
    // only ever seen while the cap hangs above the stem with its underside to
    // the camera, which in an exploded stack is exactly where it hangs.
    box(0.85, bossH * 0.8, 4.6, 0, bossY + bossH * 0.6, 3.6),
    box(0.85, bossH * 0.8, 4.6, 0, bossY + bossH * 0.6, -3.6),
    box(4.6, bossH * 0.8, 0.85, 3.6, bossY + bossH * 0.6, 0),
    box(4.6, bossH * 0.8, 0.85, -3.6, bossY + bossH * 0.6, 0),
  ]);
}

/* -------------------------------------------------------------------- stem */

/**
 * The stem, built downwards from its shoulder — local y = 0 is the top face of
 * the wide collar, so the cross sticks up into positive y and everything that
 * lives inside the housings hangs below it.
 */
export function buildStem(): BufferGeometry {
  const post = extrude(crossShape(4.1, 1.22), 3.85, 0, 0.1);

  const collar: Ring[] = [
    { hx: 3.5, hz: 2.7, r: 0.3, y: -1.15 },
    { hx: 3.5, hz: 2.7, r: 0.3, y: -0.2 },
    { hx: 3.35, hz: 2.55, r: 0.32, y: 0 },
  ];

  // Down to -6.6, not -3.9. A stem is about ten and a half millimetres long
  // and only the top four of those are the cross — the rest is the barrel that
  // rides inside the housings. Cut short, the part reads as a cross on a
  // pedestal rather than as a slider, and the proportion is the whole tell.
  const body: Ring[] = [
    { hx: 2.95, hz: 2.1, r: 0.25, y: -6.6 },
    { hx: 3.15, hz: 2.25, r: 0.25, y: -6.0 },
    { hx: 3.2, hz: 2.3, r: 0.25, y: -1.15 },
  ];

  // The spring bore: a blind hole up into the body from the underside. Its
  // mouth ring is reused three times — as the inner edge of the underside, as
  // the bore wall, and as the ring the blind end is closed off from — so the
  // three cannot drift apart.
  const boreMouth: Ring = { hx: 1.55, hz: 1.55, r: 1.55, y: -6.6 };
  const boreEnd: Ring = { hx: 1.55, hz: 1.55, r: 1.55, y: -2.6 };
  const underside: Ring = { hx: 2.15, hz: 1.75, r: 0.3, y: -6.6 };

  // The leg: the ramp on the front of the stem that rides down the contact
  // leaf, and the one feature that says which way round the part goes. Built
  // about the origin like everything else and moved onto the face afterwards —
  // a loft has no way to be off-centre, so the geometry is offset instead.
  const legRings: Ring[] = [
    { hx: 1.5, hz: 0.6, r: 0.2, y: -6.4 },
    { hx: 1.5, hz: 0.6, r: 0.2, y: -4.2 },
    { hx: 1.5, hz: 0.18, r: 0.08, y: -3.0 },
  ];
  const leg = weld([tube(legRings), lid(legRings[2], 2), lid(legRings[0], 2, true)]);
  leg.translate(0, 0, -2.45);

  return weld([
    post,
    tube(collar),
    // A SOLID lid, with the cross simply standing on it. Stepping in to a
    // square hole the size of the cross would leave the four notches between
    // its arms open into the hollow collar, and at this scale that is a hole
    // straight through the part.
    lid(collar[2], 4),
    tube(body),
    step(collar[0], body[2], true),
    step(body[0], underside, true),
    step(underside, boreMouth, true),
    tube([boreMouth, boreEnd], true),
    lid(boreEnd, 3, true),
    // Slider rails. The fins that run in the top housing's grooves and hold
    // the stem square as it travels — the reason a switch does not rattle.
    // Their span is what the aperture's rail slots are cut to clear.
    box(1.2, 4.4, 1.15, 3.4, -3.6, 0),
    box(1.2, 4.4, 1.15, -3.4, -3.6, 0),
    leg,
  ]);
}

/* ----------------------------------------------------------- upper housing */

/**
 * Top housing. Local y = 0 is the bottom of its skirt — the plane where it
 * meets the ledge on the bottom housing — so the whole part sits in positive
 * y and stacking it is a single offset.
 */
const UPPER_H = 5.85;
const UPPER_WALL = 1.15;

export function buildUpperCasing(): BufferGeometry {
  // Near-vertical for the first three and a half millimetres, then a shoulder
  // chamfering in to the plateau the aperture is cut through.
  //
  // NOT the cap's profile at a smaller scale, which is what this was to begin
  // with and why it came out as a lampshade: a keycap is a tapered thing all
  // the way up, and a top housing is a box that happens to be chamfered at the
  // top. Drawing the walls in from the first millimetre loses the vertical
  // face that makes it read as a housing — and leaves the latch windows
  // standing off a sloped surface with daylight behind them.
  const profile: [number, number, number][] = [
    [0.0, 7.0, 0.5],
    [0.45, 7.0, 0.52],
    // The shoulder breaks here — see the split loft below.
    [3.95, 6.88, 0.6],
    [4.6, 6.5, 0.75],
    [5.05, 6.12, 0.9],
  ];
  const SHOULDER = 2;

  const outer: Ring[] = profile.map(([y, hx, r]) => ({ hx, hz: hx, r, y }));
  const inner: Ring[] = profile.map(([y, hx, r]) => ({
    hx: hx - UPPER_WALL,
    hz: hx - UPPER_WALL,
    r: Math.max(0.3, r - 0.3),
    y,
  }));

  const plateY = 5.05;
  const plateH = UPPER_H - plateY;

  // The top plate, with the stem aperture through it. Extruding a shape with
  // holes is what gives the aperture real walls rather than a painted-on
  // outline, and the two rail slots either side of it are the grooves the
  // stem's fins run in — the detail that explains, at a glance, how the two
  // parts above and below are meant to go together.
  const top = profile[profile.length - 1];
  const plate = roundedRect(top[1], top[1], top[2]);
  plate.holes.push(roundedRect(3.6, 2.8, 0.5));
  plate.holes.push(roundedRect(0.62, 0.72, 0.2, 4.02, 0));
  plate.holes.push(roundedRect(0.62, 0.72, 0.2, -4.02, 0));

  const latch = (side: number) =>
    // A latch window: four bars framing a rectangular opening, standing a
    // fraction proud of the skirt. Cutting a real hole would mean breaking the
    // loft into panels; a frame reads identically and leaves the shell whole.
    [
      box(0.36, 2.9, 4.2, side * 6.9, 1.9, 0),
      box(0.7, 0.7, 4.2, side * 7.15, 3.0, 0),
      box(0.7, 0.7, 4.2, side * 7.15, 0.8, 0),
      box(0.7, 2.9, 0.72, side * 7.15, 1.9, 1.72),
      box(0.7, 2.9, 0.72, side * 7.15, 1.9, -1.72),
    ];

  return weld([
    // The wall and the shoulder are lofted SEPARATELY, and that is the whole
    // point of splitting the profile: surfaces are smoothed individually and
    // merged without welding, so two lofts meeting at a shared ring leave a
    // hard crease where one loft running through it would round the shoulder
    // off into the wall. That soft roll is what made this read as the roof of
    // a car rather than as a moulded housing.
    tube(outer.slice(0, SHOULDER + 1)),
    tube(outer.slice(SHOULDER)),
    // The inside stays a single smooth loft. It is barely seen, and there is
    // no edge in there worth the extra surface.
    tube(inner, true),
    step(outer[0], inner[0], true),
    extrude(plate, plateH, plateY),
    ...latch(1),
    ...latch(-1),
  ]);
}

/* ----------------------------------------------------------- lower housing */

/**
 * Bottom housing. Local y = 0 is the underside of its floor; the mount posts
 * and pins hang below that into negative y, which is what the exploded stack
 * shows off and what an assembled switch buries in a PCB.
 */
const LOWER_H = 5.5;
const LOWER_LEDGE = 4.2;
const LOWER_FLOOR = 1.15;

export function buildLowerCasing(): BufferGeometry {
  // Two diameters with a step between them: the lower half is the full
  // footprint, and above the ledge it narrows by exactly the top housing's
  // wall so that part can skirt over it flush. The step is a real feature of
  // the assembly, not a decoration — it is why the two halves close.
  const wide: Ring[] = [
    { hx: 6.85, hz: 6.85, r: 0.45, y: 0 },
    { hx: 6.85, hz: 6.85, r: 0.45, y: LOWER_LEDGE },
  ];
  const narrow: Ring[] = [
    { hx: 5.82, hz: 5.82, r: 0.38, y: LOWER_LEDGE },
    { hx: 5.82, hz: 5.82, r: 0.38, y: LOWER_H },
  ];
  const cavity: Ring[] = [
    { hx: 4.85, hz: 4.85, r: 0.3, y: LOWER_FLOOR },
    { hx: 4.85, hz: 4.85, r: 0.3, y: LOWER_H },
  ];

  const nub = (side: number) => [
    // The catches the top housing's latches close onto. They sit BELOW the
    // ledge, on the full-width part of the shell — which is where the skirt
    // coming down over the top of them leaves them, and which means the two
    // halves mate in the exploded view without either part having to pass
    // through the other once it closes.
    box(0.55, 1.4, 3.0, side * 7.0, LOWER_LEDGE - 0.85, 0),
  ];

  return weld([
    tube(wide),
    step(wide[1], narrow[0]),
    tube(narrow),
    step(narrow[1], cavity[1], false),
    tube(cavity, true),
    // Floor, seen from inside and from underneath.
    lid({ hx: 4.85, hz: 4.85, r: 0.4, y: LOWER_FLOOR }, 3),
    // Stepped in to just INSIDE the mount post's radius, so the two overlap
    // rather than meeting exactly: a ring and a cylinder approximate their
    // circles at different segment counts, and an exact meeting is a hairline
    // of daylight into the shell all the way round.
    step(wide[0], { hx: 1.82, hz: 1.82, r: 1.82, y: 0 }, true),
    // Spring post, standing in the middle of the floor.
    cylinder(1.5, 1.75, 2.5, 0, LOWER_FLOOR + 1.25, 0),
    // Mount posts underneath: the fat centre boss and the two locating pins,
    // at the 5.08 mm pitch a PCB is drilled to.
    cylinder(1.9, 1.95, 3.3, 0, -1.65, 0),
    cylinder(0.85, 0.85, 3.0, 5.08, -1.5, 0),
    cylinder(0.85, 0.85, 3.0, -5.08, -1.5, 0),
    ...nub(1),
    ...nub(-1),
  ]);
}

/**
 * The switch's two contacts, where they leave the housing.
 *
 * Its own geometry because it is the only METAL on the part, and metal is a
 * different material rather than a different colour — see the grade. It
 * belongs to the lower casing as a LAYER, and moves with it.
 */
export function buildLowerCasingPins(): BufferGeometry {
  const pin = (x: number, z: number) => [
    box(1.5, 0.5, 0.85, x, -1.9, z),
    box(1.1, 3.2, 0.42, x, -3.4, z),
  ];
  return weld([...pin(-3.81, 2.54), ...pin(2.54, -5.08)]);
}
