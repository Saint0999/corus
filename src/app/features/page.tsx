import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buttonPrimary, eyebrow, panel } from "@/lib/styles";

// Page-level metadata merges into the root layout's template -> "Features — Corus".
export const metadata: Metadata = {
  title: "Features",
  description:
    "Gasket mounting, hot-swap sockets, QMK/VIA firmware and hand-tuned acoustics — what goes into every Corus board.",
};

const FEATURES = [
  {
    title: "Gasket mount",
    body: "The plate floats on silicone gaskets instead of screwing into the case, giving a softer bottom-out and a lower, rounder sound.",
  },
  {
    title: "Hot-swap sockets",
    body: "Change switches with your fingers. No soldering iron, no desoldering pump, no risk to the PCB.",
  },
  {
    title: "QMK / VIA firmware",
    body: "Remap every key, build layers and record macros from the browser. Your layout lives on the board, not on your computer.",
  },
  {
    title: "Hand-tuned acoustics",
    body: "Case foam, plate material and a poron sheet under the PCB are chosen together, then checked by ear before the board ships.",
  },
  {
    title: "Machined aluminium case",
    body: "CNC-milled from a single 6063 billet, bead blasted and anodised. Heavy enough to stay put during fast typing.",
  },
  {
    title: "South-facing RGB",
    body: "LEDs sit below the switch so Cherry-profile keycaps clear them — even lighting, no interference.",
  },
] as const;

const SPECS = [
  ["Layout", "65% / 75% / TKL"],
  ["Mounting", "Gasket, five-point"],
  ["Plate", "FR4, POM or aluminium"],
  ["Connection", "USB-C, detachable"],
  ["Polling rate", "1000 Hz"],
  ["Weight", "1.4 kg (65%)"],
] as const;

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-line py-20 sm:py-24">
        <Container>
          <p className={eyebrow}>Features</p>
          <h1 className="mt-5 max-w-2xl text-5xl text-ink sm:text-6xl">
            Nothing on the board that isn&apos;t doing work.
          </h1>
          <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-ink-muted">
            Corus boards are built around a short list of decisions that
            actually change how a keyboard feels. Here is the whole list.
          </p>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className={`${panel} transition-colors duration-200 hover:border-accent/60`}
              >
                <h2 className="text-xl text-ink">
                  {feature.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  {feature.body}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="border-t border-line py-20">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className={eyebrow}>Specification</p>
            <h2 className="mt-4 text-4xl text-ink">
              The numbers
            </h2>
            <Link href="/customise" className={`${buttonPrimary} mt-8`}>
              Configure a board
            </Link>
          </div>

          <dl className="divide-y divide-line border-y border-line">
            {SPECS.map(([term, value]) => (
              <div
                key={term}
                className="flex items-baseline justify-between gap-6 py-4"
              >
                <dt className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
                  {term}
                </dt>
                <dd className="text-right text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>
    </>
  );
}
