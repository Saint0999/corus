"use client";

import { useEffect, useRef } from "react";

/**
 * Full-bleed hero product video.
 *
 * The clip is a product rendered on pure black — the same black as the page —
 * so it needs no matte and no compositing: dropped straight into the hero, its
 * background IS the hero's background, and the board reads as an object on the
 * page rather than a video in a box.
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
      // were left and the headline would land on white plastic. The bars the
      // letterboxing leaves cost nothing — they are the same black as the
      // page, so they are invisible. The overflow the scale-up creates is
      // clipped by the hero's `overflow-hidden`.
      //
      // Landscape overrides that to crop-and-fill.
      className={
        "absolute inset-0 z-0 h-full w-full scale-[1.6] object-contain object-[50%_32%] " +
        "[@media(min-aspect-ratio:1/1)]:scale-100 " +
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
