"use client";

import { useEffect } from "react";
import ReactiveLines from "@/components/originkit/reactive-lines";

/**
 * Originkit's "Reactive Lines" as the hero backdrop.
 *
 * The component itself is vendored byte-for-byte in
 * `src/components/originkit/reactive-lines.tsx` so a re-add or upgrade from the
 * registry applies cleanly. Everything this site needs to change about it is
 * done from out here, through props and one mount effect.
 */
/**
 * The box the field is drawn into, as Tailwind classes.
 *
 * The component fills whatever element contains it (`position: absolute;
 * inset: 0`, set inline and not overridable through `style`), so the ONLY way
 * to resize, move or rotate the field is to resize, move or rotate this box —
 * which is why it is a prop rather than something a caller could reach with a
 * `style` override.
 *
 * The default is the hero's: see the note on the element below for where the
 * 170% comes from.
 */
const HERO_BOX = "pointer-events-none absolute inset-x-0 bottom-0 h-[170%]";

export function ReactiveLinesBackdrop({
  className = HERO_BOX,
  minLines,
  maxLines,
}: {
  className?: string;
  /**
   * The two ends of the line count. The field interpolates between them on
   * pointer Y — `minLines` is the count at the bottom of the box, `maxLines`
   * at the top, and the component reads them as a RANGE rather than as a
   * floor and a ceiling, so which one is larger does not matter.
   *
   * Left undefined here so the vendored defaults (108/15) stand: that density
   * is what the hero was tuned against.
   */
  minLines?: number;
  maxLines?: number;
} = {}) {
  useEffect(() => {
    /**
     * Kick the animation loop once on mount.
     *
     * Two details of the component make this necessary, and neither is a bug
     * so much as an assumption that does not hold for a full-bleed backdrop:
     *
     *  1. Its canvas is created with `{ alpha: false }`, so the drawing buffer
     *     starts as opaque BLACK rather than transparent. Nothing behind it
     *     shows through — the black page included.
     *  2. It starts deferred (`deferStart: true`) and only begins drawing on
     *     the first `mousemove`.
     *
     * Together that means the hero renders as a black rectangle until the
     * pointer moves — and on a touch device, where `mousemove` never fires at
     * all, permanently. Dispatching one synthetic move paints the first frame
     * immediately; after that the real pointer drives it as designed.
     *
     * rAF, not a bare call: child effects run before parent effects, so the
     * component's own listener is already attached by now, but waiting a frame
     * also guarantees layout has settled so it reads a correct bounding box.
     */
    const frame = requestAnimationFrame(() => {
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
        }),
      );
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    /**
     * Overscan box: taller than the hero, anchored to its bottom.
     *
     * The field is a fan of curves swept from an anchor above the top-right
     * corner, and the shape that falls out of it only fills the LOWER ~60% of
     * whatever box it is given — measured, not guessed: sampling the canvas on
     * a 12x8 grid returns exactly zero in every cell of the top three rows.
     * Given the hero's own box, that empty band is the upper third of the
     * hero, which is precisely where the keyboard sits, so the product ended
     * up ringed by dead black with the lines dipping away below it.
     *
     * At 170% anchored to the bottom, the lower 60% of the box — the part with
     * the lines in it — covers the hero from top to bottom. The overflow above
     * is clipped by the hero's own `overflow-hidden`.
     *
     * The component fills whatever element contains it (`position: absolute;
     * inset: 0`, set inline and not overridable through `style`), so resizing
     * it means resizing its container, which is what this is. It measures that
     * container on mount and on resize, so the canvas is sized correctly for
     * the taller box rather than stretched into it.
     */
    <div className={className}>
      <ReactiveLines
        // Sits at the very bottom of the hero's stacking order: lines -> glow ->
        // 3D canvas -> copy.
        style={{ zIndex: 0 }}
        // MUST track `--color-surface` in globals.css. The canvas is opaque and
        // repaints this colour every frame, so any drift shows up as a visible
        // black-on-black seam where the hero meets the rest of the page.
        backgroundColor="#000000"
        // White at 50% opacity. Full strength is safe again now that the hero
        // video is keyed to a real alpha channel: the board occludes the lines
        // outright, so their brightness no longer bleeds into the product.
        lineColor="rgba(255, 255, 255, 0.5)"
        lineWidth={1}
        minLines={minLines}
        maxLines={maxLines}
        // Fades the field out towards the edges. Pushed hard because white
        // lines at 0.8 are bright enough to swallow small grey copy, and the
        // headline and spec line sit in exactly the two bottom corners this
        // darkens.
        fade
        fadeIntensity={38}
      />
    </div>
  );
}
