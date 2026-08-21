import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buttonSecondary, eyebrow, panel } from "@/lib/styles";

export const metadata: Metadata = {
  title: "About",
  description:
    "Corus is a small workshop building custom mechanical keyboards to order. No stock models, no mass production.",
};

const PRINCIPLES = [
  {
    title: "One at a time",
    body: "No production line. A single builder takes a board from bare PCB to finished unit, and their initials go on the service card.",
  },
  {
    title: "Parts you can replace",
    body: "Standard spacing, standard profiles, standard screws. Anything that wears out is something you can order and fit yourself.",
  },
  {
    title: "Quiet by default",
    body: "Dampened cases, tuned stabilisers and no branding on the top plate. The board should be the least loud thing on your desk.",
  },
] as const;

const TIMELINE = [
  ["2021", "Two people, one milling machine, a spare bedroom."],
  ["2023", "First gasket-mounted case. The workshop moves to a real unit."],
  ["2025", "Hot-swap and VIA become standard on every build."],
  ["2026", "Around forty boards leave the bench each month."],
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-line py-20 sm:py-24">
        <Container>
          <p className={eyebrow}>About</p>
          <h1 className="mt-5 max-w-2xl text-5xl text-ink sm:text-6xl">
            A small workshop that only makes keyboards.
          </h1>
          <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-ink-muted">
            Corus started because the boards we wanted did not exist at any
            price: quiet, heavy, repairable, and specified by the person typing
            on them. So we started building them to order, and never stopped.
          </p>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <article key={principle.title} className={panel}>
                <h2 className="text-xl text-ink">
                  {principle.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  {principle.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line py-20">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className={eyebrow}>History</p>
            <h2 className="mt-4 text-4xl text-ink">
              How we got here
            </h2>
            <Link href="/features" className={`${buttonSecondary} mt-8`}>
              What we build
            </Link>
          </div>

          <ol className="divide-y divide-line border-y border-line">
            {TIMELINE.map(([year, event]) => (
              <li key={year} className="flex gap-8 py-5">
                <span className="w-14 shrink-0 font-mono text-xs tracking-[0.15em] text-accent">
                  {year}
                </span>
                <span className="text-sm leading-relaxed text-ink-muted">
                  {event}
                </span>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}
