"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/navigation";
import { Container } from "@/components/ui/Container";
import { Logo } from "./Logo";

/**
 * Fixed site header.
 *
 * This is a Client Component for two reasons — `usePathname()` (to highlight
 * the current route) and `useState` (the mobile menu). It is deliberately the
 * *only* client boundary in the chrome: pages themselves stay Server
 * Components, so none of their content ships to the browser as JS.
 */
export function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-line/80 bg-surface/85 backdrop-blur-md"
      // Landmark role is implicit on <header>, but the label helps when a page
      // has more than one banner-like region.
      aria-label="Site header"
    >
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="rounded-sm transition-opacity hover:opacity-80"
          onClick={() => setIsMenuOpen(false)}
        >
          <Logo />
          <span className="sr-only">Corus home</span>
        </Link>

        {/* --- Desktop navigation --- */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                // `aria-current` is how assistive tech announces "you are here";
                // colour alone would not be enough.
                aria-current={isActive ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-normal transition-colors duration-200 hover:text-accent ${
                  isActive ? "text-accent" : "text-ink-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <Link
            href="/customise"
            className="ml-3 rounded-full bg-accent px-5 py-2 text-sm font-normal text-surface transition-colors duration-200 hover:bg-accent-strong"
          >
            Build yours
          </Link>
        </nav>

        {/* --- Mobile menu trigger --- */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-accent hover:text-accent md:hidden"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {isMenuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>
      </Container>

      {/* --- Mobile navigation panel ---
          Rendered conditionally rather than hidden with CSS so its links are
          never focusable while the menu is closed. */}
      {isMenuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-line bg-surface md:hidden"
        >
          <Container className="flex flex-col py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className={`border-b border-line/60 py-4 text-base font-normal last:border-b-0 ${
                  pathname === link.href ? "text-accent" : "text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
