import Link from "next/link";
import { NAV_LINKS } from "@/lib/navigation";
import { Container } from "@/components/ui/Container";
import { Logo } from "./Logo";

/** Server Component — it has no state, so none of it needs to ship as JS. */
export function Footer() {
  return (
    <footer className="border-t border-line bg-surface-sunken">
      <Container className="flex flex-col gap-8 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-xs text-sm text-ink-muted">
            Custom mechanical keyboards, built one at a time in small batches.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-muted transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>

      <Container className="border-t border-line py-6">
        <p className="font-mono text-xs tracking-[0.15em] text-ink-muted">
          © {new Date().getFullYear()} CORUS KEYBOARDS
        </p>
      </Container>
    </footer>
  );
}
