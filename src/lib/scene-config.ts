/**
 * Everything tunable about the 3D hero lives here, measured from the actual
 * `gaming-room-diorama.glb` so the numbers aren't guesses:
 *
 *   • world bounds  : min (-4.5, -0.30, -4.5) → max (4.5, 2.46, 4.5)
 *   • the *room*    : sits around (1.45, ·, 1.45), roughly 3.8 × 2.8 × 3.8
 *   • the 9 × 9 flat `backdrop_floor` plane is what makes the bounds so wide
 *
 * Tweak these constants rather than editing the components — that keeps the
 * render code declarative and makes it obvious what is art direction and what
 * is logic.
 */

/** R3F accepts `[x, y, z]`; a mutable tuple type is required (not `as const`). */
export type Vec3 = [number, number, number];

export const DIORAMA = {
  /** Served from /public, so the URL is root-relative. */
  url: "/models/gaming-room-diorama.glb",

  /**
   * The room is modelled off-origin. Shifting it by the negated centre puts the
   * diorama around (0, 0, 0), which lets OrbitControls orbit the model instead
   * of orbiting empty space beside it.
   */
  offset: [-1.45, -1.08, -1.45] as Vec3,

  scale: 1,

  /**
   * The big flat backdrop plane baked into the export. Hidden by default so the
   * diorama appears to float on the charcoal page and drei's <ContactShadows>
   * can ground it instead. Empty this array to see the artist's original stage.
   */
  hiddenNodes: ["backdrop_floor"] as string[],
} as const;

export const CAMERA = {
  /**
   * The room is open towards +X / +Z (its two walls sit on the -X / -Z sides),
   * so the camera has to look in from that corner to see inside it.
   *
   * Only the *direction* of this vector matters in practice — <Bounds> in
   * Scene.tsx recomputes the distance so the diorama fits whatever shape the
   * canvas happens to be.
   */
  position: [7, 4.4, 7] as Vec3,
  /** A long lens (low fov) flattens perspective and reads as "product shot". */
  fov: 35,
} as const;

export const CONTROLS = {
  /** Vertical clamp: never below the plinth, never straight down onto it. */
  minPolarAngle: Math.PI * 0.18,
  maxPolarAngle: Math.PI * 0.48,

  /**
   * Horizontal clamp. The room is only open on two of its four sides, so the
   * camera is fenced into a ~52° arc centred on the diagonal it was authored
   * to be seen from (45°, i.e. Math.PI / 4). Drag past the fence and you would
   * be looking at the blank outside of the walls.
   */
  minAzimuthAngle: Math.PI * 0.11,
  maxAzimuthAngle: Math.PI * 0.39,
  /**
   * Only used if you re-enable zoom. Kept deliberately wide so they can never
   * clamp the distance that <Bounds> picks when it fits the model.
   */
  minDistance: 6,
  maxDistance: 40,
} as const;

/** Idle animation for the model itself — see IdleSway.tsx. */
export const SWAY = {
  /** Half the sweep in radians (0.14 ≈ 8°). */
  amplitude: 0.14,
  speed: 0.25,
} as const;
