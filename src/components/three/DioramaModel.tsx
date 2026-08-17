"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";
import { DIORAMA } from "@/lib/scene-config";

/**
 * Loads `gaming-room-diorama.glb` and drops it into the scene graph.
 *
 * `useGLTF` suspends while the file downloads, so this component must always be
 * rendered inside a <Suspense> boundary (see Scene.tsx).
 *
 * The GLB ships its own lighting: 14 warm KHR_lights_punctual point lights plus
 * emissive/unlit LED strips. GLTFLoader turns those into real three.js lights,
 * which is why the scene around it stays deliberately dim — see Scene.tsx.
 */
export function DioramaModel() {
  // `scene` comes out of a global cache shared by every component that asks for
  // this URL, so it must be treated as read-only.
  const { scene } = useGLTF(DIORAMA.url);

  const room = useMemo(() => {
    // Clone before mutating: geometries, materials and textures stay shared
    // (cheap), but hiding a node here can never leak into another mount.
    const clone = scene.clone(true);

    // Collect first, then detach: mutating the graph *during* a traverse
    // would make three skip siblings.
    const unwanted: Object3D[] = [];
    clone.traverse((object: Object3D) => {
      if (DIORAMA.hiddenNodes.includes(object.name)) unwanted.push(object);
    });

    // Detached rather than set to `visible = false`, because three's
    // Box3.setFromObject measures invisible objects too — leaving the 9 x 9
    // backdrop plane in the graph would make <Bounds> frame empty space.
    unwanted.forEach((object) => object.removeFromParent());

    return clone;
  }, [scene]);

  return (
    // The wrapper group applies the recentring offset, so the raw model stays
    // untouched and every transform lives in one readable place.
    <group position={DIORAMA.offset} scale={DIORAMA.scale}>
      <primitive object={room} />
    </group>
  );
}

// Warm the cache as soon as this module is evaluated, so the download starts
// while React is still hydrating instead of after the first paint.
useGLTF.preload(DIORAMA.url);
