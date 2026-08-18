import Link from "next/link";
import { ReactiveLinesBackdrop } from "@/components/hero/ReactiveLinesBackdrop";
import { Container } from "@/components/ui/Container";
import { buttonPrimary } from "@/lib/styles";

/**
 * Home page.
 *
 * This stays a Server Component: only the reactive-lines backdrop crosses into
 * the client, so the headline and CTA are in the initial HTML — good for LCP
 * and for crawlers.
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

// The hero fills the viewport minus the 4rem fixed header. `svh` (small
// viewport height) is used instead of `vh` so mobile browser chrome sliding in
// and out never crops the layout.
const HERO_HEIGHT = "min-h-[calc(100svh-4rem)]";

export default function HomePage() {
  return (
    <>
      {/* --- Hero ------------------------------------------------------------
          A full-bleed cursor-reactive line field, with the copy anchored to the
          bottom corners: headline left, spec line right. */}
      <section className={`relative flex ${HERO_HEIGHT} flex-col overflow-hidden`}>
        {/* Backdrop: Originkit's cursor-reactive line field, underneath
            everything else in the hero. Its canvas is opaque, so it has to be
            the first child — anything painted before it would be hidden. */}
        <ReactiveLinesBackdrop />

        {/* Copy layer. `mt-auto` pins it to the bottom of the flex column. */}
        <Container className="relative z-10 mt-auto pb-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
            {/* Bottom left: the headline. */}
            <div className="max-w-md">
              <h1 className="text-[2.75rem] text-ink sm:text-6xl">
                Build your perfect{" "}
                <span className="text-accent">keystroke</span>
              </h1>

              <Link href="/customise" className={`${buttonPrimary} mt-7`}>
                Start customising
              </Link>
            </div>

            {/* Bottom right: the spec line. Right-aligned from `sm` up so it
                anchors to the corner rather than floating mid-air. */}
            <p className="max-w-xs text-sm font-light leading-relaxed text-ink-muted sm:text-right">
              lubed switches, a foam damped case, and a sound profile you pick
              before we ever reach for a screwdriver
            </p>
          </div>
        </Container>
      </section>

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
