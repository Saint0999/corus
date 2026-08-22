/**
 * Where the board model lives in `public/`.
 *
 * This constant sits in a module of its own — one line, no imports — for the
 * same reason `edgeFalloff.ts` does: so a file can name the model WITHOUT
 * pulling three.js in behind it.
 *
 * `KeyboardStage.tsx` needs the URL to load the thing. `KeyboardReveal.tsx`
 * needs it to `preload()` the bytes from the server-rendered HTML, and that
 * file is deliberately three-free — importing the URL from `KeyboardStage`
 * would drag the whole three.js/fiber/drei stack back into the homepage's
 * initial bundle, which is the exact split those two files exist to maintain.
 *
 * Hence: one shared constant, no second copy to drift out of sync with the
 * file on disk.
 */
export const MODEL_URL = "/models/corus-keyboard.glb";
