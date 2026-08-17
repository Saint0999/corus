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
   * diorama around (0, 0, 0), which keeps every other number in this file
   * simple — most importantly the <ContactShadows> plane, which can then sit at
   * plain `[0, -1.4, 0]` directly beneath the plinth.
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
   * canvas happens to be. Since the scene has no controls, this is the single
   * angle the diorama is ever seen from: change it here to re-frame the shot.
   */
  position: [7, 4.4, 7] as Vec3,
  /** A long lens (low fov) flattens perspective and reads as "product shot". */
  fov: 35,
} as const;
