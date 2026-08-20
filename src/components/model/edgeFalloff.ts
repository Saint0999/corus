import { Material } from "three";

/**
 * Edge falloff, as a fraction of the surface's own lit colour removed where it
 * turns fully away from the camera, and the curve it is ramped in on. This is
 * deliberately the OPPOSITE of a physical fresnel rim — the point is to take
 * the silhouette down towards the background rather than to light it up, so
 * an object dissolves into the page at its edges.
 */
const EDGE_FALLOFF = 0.55;
const EDGE_POWER = 2.2;

/**
 * Patches a few lines into a material's fragment shader that darken the
 * surface as it turns away from the camera.
 *
 * This is the "too bright against the black" fix that a vignette alone cannot
 * do: the vignette works in screen space and knows nothing about the object,
 * so it cannot tell the middle of the spacebar from the case edge beside it.
 * This works in surface space — the further a fragment's normal leans away
 * from the viewer, the more of its lit colour is taken off, so every edge of
 * the object rolls down into the page while the faces that are square-on to
 * the reader keep their full value.
 *
 * `geometryNormal` and `geometryViewDir` are three's own view-space variables,
 * set up by <lights_fragment_begin> and still in scope at <opaque_fragment>,
 * where `outgoingLight` is the final lit colour before tone mapping. Patching
 * BEFORE tone mapping is what makes the falloff grade smoothly with everything
 * else rather than fighting the ACES curve after it.
 *
 * The patch is flagged and applied exactly once, because materials can outlive
 * the component that graded them — anything out of useGLTF's cache is shared
 * across mounts — and running `onBeforeCompile` twice would inject the same
 * block twice and fail to compile.
 *
 * It lives in a module of its own, rather than inside <KeyboardReveal> where it
 * started, for two reasons. It is the house treatment for anything rendered on
 * the black page rather than a property of one model — the key-switch close-up
 * wants the same six lines of GLSL, not a second copy of them. And importing
 * it FROM that component dragged the component's module-scope
 * `useGLTF.preload()` along with it, which quietly fetched 1.5 MB of keyboard
 * on a route that renders no keyboard at all.
 */
export function edgeFalloff(material: Material) {
  if (material.userData.corusEdgeFalloff) return;
  material.userData.corusEdgeFalloff = true;

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      float corusEdge = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
      outgoingLight *= mix(
        1.0,
        1.0 - ${EDGE_FALLOFF.toFixed(3)},
        pow( corusEdge, ${EDGE_POWER.toFixed(3)} )
      );

      #include <opaque_fragment>
      `,
    );
  };

  material.needsUpdate = true;
}
