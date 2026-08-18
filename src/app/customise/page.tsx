import type { Metadata } from "next";
import { Configurator } from "@/components/customise/Configurator";
import { Container } from "@/components/ui/Container";
import { eyebrow } from "@/lib/styles";

export const metadata: Metadata = {
  title: "Customise",
  description:
    "Choose your layout, switches, case finish and keycaps, and see the price update as you build.",
};

/**
 * Customise page — a Server Component that renders one interactive island.
 *
 * The heading and copy are static HTML; only <Configurator> ships JavaScript.
 */
export default function CustomisePage() {
  return (
    <>
      <section className="border-b border-line py-20 sm:py-24">
        <Container>
          <p className={eyebrow}>Customise</p>
          <h1 className="mt-5 max-w-2xl text-5xl text-ink sm:text-6xl">
            Specify it once. We build it once.
          </h1>
          <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-ink-muted">
            Four decisions, no upsells. Everything you pick here is set before
            assembly starts, so nothing has to be pulled apart later.
          </p>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <Configurator />
        </Container>
      </section>
    </>
  );
}
