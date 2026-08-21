"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Full-bleed hero product video.
 *
 * The clip is a product rendered on flat black — near enough the page's own
 * black to need no compositing: dropped straight into the hero, its background
 * reads as the hero's background, and the board reads as an object on the page
 * rather than a video in a box. `MATTE` below is what "near enough" costs.
 *
 * (An earlier revision keyed this on the GPU so a line field could run behind
 * the board. That machinery only earns its keep when something is painted
 * underneath; over flat black it is pixel-for-pixel identical to the plain
 * element below, at a fraction of the code and none of the per-frame work.)
 *
 * The clip is a 3-second intro, NOT a loop: it opens on black and settles on
 * the finished board. That shape drives every decision here.
 *
 *  - No `loop`. Looping would hard-cut from the lit product back to black
 *    every three seconds. It plays once and holds on its last frame, which is
 *    the hero image the rest of the page is designed around.
 *  - No `poster`. The first frame is already black, same as the page, so the
 *    pre-playback state is invisible rather than a flash of a different image.
 *  - Two sources: HEVC first (~456 KB), H.264 second (~852 KB). Browsers pick
 *    the first type they can decode, so Safari and Chrome take the small one
 *    and everything else falls through to the universally supported one.
 *
 * It is a Client Component only for the effect below — the `<video>` element
 * itself is in the server-rendered HTML, so playback starts without waiting
 * for hydration.
 */
/**
 * The clip's matte — the flat black its board is rendered on.
 *
 * NOT `#000000`, which is what this file assumed until now and what the page
 * behind it actually is. The encode's black sits two or three levels above
 * true black, uniformly across the frame.
 *
 * Two levels is nothing to look at and everything to see. Where the video's
 * painted rectangle ends and the page shows through, those levels become a
 * hard horizontal edge running the full width of the screen — which is the one
 * thing the eye is unfailingly good at picking out, and which a phone's OLED
 * renders as a band sitting under the header.
 *
 * It is only the PORTRAIT framing that has an edge to give it away. Landscape
 * is `object-cover`: the video fills its box corner to corner, so there is no
 * bar to mismatch, and the hero's own edges are already accounted for — the
 * top sits behind the header's border, the bottom under the scrim's opaque
 * end. Portrait letterboxes, and a letterbox bar is the page.
 *
 * So the bars are painted with this instead of being left to the page. The
 * value is measured off the H.264 encode's settled frame; it is what the
 * server renders and what holds until the effect below has a frame to sample,
 * and the effect is what makes it exact — on this encode and on the HEVC one
 * that Safari takes instead, which is not the same file and need not have the
 * same black.
 */
const MATTE = "#020204";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Match the letterbox bars to the clip's own black, exactly.
   *
   * One pixel, read back off a decoded frame. `MATTE` above is already a close
   * match, so this is not what makes the seam go away — it is what keeps it
   * gone when the asset is re-encoded, and what covers the codec this browser
   * did not pick.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sample = () => {
      // No frame decoded means `drawImage` paints nothing and the readback
      // below would report transparent black — which is the page's black, the
      // very value this exists to stop using.
      if (video.readyState < 2) return;

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      try {
        // ONE source pixel, from the top left corner — matte in every frame of
        // the clip, because the board is centred and never reaches the corner.
        // Drawing a 1x1 region into a 1x1 canvas is what keeps this from being
        // a 1920x1080 surface copy for the sake of three numbers.
        context.drawImage(video, 0, 0, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        video.style.setProperty("--matte", `rgb(${r} ${g} ${b})`);
      } catch {
        // Reading back a canvas a cross-origin video has tainted throws. These
        // are same-origin, so it should not happen here — and if it ever does,
        // `MATTE` is still a good match and nothing is worse than it was.
      }
    };

    // Both of these mean "the clip has arrived at the frame it will hold on":
    // `ended` when it played through, `seeked` when it was sent straight to
    // the last frame instead. Sampling THAT frame rather than the first one
    // matters because the encode's black drifts a level across the clip, and
    // the settled frame is the one the page spends all of its time on.
    video.addEventListener("ended", sample);
    video.addEventListener("seeked", sample);

    return () => {
      video.removeEventListener("ended", sample);
      video.removeEventListener("seeked", sample);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    /** Jump to the settled product shot: the clip's final rendered frame. */
    const showFinalFrame = () => {
      const seek = () => {
        // Not `duration` exactly — seeking to the very end lands past the last
        // frame in some browsers and decodes nothing.
        video.currentTime = Math.max(0, video.duration - 0.05);
      };

      video.pause();
      if (Number.isFinite(video.duration)) seek();
      else video.addEventListener("loadedmetadata", seek, { once: true });
    };

    // Someone who asked for reduced motion gets the destination, not the
    // journey — the same still frame the animation ends on.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showFinalFrame();
      return;
    }

    // `autoPlay` + `muted` + `playsInline` satisfies every mainstream autoplay
    // policy, but data-saver and battery-saver modes can still refuse. React's
    // `autoPlay` has already fired by now; this catches the refusal and falls
    // back to the still, so the hero is never a black rectangle.
    void video.play().catch(showFinalFrame);
  }, []);

  return (
    <video
      ref={videoRef}
      // Decorative: the headline next to it carries the meaning, so announcing
      // it would only add noise for screen readers.
      aria-hidden="true"
      tabIndex={-1}
      autoPlay
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      // Framing is split on the viewport's ASPECT RATIO, not on a width
      // breakpoint, because it is the shape of the hero that decides what a
      // 16:9 render can do inside it — a short laptop window and a tall phone
      // need opposite treatments at the same width.
      //
      // Portrait and square-ish is the base case: the video is letterboxed so
      // the whole board survives, then scaled back up to win the size that
      // letterboxing costs. `cover` here would zoom until only a few keycaps
      // were left and the headline would land on white plastic. The overflow
      // the scale-up creates is clipped by the hero's `overflow-hidden`.
      //
      // The bars the letterboxing leaves are painted `--matte` — see MATTE. At
      // this scale the element covers the hero and then some, so that colour
      // is the hero's whole background and the bars stop being an edge.
      //
      // Landscape overrides that to crop-and-fill, and gives the background
      // back: `object-cover` leaves no bar to paint, and a colour that can
      // never be seen is a colour to be rid of rather than to reason about.
      style={{ "--matte": MATTE } as CSSProperties}
      className={
        "absolute inset-0 z-0 h-full w-full scale-[1.6] bg-[var(--matte)] object-contain object-[50%_32%] " +
        "[@media(min-aspect-ratio:1/1)]:scale-100 [@media(min-aspect-ratio:1/1)]:bg-transparent " +
        "[@media(min-aspect-ratio:1/1)]:object-cover [@media(min-aspect-ratio:1/1)]:object-center"
      }
    >
      <source
        src="/media/hero-keyboard.hevc.mp4"
        type='video/mp4; codecs="hvc1"'
      />
      <source src="/media/hero-keyboard.mp4" type="video/mp4" />
    </video>
  );
}
