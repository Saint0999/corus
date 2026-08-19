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

const HERO_STATS = [
  { value: "3", label: "Switch profiles" },
  { value: "6", label: "Case finishes" },
  { value: "4 wks", label: "Build time" },
] as const;

const SIGNATURE_DETAILS = [
  {
    title: "Tuned, not assembled",
    body: "Switches are lubed and filmed by hand, stabilisers are clipped and balanced, and every board is typed on before it ships.",
  },
  {
    title: "Sound you choose",
    body: "Pick thock or clack at checkout. Case foam, plate material and mounting style are all part of the same decision.",
  },
  {
    title: "Serviceable forever",
    body: "Hot-swap sockets, standard keycap profiles and replacement parts kept in stock for the life of the board.",
  },
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

      {/* --- Supporting strip --- */}
      <section className="border-t border-line py-16 sm:py-20">
        <Container>
          <dl className="grid grid-cols-3 gap-4 border-b border-line pb-10">
            {HERO_STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-2xl font-normal text-ink sm:text-3xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted sm:text-[10px] sm:tracking-[0.18em]">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {SIGNATURE_DETAILS.map((item) => (
              <article key={item.title}>
                <h2 className="text-xl text-ink">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
