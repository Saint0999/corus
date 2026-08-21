"use client";

import { useEffect, useRef } from "react";

/**
 * Full-bleed hero product video.
 *
 * The clip is a product rendered on flat black, corrected on the way to the
 * screen so that black is the page's exactly — see `MATTE_LIFT`. Once it is,
 * the clip needs no matte and no compositing: dropped straight into the hero,
 * its background IS the hero's background, and the board reads as an object on
 * the page rather than a video in a box.
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
 * How far above true black the clip's matte sits, in 0-255.
 *
 * The board is rendered on a flat black that is NOT `#000000`, which is what
 * this file assumed until now and what the page behind it actually is. Measured
 * off the settled frame, the encode's black is rgb(2 2 4) — uniform across the
 * whole frame, and two or three levels up from the page.
 *
 * Two levels is nothing to look at and everything to see. In the portrait
 * framing the video is letterboxed, so above the board there is a flat band of
 * fifty-odd pixels with nothing in it, and a flat band is exactly the shape the
 * eye can compare against its neighbours. Whatever that band is painted, it
 * clashes with something: left as the page it clashes with the video below it,
 * painted as the video it clashes with the header above it. There is no colour
 * that reconciles two different blacks — so the lift has to go instead.
 *
 * 6 rather than the 4 that was measured: this is the H.264 encode, and Safari
 * takes the HEVC one, which is a separate file and need not have been quantised
 * to the same black. The margin costs the deepest two levels of the shadow
 * under the board and buys the same result on an encode that cannot be measured
 * from here.
 *
 * The honest fix is upstream — re-encode the clip on true black and delete all
 * of this. Until then it is corrected on the way to the screen.
 */
const MATTE_LIFT = 6;

/**
 * That correction as a linear transfer: `[LIFT, 255]` stretched onto `[0, 255]`.
 *
 * Linear rather than a `contrast()` filter, which is the shorter thing to write
 * and the wrong shape: contrast pivots around mid grey, so buying four levels
 * at the bottom brightens the top by as much and clips everything past ~251 to
 * white. The keycap highlights and the screen's white gradient live up there.
 * This form pins 255 to itself — white is white, whatever the slope — and
 * spends the whole adjustment in the shadows, where the problem is.
 */
const MATTE_SLOPE = 255 / (255 - MATTE_LIFT);
const MATTE_INTERCEPT = -MATTE_LIFT / (255 - MATTE_LIFT);

/**
 * The filter's id, which is written out literally in BOTH places below rather
 * than shared through a constant. Tailwind finds utilities by scanning this
 * file as text, so a class name built from a variable is a class name it never
 * generates. The two have to be kept in step by eye; there are two of them.
 */

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

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
    <>
      {/* The levels correction itself — see MATTE_LIFT. An SVG filter because
          CSS has no levels primitive: `feComponentTransfer` is the only way to
          say "map this range onto that one" without pivoting the midtones the
          way `contrast()` would.

          `colorInterpolationFilters="sRGB"` is load-bearing. The default is
          linearRGB, which converts out of sRGB before the transfer and back
          afterwards — the slope and intercept here are in the space the pixel
          values were measured in, and under the default they would be applied
          to different numbers entirely.

          It renders nothing: a <filter> is a definition, never drawn, and the
          <svg> is sized to nothing so it takes no space in the hero. */}
      <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
        <defs>
          <filter id="hero-matte" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR
                type="linear"
                slope={MATTE_SLOPE}
                intercept={MATTE_INTERCEPT}
              />
              <feFuncG
                type="linear"
                slope={MATTE_SLOPE}
                intercept={MATTE_INTERCEPT}
              />
              <feFuncB
                type="linear"
                slope={MATTE_SLOPE}
                intercept={MATTE_INTERCEPT}
              />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

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
        // `object-top` and `origin-top` are what put the board UNDER THE HEADER
        // rather than adrift below it. Letterboxing a 16:9 clip into a hero a
        // whole screen tall leaves most of the box empty, and where that empty
        // space ended up was decided twice: once by `object-position`, which
        // placed the frame 32% down the box, and again by the scale, which
        // grows about its origin and so pushes whatever is not AT that origin
        // further away from it. A centre origin and 32% put fifty pixels of
        // nothing between the header and the top of the board — a gap with no
        // content in it, on the one screen with the least room to give away.
        //
        // Pinning both to the top collapses that to zero and keeps it there at
        // every viewport: the frame starts at the top of the box, and scaling
        // FROM the top leaves that edge where it is rather than carrying it
        // down. The board meets the header the way it already does in
        // landscape, where `object-cover` has always filled the box to its top
        // edge. The empty space all goes to the bottom now, which is where the
        // headline and the CTA are sitting anyway.
        //
        // The bars the letterboxing leaves are the page, and the page is true
        // black — so the clip is put on true black too, on its way to the screen.
        // See MATTE_LIFT. With the lift gone every black in the hero is the
        // page's: the bars, the video, the header over it and the section under
        // it, all the same, and there is no edge left anywhere to catch.
        //
        // Landscape overrides that to crop-and-fill, and takes the filter back
        // off. `object-cover` leaves no bar, so nothing there is comparing the
        // clip's black to the page's — and a correction that buys nothing is a
        // per-frame cost and a change to the picture for no reason.
        className={
          "absolute inset-0 z-0 h-full w-full origin-top scale-[1.6] object-contain object-top " +
          "[filter:url(#hero-matte)] " +
          "[@media(min-aspect-ratio:1/1)]:scale-100 [@media(min-aspect-ratio:1/1)]:[filter:none] " +
          "[@media(min-aspect-ratio:1/1)]:object-cover [@media(min-aspect-ratio:1/1)]:object-center"
        }
      >
        <source
          src="/media/hero-keyboard.hevc.mp4"
          type='video/mp4; codecs="hvc1"'
        />
        <source src="/media/hero-keyboard.mp4" type="video/mp4" />
      </video>
    </>
  );
}
