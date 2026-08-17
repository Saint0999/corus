import Link from "next/link";
import { HeroCanvas } from "@/components/three/HeroCanvas";
import { Container } from "@/components/ui/Container";
import { buttonPrimary, buttonSecondary, eyebrow } from "@/lib/styles";

/**
 * Home page.
 *
 * This stays a Server Component: only <HeroCanvas> crosses into the client, so
 * the headline and CTA are in the initial HTML (good for LCP and for crawlers)
 * while three.js streams in behind them.
 */

const HERO_STATS = [
  { value: "3", label: "Switch profiles" },
  { value: "6", label: "Case finishes" },
  { value: "4 wks", label: "Build time" },
] as const;

// The hero fills the viewport minus the 4rem fixed header. `svh` (small
// viewport height) is used instead of `vh` so mobile browser chrome sliding in
// and out never crops the CTA.
const HERO_HEIGHT = "min-h-[calc(100svh-4rem)]";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Container>
          {/* The hero is a two-column grid rather than an absolutely
              positioned canvas: with a grid the copy and the 3D column can
              never overlap, at any viewport width, without any magic numbers.
              Mobile stacks them — copy first, diorama underneath. */}
          <div
            // `grid-cols-1` is not cosmetic: an implicit grid track is sized
            // to `auto` (max-content), so the copy column would grow past the
            // viewport on phones instead of wrapping. `minmax(0,...)` — which
            // is what Tailwind's grid-cols-* expands to — is what allows a
            // grid item to shrink below its content width.
            className={`grid grid-cols-1 ${HERO_HEIGHT} items-start gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-center lg:gap-12`}
          >
            {/* --- Copy column --- */}
            <div className="pt-8 lg:pt-0">
              <p className={eyebrow}>Hand-built in small batches</p>

              <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                Build your perfect
                <span className="block text-accent">keystroke.</span>
              </h1>

              <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
                Every Corus board is assembled by hand — lubed switches, a
                foam-damped case, and a sound profile you pick before we ever
                reach for a screwdriver.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/customise" className={buttonPrimary}>
                  Start customising
                </Link>
                <Link href="/features" className={buttonSecondary}>
                  See the features
                </Link>
              </div>

              {/* A 3-column grid rather than a wrapping flex row: on a 375px
                  phone the three stats would otherwise break onto two lines and
                  push the diorama off the bottom of the screen. */}
              <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block text-2xl font-semibold text-ink">
                        {stat.value}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted sm:text-[10px] sm:tracking-[0.18em]">
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* --- 3D column ---
                The negative right margin lets the diorama bleed off the edge
                of the screen while staying an ordinary grid column (so it can
                never overlap the copy). The value is the distance from the
                container's right content edge to the viewport edge:
                half of whatever is left over outside the 72rem container,
                plus the container's own 2.5rem gutter.

                Note it is written in `vw`/`rem`, not `%`: a percentage margin
                on a grid item resolves against its *grid area*, not the
                container, which silently makes the column far too wide. */}
            <div className="relative -mx-6 h-[36svh] sm:mx-0 lg:-mr-[calc(max(0px,(100vw-72rem)/2)+2.5rem)] lg:h-[calc(100svh-4rem)]">
              <HeroCanvas />
            </div>
          </div>
        </Container>
      </section>

      {/* --- Supporting strip ------------------------------------------------
          A short, quiet section so the hero has somewhere to land. */}
      <section className="border-t border-line py-20">
        <Container>
          <div className="grid gap-10 sm:grid-cols-3">
            {[
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
            ].map((item) => (
              <article key={item.title}>
                <h2 className="text-lg font-semibold text-ink">{item.title}</h2>
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
