import {
  StaggeredText,
  type Segment,
} from "@/components/text/StaggeredText";
import { Container } from "@/components/ui/Container";
import { panelSurface } from "@/lib/styles";

/**
 * Customer quotes: a heading, then three rows tracking sideways in alternating
 * directions.
 *
 * The heading takes the site's heading serif — globals.css sets it on every
 * h1-h3, so there is nothing to declare here — and the line under it is left
 * in the sans body face, which is the same pairing the rest of the page uses
 * for a claim under a title.
 *
 * A Server Component: the movement is a CSS animation on a transform (see
 * `.marquee-track` in globals.css), so nothing here needs the client. That is
 * the whole reason it is built this way — a marquee driven from JavaScript
 * runs a rAF for as long as the page is open, and this one costs the main
 * thread nothing once the styles are parsed.
 *
 * The loop is seamless by construction: each row renders its quotes TWICE and
 * the track slides exactly -50%, so the moment the first copy has left, the
 * second is sitting precisely where the first began. Two details make that
 * exact rather than nearly-exact:
 *
 *  - The spacing between cards is a MARGIN on each card, never a flex `gap`.
 *    With a gap, the track's width is two copies plus an odd number of gaps,
 *    so half of it lands half a gap short and the row visibly hitches once a
 *    minute.
 *  - The second copy is `aria-hidden`, so the duplication is a visual device
 *    only and a screen reader hears each quote once.
 */

type Testimonial = {
  quote: string;
  name: string;
  detail: string;
};

/**
 * PLACEHOLDER COPY. These are invented people saying invented things; they are
 * here to give the section its shape and rhythm, and they must be replaced
 * with real, attributable quotes before this page is published.
 */
const ROWS: readonly (readonly Testimonial[])[] = [
  [
    {
      quote:
        "Three weeks in and I still stop to listen to it. The thock is not a gimmick — it is the whole reason I type on this instead of the laptop.",
      name: "Priya Raghunathan",
      detail: "Backend engineer, Bengaluru",
    },
    {
      quote:
        "I have owned four customs. This is the first one that arrived needing nothing: no lube, no tape mod, no foam. It was simply finished.",
      name: "Tomas Lindqvist",
      detail: "Sound designer, Malmö",
    },
    {
      quote:
        "The knob does volume by day and scrub-through-timeline by night. I did not expect the thing I would miss most to be a dial.",
      name: "Alina Moreau",
      detail: "Video editor, Montréal",
    },
    {
      quote:
        "Twelve hours of drafting a day and my wrists stopped complaining in the second week. The tilt risers are doing more work than they get credit for.",
      name: "Ben Osei",
      detail: "Technical writer, Accra",
    },
    {
      quote:
        "Ordered the gunmetal, second-guessed it for a week, then opened the box. It photographs badly and looks extraordinary in person.",
      name: "Hana Kirchner",
      detail: "Product designer, Vienna",
    },
    {
      quote:
        "Support answered a stabiliser question on a Sunday with a video of the fix. Not a template — an actual video of the actual board.",
      name: "Marcus Whitfield",
      detail: "Data analyst, Leeds",
    },
  ],
  [
    {
      quote:
        "I put the little screen on a pomodoro timer and my standup notes on the wallpaper. It is the only screen on my desk I never resent.",
      name: "Sofia Almeida",
      detail: "Founder, Lisbon",
    },
    {
      quote:
        "My partner works in the same room and has stopped asking me to type quieter. That is the entire review.",
      name: "Daniel Okonkwo",
      detail: "Software engineer, Dublin",
    },
    {
      quote:
        "Hot-swapped to linears on a Tuesday, back to tactiles on a Thursday, no solder, no drama. It survives my indecision.",
      name: "Yuki Tanaka",
      detail: "Frontend developer, Osaka",
    },
    {
      quote:
        "Four weeks felt long until it turned up. You can tell someone typed on it before it was boxed — there were fingerprints on the test sheet.",
      name: "Elena Vasquez",
      detail: "Copywriter, Buenos Aires",
    },
    {
      quote:
        "The keycap legends are dye-sub, so eighteen months of daily use later my WASD still says WASD.",
      name: "Jonas Reuter",
      detail: "QA lead, Hamburg",
    },
    {
      quote:
        "It has the heft of something you would inherit. I keep expecting to find a serial plate on the underside.",
      name: "Naomi Bergström",
      detail: "Architect, Stockholm",
    },
  ],
  [
    {
      quote:
        "Bought it for the looks, kept it for the spacebar. No rattle, no ping, just a low flat knock every single time.",
      name: "Rahul Menon",
      detail: "iOS developer, Kochi",
    },
    {
      quote:
        "Three saved Bluetooth profiles means work laptop, home desktop and the machine in the lab. One tap, no re-pairing.",
      name: "Clara Nowak",
      detail: "Research scientist, Kraków",
    },
    {
      quote:
        "I write eight thousand words a week on this. It is the only piece of hardware I have ever wanted a second of.",
      name: "Isabel Duarte",
      detail: "Novelist, Porto",
    },
    {
      quote:
        "Replaced one keycap after I dropped a mug on it. Part shipped in two days and cost less than lunch.",
      name: "Kwame Boateng",
      detail: "Systems admin, Toronto",
    },
    {
      quote:
        "The battery has outlasted every claim on the page. I charge it roughly when I remember to, which is not often.",
      name: "Mei-Ling Chow",
      detail: "Producer, Singapore",
    },
    {
      quote:
        "It is the quietest good keyboard I have used and the best-sounding quiet one. I did not think you got both.",
      name: "Oliver Grant",
      detail: "Music teacher, Wellington",
    },
  ],
] as const;

/**
 * Per-row durations, in seconds. Deliberately not equal and deliberately not
 * multiples of each other: three rows on one duration lock into step and read
 * as a single sliding block rather than three independent ones.
 */
const DURATIONS = [72, 58, 84];

/**
 * The heading, split so "customers" can keep the keycap orange — the same
 * colour the brand name is set in up in the statement paragraph, so the two
 * places the page raises its voice use one colour.
 *
 * Data rather than markup because <StaggeredText> has to break the line into
 * per-character spans to animate it, and a coloured <span> written inline
 * would be one more thing for it to split.
 */
const HEADING: readonly Segment[] = [
  { text: "Hear from our" },
  { text: "customers", className: "text-keycap" },
] as const;

/** The claim under it, in the sans body face. */
const SUBHEADING: readonly Segment[] = [
  { text: "More than 3000 custom units sold." },
] as const;

export function TestimonialMarquee() {
  return (
    <section className="py-20 sm:py-28">
      {/* The heading is inside the page gutter; the rows below deliberately
          are not, because a marquee that starts and stops at the text measure
          reads as a widget rather than as something passing through. */}
      <Container className="text-center">
        {/* The hero's reveal, character by character out of blur — the same
            <StaggeredText> the headline at the top of the page is built with,
            in its scroll-driven mode because this one is a page away from the
            fold. See the component for why that is a mode rather than a
            separate thing.

            `font-serif` is redundant — globals.css already sets the heading
            serif on every h1-h3 — but it is stated here because this is the
            one heading on the page whose face is load-bearing rather than
            inherited, and a future utility on this element should not be able
            to change it by accident.

            `font-normal` is NOT redundant: it undoes the base h2 rule's 600.
            Instrument Serif ships one weight, 400, so 600 is not a heavier cut
            of the face — it is the browser smearing the 400 outlines to fake
            one, which at 4rem thickens every stroke and flattens the hairlines
            the didone is made of. 400 is what the hero h1 is set at. */}
        <StaggeredText
          as="h2"
          segments={HEADING}
          className="font-serif text-[2.75rem] font-normal leading-[1.02] tracking-[-0.02em] text-ink sm:text-[4rem]"
          reveal="scroll"
        />

        {/* Same relationship the hero has between its headline and its spec
            line: the smaller line sweeps FASTER (a shorter step per character)
            and starts later, so it does not trail a long way behind a heading
            that has a third of its character count. Both land together. */}
        <StaggeredText
          segments={SUBHEADING}
          className="mt-4 font-sans text-base font-light text-ink-muted"
          reveal="scroll"
          scrollFrom={16}
          scrollStep={0.7}
          scrollSpan={12}
        />
      </Container>

      {/* `relative` and `overflow-hidden` live HERE rather than on the section
          so the blurred edges below cover the rows and only the rows — on the
          section they would sit over the first characters of the heading too,
          which is exactly the kind of thing that reads as a rendering bug. */}
      <div className="relative mt-10 overflow-hidden sm:mt-14">
        <div className="flex flex-col gap-4">
          {ROWS.map((row, index) => (
            <Row
              key={index}
              testimonials={row}
              // First and third track left-to-right, the middle one against
              // them. Opposing directions are what stop the three rows reading
              // as one wide belt.
              direction={index === 1 ? "left" : "right"}
              duration={DURATIONS[index]}
            />
          ))}
        </div>

        {/* The blurred edges. Each is a `backdrop-filter` pane rather than a
            painted gradient, so what softens is the CARDS BEHIND IT — the row
            genuinely resolves out of the blur as it travels inward, instead of
            being covered by something that fades.

            The mask is what gives it a direction: the pane is fully opaque at
            the outer edge, where its blur applies at full strength, and fades
            to nothing inward, so the blur eases off across its width rather
            than ending on a visible seam. The gradient underneath pulls the
            same band down into the page black, which is what a browser without
            `backdrop-filter` is left with — a plain fade, no smear, still no
            hard edge. */}
        <Edge side="left" />
        <Edge side="right" />
      </div>
    </section>
  );
}

function Row({
  testimonials,
  direction,
  duration,
}: {
  testimonials: readonly Testimonial[];
  direction: "left" | "right";
  duration: number;
}) {
  return (
    // `overflow-hidden` per row rather than once around all three: each track
    // is its own scroll of content and none of them should be able to paint
    // over its neighbours.
    <div className="marquee overflow-hidden">
      <ul
        className="marquee-track flex w-max"
        data-direction={direction}
        style={{ animationDuration: `${duration}s` }}
      >
        {testimonials.map((testimonial) => (
          <Card key={testimonial.name} testimonial={testimonial} />
        ))}
        {testimonials.map((testimonial) => (
          <Card
            key={`${testimonial.name}-copy`}
            testimonial={testimonial}
            aria-hidden
          />
        ))}
      </ul>
    </div>
  );
}

function Card({
  testimonial,
  ...rest
}: {
  testimonial: Testimonial;
  "aria-hidden"?: boolean;
}) {
  return (
    // `panelSurface` and its own `p-5`, rather than `panel`: these cards are
    // read in passing, three rows of them sliding by at once, and the site's
    // standard 24px inset makes a wall of them. A quote wants less air around
    // it here than a feature card does sitting still on a page.
    //
    // `mr-4` and not a track-level `gap` — see the note at the top of the file
    // for why that is what keeps the loop seamless.
    <li
      className={`${panelSurface} mr-4 w-[17.5rem] shrink-0 p-5 sm:w-[20rem]`}
      {...rest}
    >
      <p className="text-sm leading-relaxed text-ink-muted">
        “{testimonial.quote}”
      </p>
      <p className="mt-4 text-sm text-ink">{testimonial.name}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {testimonial.detail}
      </p>
    </li>
  );
}

function Edge({ side }: { side: "left" | "right" }) {
  const toward = side === "left" ? "right" : "left";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 ${
        side === "left" ? "left-0" : "right-0"
      } w-16 backdrop-blur-[6px] sm:w-28`}
      style={{
        background: `linear-gradient(to ${toward}, var(--color-surface), transparent)`,
        maskImage: `linear-gradient(to ${toward}, #000 30%, transparent)`,
        WebkitMaskImage: `linear-gradient(to ${toward}, #000 30%, transparent)`,
      }}
    />
  );
}
