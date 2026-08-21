"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import { KeySwitchStage } from "@/components/anatomy/KeySwitchStage";
import {
  clamp01,
  ENTER_DELAY_MS,
  ENTER_MS,
  EXIT_MS,
  StageVisit,
} from "@/components/anatomy/PartStage";
import { scrollToY } from "@/components/scroll/SmoothScroll";
import { StaggeredText, type Segment } from "@/components/text/StaggeredText";
import { Container } from "@/components/ui/Container";
import { eyebrow } from "@/lib/styles";

/**
 * The anatomy section: the board taken apart, one part at a time.
 *
 * Replaces the old two-column spec table at the foot of the page. That table
 * asked the reader to scan twenty rows of label/value and work out for
 * themselves what any of it looked like; this asks them to pick a part and
 * look at it.
 *
 * Layout is a fixed pair: the list of parts on the left, the visual on the
 * right. Everything about the panel that is settled — its box, its aspect, how
 * it swaps when the selection changes — lives here, so adding a part's visual
 * is a matter of filling `PARTS[n].visual` rather than touching the layout.
 *
 * From `lg` up the section is PINNED: it is `STEP_VH` of page per part taller
 * than the screen, and the frame inside it sticks to the top for that whole
 * distance, so the reader scrolls THROUGH the parts without the section moving
 * — one part at a time, in order, hands-free. Below `lg` there is no room to
 * hold a square and a column of type still at once, so the section is an
 * ordinary block and the list is what it looks like: a set of buttons.
 *
 * The scroll position is the state in pinned mode, which is what keeps the two
 * ways in from disagreeing: clicking a row does not set the selection, it
 * scrolls to where that selection lives and lets the listener below arrive at
 * it on its own.
 *
 * A Client Component because the selection is state. It is the whole point of
 * the section: nothing about it works as static markup.
 */

/**
 * How much page each part is given while the section is pinned, in vh.
 *
 * The whole track is this much per part plus one screen — the screen being the
 * frame itself, which has to be scrolled past before the section can let go.
 * Big enough that a part is not flicked through on one notch of a wheel; small
 * enough that five of them are not a chore to get past. It is handed to CSS
 * alongside the array's length, so the track's height follows the parts
 * instead of being a number to remember when one is added.
 */
const STEP_VH = 60;

type Part = {
  /** The name in the list, and the caption on the panel. */
  name: string;
  /** One line under the name, only shown on the selected row. */
  detail: string;
  /**
   * The part's visual, if it has one yet. Rows without one fall back to the
   * placeholder panel — they are still being built.
   *
   * `visual` is for the ones that are LIVE — a canvas, a running screen —
   * rather than a still. It takes precedence over `image`; a part has one or
   * the other, never both.
   */
  image?: {
    src: string;
    alt: string;
    /**
     * How the still sits in the panel. `contain` — the default — is for
     * cutouts of a whole part, which have to be seen end to end and are
     * padded off the panel's edges. `cover` is for a crop of a bigger render:
     * it is already the panel's shape, so it fills the box and its cut edges
     * land on the box's edges rather than floating inside it.
     */
    fit?: "contain" | "cover";
  };
  visual?: ReactNode;
  /**
   * Which way this part crosses the panel.
   *
   * `vertical` — the default — is the reader's own direction: the part rises
   * from below the frame as they come down the list, and leaves through the
   * top. It suits anything that fills the panel, because what enters first is
   * an edge of the image rather than the image itself.
   *
   * `horizontal` is for the ones it does not suit. A cutout on transparency
   * rising into frame reads as a cutout being PUSHED UP — the eye reads the
   * bottom edge of the artwork as a bottom edge of an object, and the object
   * appears to be sitting on something. Coming in from the side, the same
   * artwork just arrives.
   *
   * A horizontal part uses ONE edge, not two: it comes in from the left and
   * goes back out to the left. That is the difference between a cutout being
   * brought out to be looked at and put away again, and a cutout being carried
   * past on a belt.
   */
  axis?: "vertical" | "horizontal";
};

/**
 * The five parts, in the order the reader meets them: the whole board first,
 * then down through what it is made of, ending on the screen — which is the
 * thing that makes this board different from every other board.
 *
 * The details are the surviving content of the old spec table. One line each,
 * on purpose: a part that needs a paragraph needs a better visual instead.
 */
// An element, not a component reference: this is a description of what to
// render, and it is declared once, up here, because two parts share it and
// sharing it is what tells the panel they are one stage.
const KEY_SWITCH = <KeySwitchStage />;

const PARTS: readonly Part[] = [
  {
    name: "The Keyboard",
    detail: "CNC aluminium, anodized silver over gun metal",
    image: {
      src: "/media/anatomy/keyboard.webp",
      alt: "The Corus keyboard seen from directly above: silver aluminium case, light grey keycaps with an orange escape key and orange arrow cluster, two knobs and a colour screen at the right.",
    },
  },
  // These two are ONE visual, and share it by pointing at the same element —
  // see SLOTS below for how that is read. The switch is inside the key: the
  // second row is the first row looked at more closely, and building a second
  // copy of the model to say so was what made the change between them read as
  // a cut. The stage holds still and the camera moves instead.
  {
    name: "Keycaps",
    detail: "Dye sub PBT, uniform profile",
    visual: KEY_SWITCH,
  },
  {
    name: "Switch",
    detail: "Tactile / 55g / two-stage spring / factory lubed",
    visual: KEY_SWITCH,
  },
  {
    name: "Knobs",
    detail: "ABS plastic, two of them, both programmable",
    // Crosses sideways. Rising into frame, this crop's straight bottom cut sat
    // level with the panel's own bottom edge on the way in, and the whole
    // thing read as a sticker being slid up into place rather than as the
    // corner of a keyboard.
    axis: "horizontal",
    // The corner of the three-quarter render the knobs live on, cut free of
    // its backdrop and cropped to the panel's 4:3 — close enough that the
    // knurling reads, and framed to keep the screen and a modifier beside
    // them for scale.
    image: {
      src: "/media/anatomy/knobs.webp",
      alt: "The bottom right corner of the Corus keyboard, close up: two knurled black knobs set into the silver aluminium case beside the colour screen, with the orange modifier keys at the left.",
      fit: "cover",
    },
  },
  {
    name: "Screen",
    detail: "100×310 px full-colour LCD",
    // Sideways, like the knobs before it. These two are crops of the same
    // board taken from the same angle, and the pair reads as one object being
    // turned over when they arrive the same way.
    axis: "horizontal",
    // From the same top-down cutout the board at 01 is taken from, so this is
    // 01 walked in on: no new lighting, no second version of the part. Framed
    // past the case's right edge, because half of what there is to see about
    // this screen is that it is set INTO the edge of the board.
    image: {
      src: "/media/anatomy/screen.webp",
      alt: "The Corus keyboard's colour screen, close up from directly above: a tall rounded strip set into the right edge of the aluminium case, showing 9:00 and Thursday April 4 over an orange-to-white gradient, with the right-hand keys and an orange modifier beside it.",
      fit: "cover",
    },
  },
] as const;

/**
 * How full the rail is, from the track's progress.
 *
 * Not the same number, and the difference is the point. Progress runs 0 to 1
 * across the whole track, but the rail runs between the FIRST and LAST
 * bullets — so at progress 1 the fill would be a whole band past the last
 * bullet, and every bullet before it would have gone green while the line was
 * still short of it. A part is chosen at the start of its band; scaling by
 * `n / (n - 1)` is what puts the line's head on that part's bullet at exactly
 * that moment, so nothing lights up before the line reaches it.
 *
 * Held at 1 through the last band, where the line has arrived and there is
 * nowhere further to go.
 */
const railFill = (progress: number) =>
  clamp01((progress * PARTS.length) / Math.max(1, PARTS.length - 1)).toFixed(4);

/**
 * The panel's slots — one per visual, which is not the same as one per part.
 *
 * Consecutive parts that point at the SAME element are one stage and get one
 * slot between them, because that is what "the switch is inside the key"
 * means: there is nothing to swap, only somewhere else to look. Everything
 * else gets a slot to itself.
 *
 * Derived from PARTS rather than declared beside it, so the list stays the one
 * ordered source of truth and a slot cannot come to disagree with the rows it
 * covers.
 */
type Slot = { readonly from: number; readonly to: number; readonly part: Part };

const SLOTS: readonly Slot[] = PARTS.reduce<Slot[]>((slots, part, index) => {
  const last = slots.at(-1);

  if (last && part.visual && last.part.visual === part.visual) {
    slots[slots.length - 1] = { ...last, to: index };
    return slots;
  }

  slots.push({ from: index, to: index, part });
  return slots;
}, []);

/** Which slot a part belongs to. */
const slotOf = (index: number) =>
  SLOTS.findIndex((slot) => index >= slot.from && index <= slot.to);

/**
 * Where a slot stands relative to the one on show, and how it gets there.
 *
 * The reader is travelling DOWN a list, so a part that has been passed parks a
 * full panel height ABOVE the frame and a part still to come waits a full
 * panel height BELOW it. Which side a slot is parked on is therefore not a
 * matter of what it is doing — it is only where it sits in the list relative
 * to where the reader is.
 *
 * A part can cross sideways instead — see `axis` — and that one does not
 * follow the rule at all: it parks off the LEFT edge whichever side of the
 * reader it is on, so it leaves through the same edge it arrived by. Carrying
 * it out the far side would make the panel a conveyor; bringing it back the
 * way it came makes it a thing that was fetched and then put away.
 *
 * A FULL height, rather than the nudge this started as, because the panel
 * clips: parked at 100% a slot is not merely faint, it is outside the box
 * altogether, and two parts can never be caught sharing the frame.
 *
 * The timing is what keeps them from sharing it in TIME either. The arrival
 * waits out almost the whole exit before it starts, so the changeover reads as
 * one part leaving and then another coming, not as a crossfade.
 *
 * Both directions ease IN AND OUT: each move gathers itself, travels, and
 * settles, which is what makes a full panel height read as a considered move
 * rather than a slide.
 *
 * The one easing that cannot be used here is a plain ease-in. The handoff is
 * timed, not watched — the arrival starts at a fixed moment, not when the exit
 * reports itself done — and an ease-in has covered barely a quarter of its
 * travel by then, so the leaving part would still be most of the way in frame
 * when the next one entered. `ease-in-out` is 98% of the way out at the same
 * moment, which is what keeps the two of them from meeting.
 *
 * All poses are on one element, so the browser interpolates between them and
 * there is no enter/exit bookkeeping to get wrong: a slot cannot be mid-exit
 * and mid-entrance at once, because it only ever has one pose.
 */
const pose = (slot: Slot, active: number) => {
  if (active >= slot.from && active <= slot.to) {
    return {
      className: "translate-x-0 translate-y-0 opacity-100 blur-0 ease-in-out",
      style: {
        transitionDuration: `${ENTER_MS}ms`,
        transitionDelay: `${ENTER_DELAY_MS}ms`,
      },
    };
  }

  const parked =
    slot.part.axis === "horizontal"
      ? "-translate-x-full"
      : slot.to < active
        ? "-translate-y-full"
        : "translate-y-full";

  return {
    className: `pointer-events-none opacity-0 blur-[10px] ease-in-out ${parked}`,
    style: { transitionDuration: `${EXIT_MS}ms`, transitionDelay: "0ms" },
  };
};

/** Which part is showing, and how many times each has been arrived at. */
type Selection = {
  readonly index: number;
  /** One count per SLOT, not per part — see `choose`. */
  readonly visits: readonly number[];
};

/** The label above the heading. */
const EYEBROW: readonly Segment[] = [{ text: "Anatomy" }] as const;

/** The section heading. Data rather than markup because <StaggeredText> has
 *  to break it into per-character spans to sweep it. */
const HEADING: readonly Segment[] = [
  { text: "Every part, on its own terms" },
] as const;

export function Anatomy() {
  /**
   * Which part is showing, and how many times each has been arrived at.
   *
   * One piece of state rather than two because they change together, always:
   * an arrival IS a change of selection, and a visit count that could be
   * updated separately from the selection it belongs to is a visit count that
   * will eventually disagree with it.
   *
   * The counts exist because mounting no longer marks an arrival — the stages
   * are built ahead of time and kept, so something has to say "you are here
   * again" out loud. See <StageVisit>.
   */
  const [selection, setSelection] = useState<Selection>(() => ({
    index: 0,
    visits: SLOTS.map((_, index) => (index === 0 ? 1 : 0)),
  }));

  const { index: active, visits } = selection;

  /**
   * Choose a part. A no-op if it is the one already showing, so that a scroll
   * inside one band does not count as arriving over and over.
   *
   * The visit count belongs to the SLOT rather than the part, and only goes up
   * when the reader crosses into it from outside. That is what stops the key
   * from re-exploding on the way from Keycaps to Switch: those two are one
   * slot, so moving between them is not an arrival at anything — it is a
   * change of where that slot is being asked to look.
   */
  const choose = useCallback((index: number) => {
    setSelection((current) => {
      if (current.index === index) return current;

      const from = slotOf(current.index);
      const to = slotOf(index);

      return {
        index,
        visits:
          from === to
            ? current.visits
            : current.visits.map((count, at) =>
                at === to ? count + 1 : count,
              ),
      };
    });
  }, []);

  /** The track — the tall box the frame is pinned inside of. */
  const trackRef = useRef<HTMLElement | null>(null);

  /** The rail behind the bullets, and the bullets it has to reach between. */
  const railRef = useRef<HTMLSpanElement | null>(null);
  const bulletsRef = useRef<(HTMLSpanElement | null)[]>([]);

  /**
   * Whether the section is currently the pinned one.
   *
   * The breakpoint is duplicated from the class list, which is a thing to keep
   * in step, but the alternative is measuring layout to find out which layout
   * we are in. It is only ever read to decide whether the SCROLL drives the
   * selection; the pin itself is pure CSS and correct before this resolves, so
   * a frame of it being wrong costs nothing.
   */
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)");
    const sync = () => setPinned(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  /**
   * Whether the 3D stages have been built yet.
   *
   * They are built ON LOAD and then kept — not when the reader reaches the
   * part that needs one, and no longer when the section comes near either.
   * Building one costs a WebGL context, five shader programs and fifty buffer
   * uploads, and every one of those is work that can be done at any time; the
   * only bad time to do it is the frame the reader arrives on, which is the
   * frame with the least to spare and the only one where the cost is visible.
   *
   * On the idle callback rather than straight away, because the one thing this
   * must not do is compete with the hero: that is the first paint, it has a 3D
   * canvas of its own, and this section is four screens below it. The timeout
   * is the guarantee that "idle" arrives on a page that never quite goes
   * quiet.
   *
   * One-way: once built they stay. Paying twice is the thing being avoided.
   */
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      const timer = window.setTimeout(() => setArmed(true), 300);
      return () => window.clearTimeout(timer);
    }

    const handle = window.requestIdleCallback(() => setArmed(true), {
      timeout: 1500,
    });

    return () => window.cancelIdleCallback(handle);
  }, []);

  /**
   * The selection, read off the scroll position.
   *
   * The track is divided into one equal band per part, and the reader is in
   * whichever band the frame's travel has reached. Deriving it rather than
   * stepping it is what makes scrolling BACK work, and what makes a fling
   * through the section land on the right part rather than on the last one it
   * managed to render.
   *
   * Coalesced onto a frame: `scroll` fires far more often than the screen
   * refreshes, and every one of these ends in a `setState`.
   */
  useEffect(() => {
    if (!pinned) return;

    const track = trackRef.current;
    if (!track) return;

    let frame = 0;

    const read = () => {
      frame = 0;

      const { top, height } = track.getBoundingClientRect();
      const travel = height - window.innerHeight;
      if (travel <= 0) return;

      const progress = clamp01(-top / travel);

      // Straight to the DOM rather than through state: this is a number that
      // changes every frame the reader scrolls, and the list it is drawn in
      // is not a thing to re-render sixty times a second. The fill reads it
      // as a `scale-y`, so the browser can keep the whole move off the main
      // thread.
      railRef.current?.style.setProperty("--fill", railFill(progress));

      const index = Math.min(
        PARTS.length - 1,
        Math.floor(progress * PARTS.length),
      );

      choose(index);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pinned, choose]);

  /**
   * Unpinned, there is no scroll to read the rail off, so it follows the
   * selection: filled to exactly the selected bullet, which is where the
   * pinned rail stands the moment that part comes up. The two modes draw the
   * same picture for the same selection.
   */
  useEffect(() => {
    if (pinned) return;

    railRef.current?.style.setProperty(
      "--fill",
      railFill(active / PARTS.length),
    );
  }, [pinned, active]);

  /**
   * The rail's ends, measured off the first and last bullets.
   *
   * Every row is the same height, so where these land is decided entirely by
   * the row padding and the line height of the name — but both are settled in
   * the class lists below, and restating either as a number here is how the
   * rail ends up half a line out the day one of them changes. So it asks the
   * bullets where they ended up instead. The classes carry the same
   * measurement as a static value, which is what the server renders and what
   * holds until this runs; it is right, and this is what keeps it right.
   */
  useEffect(() => {
    const rail = railRef.current;
    const first = bulletsRef.current[0];
    const last = bulletsRef.current[PARTS.length - 1];
    if (!rail || !first || !last) return;

    const measure = () => {
      const origin = rail.parentElement?.getBoundingClientRect().top ?? 0;
      const centre = (node: HTMLSpanElement) => {
        const box = node.getBoundingClientRect();
        return box.top + box.height / 2 - origin;
      };

      const top = centre(first);
      rail.style.top = `${top}px`;
      rail.style.height = `${centre(last) - top}px`;
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // Not keyed on the selection: the rows do not change height when one of
    // them is chosen, which is the whole point of how they are laid out.
  }, []);

  /**
   * A row was clicked.
   *
   * Pinned, this cannot just set the selection: the scroll position would
   * still say otherwise and the next frame of scrolling would undo it. So it
   * scrolls to the middle of that part's band instead and lets the listener
   * above arrive at the selection by itself — the click and the wheel end up
   * being the same gesture, spelled differently.
   */
  const select = useCallback(
    (index: number) => {
      const track = trackRef.current;

      if (!pinned || !track) {
        choose(index);
        return;
      }

      const { top, height } = track.getBoundingClientRect();
      const travel = height - window.innerHeight;
      const band = (index + 0.5) / PARTS.length;

      scrollToY(window.scrollY + top + travel * band);
    },
    [pinned, choose],
  );

  return (
    <section
      ref={trackRef}
      // `--steps` is the array's length handed to CSS, so the track's height
      // is derived from the parts rather than from a number that has to be
      // remembered when one is added.
      style={{ "--steps": PARTS.length, "--step": STEP_VH } as CSSProperties}
      className="pt-10 pb-28 sm:pt-14 sm:pb-36 lg:h-[calc((var(--steps)*var(--step)+100)*1vh)] lg:py-0"
    >
      {/* The frame. `h-screen` and centred rather than `top-0` alone: a sticky
          box shorter than the screen would pin with the page still visibly
          moving behind it, which reads as a bug rather than as a hold. */}
      <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-center">
        <Container>
          {/* Both sweeps run in the FIRST FIFTH of their range, which is not
              where these numbers would sit on an ordinary block.

              A `view()` timeline measures its subject's pass across the
              screen, and a subject inside a sticky box does not stop passing
              when the box pins — it goes on being measured for as long as the
              box has travel left. Pinned, this heading's pass is therefore the
              whole track, four screens of it, and the ranges these two had
              before spread a two-second sweep across all of it: the reader
              arrives at a heading that is still half blurred and stays that
              way through two of the parts.

              So the whole sweep is spent on the APPROACH — the ~20% of the
              track that runs from the heading clearing the bottom edge to the
              frame pinning — and both lines are resolved by the time the
              section takes hold. Below `lg` nothing is pinned and the range is
              an ordinary one, where this reads as a heading that resolves as
              it rises rather than once it has arrived.

              The eyebrow still leads: earlier, faster, and finished about when
              the heading's first characters are resolving. Same range for both
              would have a wide-tracked mono label crawling alongside a 44px
              serif. */}
          <StaggeredText
            segments={EYEBROW}
            className={eyebrow}
            reveal="scroll"
            scrollFrom={0.5}
            scrollStep={0.5}
            scrollSpan={4}
          />
          {/* The hero's per-character blur-resolve, on the scroll timeline
              rather than a timer — this heading is far below the fold, and a
              mount animation down here is over long before anybody arrives.
              `font-normal` walks back the 600 that globals.css puts on every h2:
              at display size the serif's hairlines are the point, and the
              heavier weight thickens them out of existence. The tracking and
              leading are the h1's for the same reason — this is display type,
              not a section label. */}
          <StaggeredText
            as="h2"
            segments={HEADING}
            className="mt-3 max-w-xl text-[2rem] font-normal leading-[1.04] tracking-[-0.03em] text-ink sm:text-[2.75rem]"
            reveal="scroll"
            scrollFrom={1}
            scrollStep={0.4}
            scrollSpan={6}
          />

          {/* The pair. `items-center` rather than `stretch`: the list keeps its
              natural height instead of spreading five rows over the height of a
              square, and sits on the panel's middle line rather than hanging
              from its top edge. Below `lg` the grid is one column and the
              alignment has nothing to do — the list is simply above the panel. */}
          <div className="mt-12 grid items-center gap-10 sm:mt-16 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
            {/* --- Left: the parts list ---------------------------------------
                Real <button>s in a list, not divs with click handlers: this is a
                set of choices, and buttons come with the keyboard and the focus
                ring already attached. */}
            {/* No rules anywhere. The list is five words long, and ruling it —
                between the rows or around them — turns five choices into a
                table of five rows. What separates them is the space; what marks
                the one you are on is its bullet and its weight of ink. */}
            <ul className="relative">
              {/* The rail. It runs from the first bullet to the last and fills
                  green behind them as the reader goes down the track, so the
                  list reads as a route with a position on it rather than as
                  five separate lights going on and off.

                  `top`/`bottom` here are that measurement written down — one
                  row's top padding plus half a name line, at both ends — which
                  is what the server renders and what holds until the effect
                  above runs. It is exact now that every row is the same height;
                  the effect keeps it exact if the padding or the type ever
                  moves. Setting `top` and `height` makes a box with all three
                  of top, height and bottom ignore the bottom, so the measured
                  pair simply wins.

                  `left-[3px]` is the bullet's own centre: the row is a flex
                  line that starts with a 6px dot, so the dot's middle is three
                  pixels in from the list's edge. */}
              <span
                ref={railRef}
                aria-hidden="true"
                style={{ "--fill": 0 } as CSSProperties}
                className="absolute top-[2.125rem] bottom-[2.125rem] left-[3px] w-px -translate-x-1/2 bg-line"
              >
                <span
                  className={`block h-full w-full origin-top scale-y-[var(--fill)] bg-accent ${
                    // Pinned, the fill is redrawn every frame off the scroll
                    // and easing it would only put it behind the wheel.
                    // Unpinned it moves in one jump between two selections,
                    // which is the one case that wants an ease.
                    pinned ? "" : "transition-transform duration-300 ease-out"
                  }`}
                />
              </span>

              {PARTS.map((item, index) => {
                const isActive = index === active;
                // The rail's head lands on a bullet exactly as its part is
                // chosen, so "the line has been here" is simply every part up
                // to and including the current one. Scrolling back up unlights
                // them again, which is right: the line retreats too.
                const isReached = index <= active;

                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      onClick={() => select(index)}
                      aria-current={isActive ? "true" : undefined}
                      className={`group flex w-full items-center gap-3 py-5 text-left transition-colors duration-200 ${
                        isActive ? "text-ink" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {/* The bullet. `aria-hidden` because it is punctuation, not
                          content: the row is already a list item, and the
                          selection is already announced by `aria-current`. It is
                          also where the accent lives now that the index is gone —
                          the one warm mark in a column of grey. */}
                      <span
                        ref={(node) => {
                          bulletsRef.current[index] = node;
                        }}
                        aria-hidden="true"
                        // `relative` only to lift it over the rail: both are
                        // in the same stacking context and the rail, being
                        // positioned, would otherwise paint its hairline
                        // straight through the middle of every dot.
                        className="relative flex h-7 shrink-0 items-center"
                      >
                        <span
                          className={`size-1.5 rounded-full transition-colors duration-200 ${
                            isReached
                              ? "bg-accent"
                              : "bg-ink-muted/40 group-hover:bg-ink-muted"
                          }`}
                        />
                      </span>

                      {/* A row is ONE LINE tall, always — `h-7`, the same box
                          the bullet is centred in — and the name and its detail
                          are lifted out of the flow inside it, centred on that
                          line. So a row does not grow when it is chosen and no
                          bullet below it moves: the name rides up by half the
                          detail's height, the detail takes the space it left,
                          and both spill into the row's own padding rather than
                          into the row below.

                          Letting the row grow instead is what this list did
                          until now, and it shunts every bullet under the
                          selected one down by 26px as the reader scrolls past
                          it. A rail with sliding stations on it is not a
                          rail. */}
                      <span className="relative h-7 min-w-0 flex-1">
                        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                          <span className="block text-lg font-light tracking-[-0.01em] sm:text-xl">
                            {item.name}
                          </span>

                          {/* Only ever OPEN on the selected row — five of these
                              at once turns the list back into the spec table
                              this section replaced — but always rendered, and
                              closed by collapsing its row from `0fr` to `1fr`
                              rather than by being taken out of the tree.

                              That is what makes the switch a move rather than
                              a cut. The block above is centred by a percentage
                              translate, so the name rides up and down on
                              whatever height this has at the time: animate the
                              height and the name follows it, with no second
                              animation to keep in step and no hard-coded half
                              of a line height anywhere. */}
                          <span
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                              isActive
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <span className="overflow-hidden">
                              <span className="mt-1.5 block text-sm font-light text-ink-muted">
                                {item.detail}
                              </span>
                            </span>
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* --- Right: the visual ------------------------------------------
                The slot each part's visual will be built into. `aspect-[4/3]`
                rather than a fixed height so the box keeps its shape at every
                width, and `overflow-hidden` because what lands in here will be
                full-bleed inside it (a canvas, a render) and should be cropped
                by the panel's own corners.

                On a narrow viewport this sits BELOW the list; the grid only
                splits into columns at `lg`, where there is room for a square
                beside a column of type. */}
            {/* `max-w` in VH, which looks wrong and is not: it is the only way
                to cap a fixed-ratio box by the screen's HEIGHT. Pinned, the
                frame has one screen to fit a heading and a square into, and on a
                short window an unbounded 4:3 panel is taller than the window it
                is pinned inside. Capping the width caps the height with it and
                the ratio survives. */}
            <div className="relative mx-auto aspect-[4/3] w-full max-w-[80vh] overflow-hidden rounded-2xl border border-line bg-surface-raised">
              {/* Every part has a slot, and every slot is always there —
                  nothing is keyed on the selection, nothing mounts on arrival.

                  Two reasons, arrived at separately. The stages were unkeyed
                  first, because building one costs a WebGL context, five shader
                  programs and fifty buffer uploads, and none of that belongs in
                  the frame the reader lands on. The stills followed, because a
                  still that is not in the tree cannot be shown LEAVING, and
                  leaving is half of the move.

                  What the keying used to buy — the come-apart replaying each
                  time you come back to a part — is bought instead by
                  <StageVisit>, which says the part has been arrived at without
                  anything being torn down to say so. */}
              {SLOTS.map((slot, index) => {
                const item = slot.part;

                // A stage is only in the tree once the page has built them —
                // see `armed`. A still is always there, because a still that
                // is not in the tree cannot be shown leaving.
                if (item.visual && !armed) return null;

                const { className, style } = pose(slot, active);

                // How far through its own parts the reader is. Zero for the
                // slots that stand for one part; for the one that stands for
                // two it is which of them is being asked for, and the stage
                // eases between the two ends itself.
                const focus =
                  slot.to > slot.from
                    ? clamp01((active - slot.from) / (slot.to - slot.from))
                    : 0;

                return (
                  <div
                    key={item.name}
                    aria-hidden={!(active >= slot.from && active <= slot.to)}
                    style={style}
                    className={`absolute inset-0 transition-[opacity,translate,filter] ${className}`}
                  >
                    {item.visual ? (
                      <StageVisit visit={visits[index]} focus={focus}>
                        {item.visual}
                      </StageVisit>
                    ) : item.image ? (
                      /* The fit is the part's own — see `fit` on the type. A
                         cutout of a whole part is `contain`, because the board
                         is a 2.5:1 slab and cropping it to the panel would cut
                         the case off at both ends; a crop of a render is
                         `cover`, because it was cut to this box already. */
                      <Image
                        src={item.image.src}
                        alt={item.image.alt}
                        fill
                        sizes="(min-width: 1024px) 55vw, 90vw"
                        // Above the 75 default: the cutout is a smooth grey
                        // slab with a hairline chamfer running round it, and
                        // that edge is the first thing a low-quality re-encode
                        // softens.
                        quality={90}
                        className={
                          item.image.fit === "cover"
                            ? "object-cover"
                            : "object-contain p-4 sm:p-6"
                        }
                      />
                    ) : (
                      /* For a part whose visual is still being built: an empty
                         panel should read as "not yet" rather than as a broken
                         box. */
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
                        <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-muted/60">
                          {item.name}
                        </span>
                        <span className="text-sm font-light text-ink-muted/40">
                          Visual to come
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
