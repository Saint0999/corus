/**
 * Compresses the keyboard model for delivery.
 *
 *   node scripts/optimize-model.mjs [in.glb] [out.glb]
 *
 * Reads the authoring file in `assets/models/` and writes the file the site
 * actually serves, `public/models/corus-keyboard.glb`. Run by `npm run build`
 * via `prebuild`, and committed, so a plain `next dev` has it too.
 *
 * WHY THIS EXISTS
 *
 * The source .glb is 1.55 MB for 34,848 triangles, which is roughly forty
 * times what that triangle count should cost. None of it is detail — it is
 * all precision nobody asked for:
 *
 *   VEC3 float32 (position + normal)   775 KB
 *   VEC2 float32 (texcoord)            258 KB
 *   SCALAR uint16 (index)              182 KB
 *   PNG (2 images)                     217 KB
 *
 * Positions are stored as 32-bit floats — about seven decimal digits, on a
 * keyboard 33 cm wide, i.e. resolving features far smaller than an atom.
 * Normals are unit vectors, so two thirds of every float32 triple is spent
 * re-encoding a length that is always 1. Texcoords are float32 across a
 * [0,1] range. Exporters emit this because it is lossless and they cannot
 * know what the model is for; it is not what you ship.
 *
 * THE PIPELINE, and why each step is here
 *
 *  - `dedup` + `weld` + `prune`: collapse identical accessors, merge vertices
 *    that are bitwise identical, and drop anything unreferenced. Lossless,
 *    and they shrink what the later steps have to encode.
 *  - `textureCompress` to WebP: the two PNGs are a 2048x2048 keycap legend
 *    atlas and the 300x640 screen. WebP is used LOSSLESSLY here — see the
 *    note on the call below.
 *  - `meshopt`: the main event. It quantizes attributes to integers
 *    (KHR_mesh_quantization) and then encodes the buffers with
 *    EXT_meshopt_compression.
 *
 * WHY MESHOPT AND NOT DRACO
 *
 * Draco compresses geometry harder. It also needs a ~200 KB WebAssembly
 * decoder that drei fetches from a gstatic CDN at runtime — a third-party
 * request on the critical path for the model, which is the exact class of
 * problem the preload in `KeyboardReveal.tsx` exists to remove. Meshopt's
 * decoder is ~25 KB, is ALREADY BUNDLED in `three-stdlib` (drei passes it to
 * GLTFLoader by default, see `useGLTF`'s `useMeshopt` argument), so it costs
 * no extra request at all, and it decodes at roughly GB/s. For a 35k-triangle
 * model the decode is imperceptible and the download is what matters.
 *
 * The quantization grid is meshopt's default and deliberately not tightened:
 * 14-bit position, 10-bit normal, 12-bit texcoord. 14 bits over the board's
 * bounding box is ~20 micrometres — far below anything the chamfers show. The
 * normals matter more than they look: `edgeFalloff.ts` shades off
 * `dot(geometryNormal, geometryViewDir)`, so coarse normals would band across
 * the case's flat faces. 10 bits is ~1000 steps per axis and stays smooth.
 *
 * ORDERING NOTE: run `patch-keyboard-layout.mjs` BEFORE this, and against the
 * SOURCE file. That script rewrites node transforms, and quantization bakes a
 * dequantization scale/offset into those same transforms — its absolute
 * position maths would be reading a different coordinate system. Source file
 * is the authoring artifact; this output is disposable and regenerated.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  weld,
  prune,
  textureCompress,
  meshopt,
} from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const IN = process.argv[2] ?? "assets/models/corus-keyboard.source.glb";
const OUT = process.argv[3] ?? "public/models/corus-keyboard.glb";

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const document = await io.read(IN);

await document.transform(
  dedup(),
  // Tolerance 0: merges only vertices that are already bitwise identical, so
  // this cannot round two distinct corners of a chamfer into one. Anything
  // looser is a mesh edit, and mesh edits belong in the source file.
  weld({ tolerance: 0 }),
  prune(),
  // LOSSLESS, and note that `lossless` is a TOP-LEVEL option here. Nesting it
  // under a `formatOptions: { webp: ... }` key looks plausible, type-checks as
  // an excess property on a JS call, and is silently ignored — leaving the
  // default LOSSY encoder on a 2048x2048 sheet of glyph legends. That is worth
  // a comment because the failure is invisible in the file size (it gets
  // smaller, which reads as success) and shows up only as soft type on the
  // keycaps.
  //
  // Lossless is not a concession here — it is smaller AND sharper. The atlas
  // is flat colour with hard glyph edges and the screen is UI with 1px
  // strokes: large uniform regions and high-frequency edges, which is the
  // content lossless WebP handles best and the DCT in a lossy codec handles
  // worst. Measured on these two images, lossless beats the lossy default
  // (27.7 kB vs 33.7 kB on the atlas) while staying pixel-exact.
  //
  // Both images carry a fully opaque alpha channel (verified: every alpha
  // sample is 255), so the encoder dropping RGBA to RGB costs nothing real
  // and saves a quarter of the raw data.
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    lossless: true,
    effort: 100,
  }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, await io.writeBinary(document));

const before = readFileSync(IN).length;
const after = readFileSync(OUT).length;
const kb = (n) => (n / 1024).toFixed(0).padStart(5) + " KB";
console.log(
  `model: ${kb(before)} -> ${kb(after)}  ` +
    `(${(after / before * 100).toFixed(1)}% of source, ` +
    `${(before / after).toFixed(1)}x smaller)`,
);
