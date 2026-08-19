import Link from "next/link";
import { HeroVideo } from "@/components/hero/HeroVideo";
import { KeyboardReveal } from "@/components/model/KeyboardReveal";
import {
  ScrollRevealText,
  type Segment,
} from "@/components/statement/ScrollRevealText";
import { StaggeredText } from "@/components/text/StaggeredText";
import { Container } from "@/components/ui/Container";
import { buttonPrimary } from "@/lib/styles";

/**
 * Home page.
 *
 * This stays a Server Component: only the hero video crosses into the client,
 * so the headline and CTA are in the initial HTML — good for LCP and for
 * crawlers.
 */

/**
 * The spec sheet at the foot of the page.
 *
 * Two headline claims, then the numbers behind them in two tables. It is data
 * rather than markup because every row is the same shape — a label and a value
 * — and a table that is written out by hand is a table where one row quietly
 * ends up styled differently from the rest.
 */
const HIGHLIGHTS = [
  {
    title: "Switches (hot swappable)",
    detail: "tactile / 55g / two-stage spring / factory lubed",
  },
  {
    title: "Screen Features",
    detail: "Timer / Custom Wallpapers / More to come",
  },
] as const;

const MATERIALS = [
  ["Top Enclosure", "CNC Alu / Anodized Silver"],
  ["Bottom Enclosure", "CNC Alu / Anodized Gun Metal"],
  ["Switch Plate", "Stamped Alu / Anodized Black"],
  ["Tilt Risers", "Rubberized Plastic"],
  ["Keycaps", "Dye Sub PBT"],
  ["Knobs", "ABS Plastic"],
  ["Screen Glass", "CNC Glass w/ adhesive black film"],
  ["Screen", "100×310 px full-color LCD screen"],
] as const;

const CONNECTIVITY = [
  ["USB-C Connection", "Cable Included"],
  ["Bluetooth", "Up to 3 saved connections"],
  ["Battery", "3000mah Li-ion Battery"],
] as const;

/** The hero headline, split so "keystroke" can keep the accent colour. */
const HERO_HEADLINE: readonly Segment[] = [
  { text: "Build your perfect" },
  { text: "keystroke", className: "text-accent" },
] as const;

/** The hero spec line, bottom right. */
const HERO_SPEC: readonly Segment[] = [
  {
    text:
      "Lubed switches, a foam damped case, and a sound profile you pick " +
      "before we ever reach for a screwdriver",
  },
] as const;

/**
 * The statement paragraph, split so the brand name can carry its own colour.
 * It is data rather than markup because <ScrollRevealText> needs to break the
 * copy into per-word spans to animate it.
 */
const STATEMENT: readonly Segment[] = [
  { text: "Evoking the look of both classic and modern technology," },
  { text: "Corus", className: "text-keycap" },
  {
    text:
      "is designed to be a beautiful and functional part of your every day " +
      "workflow. Uniquely designed keycaps, two programmable knobs, and a " +
      "feature-filled full-color screen.",
  },
] as const;

// The hero fills the viewport minus the 4rem fixed header. `svh` (small
// viewport height) is used instead of `vh` so mobile browser chrome sliding in
// and out never crops the layout.
const HERO_HEIGHT = "min-h-[calc(100svh-4rem)]";

export default function HomePage() {
  return (
    <>
      {/* --- Hero ------------------------------------------------------------
          A full-bleed product video, with the copy anchored to the bottom
          corners: headline left, spec line right.

          `overflow-hidden` is load-bearing: on a portrait viewport the video
          is scaled past the edges of this box, and this is what crops it. */}
      <section
        className={`relative flex ${HERO_HEIGHT} flex-col overflow-hidden`}
      >
        {/* Backdrop: the board rendered on black. Its background matches
            `--color-surface`, so the seam where it meets the rest of the page
            is invisible. */}
        <HeroVideo />

        {/* Legibility scrim. The render is near-black in both bottom corners
            on a wide screen, but a narrow viewport reframes it — this
            guarantees the headline and spec line keep their contrast at every
            width. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2/5 bg-gradient-to-t from-surface via-surface/45 to-transparent"
        />

        {/* Copy layer. `mt-auto` pins it to the bottom of the flex column. */}
        <Container className="relative z-10 mt-auto pb-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
            {/* Bottom left: the headline. */}
            <div className="max-w-md">
              <StaggeredText
                as="h1"
                segments={HERO_HEADLINE}
                className="text-[2.75rem] text-ink sm:text-6xl"
                // ~25 characters at this beat is a 1.5s reveal — slow enough
                // to watch the headline come into focus, short enough that the
                // CTA below it is not waiting on it.
                stagger={55}
                delay={200}
              />

              {/* Lands as the last characters of the headline resolve, in the
                  same blur-to-focus move — see `.blur-fade-in` in globals.css. */}
              <Link
                href="/customise"
                className={`${buttonPrimary} blur-fade-in mt-7`}
                style={{ animationDelay: "1650ms" }}
              >
                Start customising
              </Link>
            </div>

            {/* Bottom right: the spec line. Right-aligned from `sm` up so it
                anchors to the corner rather than floating mid-air. */}
            <StaggeredText
              segments={HERO_SPEC}
              className="max-w-xs text-sm font-light leading-relaxed text-ink-muted sm:text-right"
              // Starts as the headline lands, and sweeps much faster: this is
              // four times the character count, so the headline's beat would
              // drag it out past five seconds.
              stagger={12}
              delay={1100}
            />
          </div>
        </Container>
      </section>

      {/* --- Statement ------------------------------------------------------
          A quiet pause between the hero and the detail strip: one block of
          copy in the heading serif, nothing competing with it. It starts at
          40% opacity and lights up word by word as it is scrolled through, so
          the paragraph is read at the pace the scroll sets. "Corus" is set in
          the keycap orange so the name carries the product's own colour. */}
      {/* The bottom padding is deliberately much smaller than the top: the
          model section that follows opens on a screenful of black above the
          board, and stacking a full `py-32` on top of that read as a hole in
          the page rather than as breathing room. */}
      <section className="pt-24 pb-10 sm:pt-32 sm:pb-12">
        <Container>
          <ScrollRevealText
            className="max-w-3xl font-serif text-[2rem] leading-[1.1] tracking-[-0.02em] text-ink sm:text-[3rem]"
            segments={STATEMENT}
          />
        </Container>
      </section>

      {/* --- Model reveal ---------------------------------------------------
          The paragraph above describes the board; this is where the reader
          gets to look at it. A two-viewport-tall section with a pinned canvas:
          the board holds still on screen and stands up from a three-quarter
          tilt to face-on as the scroll runs through. Client-only and loaded on
          approach — see the component. */}
      <KeyboardReveal />

      {/* --- Spec sheet -----------------------------------------------------
          The close of the page: no persuasion left, just the build. Two
          claims across the top, then the materials and the electronics as
          plain label/value tables.

          Set in the SANS face, not the site's heading serif. The serif carries
          the argument earlier on the page; this is reference material, and it
          is read by scanning down the left column rather than by reading
          sentences. */}
      <section className="pt-10 pb-28 sm:pt-14 sm:pb-36">
        <Container>
          <div className="grid gap-10 sm:grid-cols-2 sm:gap-12">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title}>
                <h2 className="font-sans text-2xl font-light tracking-[-0.01em] text-ink sm:text-[1.75rem]">
                  {item.title}
                </h2>
                <p className="mt-1.5 text-sm font-light text-ink-muted sm:text-base">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-20 grid gap-14 sm:mt-28 sm:grid-cols-2 sm:gap-x-16">
            <SpecTable title="Materials" rows={MATERIALS} />
            <SpecTable title="Connectivity and Power" rows={CONNECTIVITY} />
          </div>
        </Container>
      </section>
    </>
  );
}

/**
 * One block of the spec sheet: a heading, a rule, and label/value rows.
 *
 * A <dl> rather than a <table>: these are name/value pairs, not a grid of data
 * with meaningful columns, and a screen reader announcing "table, 8 rows, 2
 * columns" for what is really a list of properties is noise.
 *
 * `divide-y` plus a `border-t` is what puts a hairline UNDER the heading and
 * BETWEEN every row while leaving the foot of the list open, so the block ends
 * on the page rather than on a closing line.
 */
function SpecTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <h2 className="font-sans text-2xl font-light tracking-[-0.01em] text-ink sm:text-[1.75rem]">
        {title}
      </h2>

      <dl className="mt-5 divide-y divide-line border-t border-line">
        {rows.map(([label, value]) => (
          // `items-baseline` so a value that wraps to two lines still sits on
          // the same first line as its label instead of centring against it.
          <div
            key={label}
            className="flex items-baseline justify-between gap-6 py-3.5"
          >
            <dt className="text-[15px] font-light text-ink">{label}</dt>
            <dd className="text-right text-[15px] font-light text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
