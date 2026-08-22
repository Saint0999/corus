import Link from "next/link";
import { NAV_LINKS } from "@/lib/navigation";
import { BASE_PRICE } from "@/lib/configurator-options";
import { buttonPrimary } from "@/lib/styles";
import { Logo } from "./Logo";

/**
 * Where press and wholesale mail lands.
 *
 * PLACEHOLDER — there is no contact address anywhere else in the repo, so this
 * is invented to match the brand. Swap it for the real inbox before launch; it
 * is referenced twice below (the press line, and the newsletter fallback).
 */
const PRESS_EMAIL = "press@corus.design";

/**
 * Where the newsletter form posts.
 *
 * There is no backend in this project, so this is read from the environment and
 * left unset by default — point it at whatever list host is used (Buttondown,
 * Mailchimp, Formspree; they all take a plain form POST).
 *
 * The `mailto:` fallback is deliberate rather than lazy. A `<form>` with no
 * `action` posts to the CURRENT url, so an unconfigured signup would swallow
 * the address and bounce the reader off a 405 — a form that silently loses
 * what someone typed is worse than no form. Falling back to their mail client
 * keeps the row honest: it always does something real with the address.
 */
const NEWSLETTER_ACTION =
  process.env.NEXT_PUBLIC_NEWSLETTER_ACTION || `mailto:${PRESS_EMAIL}`;

/** The configurator's own starting price, so the two can never disagree. */
const PRICE_FROM = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
}).format(BASE_PRICE);

/**
 * Footer.
 *
 * A closing CTA rather than a sitemap: one display line, the order button, a
 * newsletter row, and the small print — set inside a single orange lozenge that
 * runs nearly the full width of the page, with the quiet links on the black
 * below it.
 *
 * It is deliberately WIDE AND SHALLOW — around 3.3:1 at laptop width, flatter
 * still above that. That proportion is the whole look: `rounded-full` turns
 * the short edges into true semicircles, and a semicircular cap only reads as
 * a cap on a block far wider than it is tall. Let the block get tall and the
 * same radius bows the sides into an oval instead. Everything vertical here is
 * therefore kept on a short leash — see the heading size especially.
 *
 * THE ORANGE. `--color-keycap` is already in the system — it is the arrow
 * cluster on the physical board, pushed to full saturation so it can carry type
 * (see globals.css). Using it here rather than inventing a footer colour means
 * the loudest block on the site is still the product's own colour, and it is
 * the one place in the design that inverts: black type ON colour, where every
 * other section is light type on black. That inversion is what makes this read
 * as the end of the page instead of one more section.
 *
 * The accent green stays the CTA, exactly as it is everywhere else — chartreuse
 * on orange is a hard, deliberate clash, and it is why the button cannot be
 * missed. Both take black text, so the contrast story is unchanged.
 *
 * Server Component: no state, so none of it ships as JS.
 */
export function Footer() {
  return (
    <footer className="bg-surface pt-16">
      {/* FULL BLEED, deliberately outside <Container>.

          Every other block on the site is capped at the shared measure
          (`max-w-6xl`), and this is the one that should not be: the lozenge is
          the page signing off, and a 1152px block floating in the middle of a
          wide display reads as another card rather than as the end of the
          document. So it gets the viewport instead, held off the edges by a
          gutter just wide enough to keep it a floating object rather than a
          band welded to the window.

          The gutter is the ONLY horizontal limit here — no max-width — so the
          block grows with the screen, and the type scale grows with it. */}
      <div className="px-4 sm:px-6">
        {/* The radius grows with the viewport and only becomes a true pill at
            `lg`, which is the first width where the block is wider than it is
            tall. On a phone the same `rounded-full` would bow the short edges
            so far inward that the first line of type would have to start
            halfway down the box.

            Padding is what keeps content off those curved caps. A stadium's
            left edge sits furthest inward at the top and bottom, by up to the
            full radius; measured at laptop width the worst-placed element
            needs 34px of clearance and `lg:px-24` gives it 96. Shrink this
            padding, or let the block grow taller, and type starts riding the
            curve. */}
        <div
          className="rounded-[2rem] bg-keycap px-7 py-10 text-surface
                     sm:rounded-[3.5rem] sm:px-12 sm:py-12
                     lg:rounded-full lg:px-24 lg:py-14"
        >
          {/* The display line.

              FONT AND WEIGHT are the hero headline's, stated explicitly rather
              than left to inherit: the base layer sets h2 to 600
              (globals.css), and Instrument Serif ships ONE weight — 400.
              Asking an h2 for 600 here would not reach for a bolder cut,
              because there isn't one; it would make the browser synthesise a
              fake bold by smearing the 400, which on a didone thickens exactly
              the hairlines the face is built around. So the hero's metrics are
              restated — Instrument Serif, 400, -0.032em — and this is h1's type
              at h2's place in the document outline.

              LEADING is 1, not the 1.04 the base layer gives h1, because 1 is
              what the HERO actually renders: its `sm:text-6xl` carries
              Tailwind's own `line-height: 1` and quietly overrides the base
              rule. Matching the computed value rather than the stylesheet is
              what makes the two display moments read as one voice, and the
              face is cut for it — short, tight descenders are why it survives
              being set this large and this close.

              SIZE is fluid rather than stepped, because the block it sits in
              is fluid too: with no max-width, breakpoint sizes stop tracking
              the box between steps. 4.6vw is chosen to keep the line to ONE
              line from tablet up, and that is the whole reason this block is
              slim — the heading is the tallest thing in it, so a second line
              of display type costs more height than the padding and both gaps
              put together. The floor keeps it readable on a phone (where it
              still wraps, and should); the ceiling stops it growing past the
              point where one line fits on an ultrawide.

              `text-wrap` (plain `wrap`) overrides the `balance` the base layer
              puts on every h2. Balance is right for a heading over a column of
              prose, where a stranded last word looks like a mistake; here it
              spends width evening lines out instead of letting the line run
              the measure and break where it runs out. */}
          <h2
            className="max-w-[16ch] text-wrap font-serif text-[clamp(2.25rem,4.6vw,8rem)]
                       font-normal leading-[1] tracking-[-0.032em] sm:max-w-none"
          >
            Every board is one of one. Yours is still unbuilt.
          </h2>

          {/* Actions. The order button and the signup sit on one line from `lg`
              and stack before that — at tablet width the email row cannot hold
              an input and a button side by side without the input shrinking to
              a slot too narrow to read your own address in. */}
          {/* `sm:items-start` is what keeps the order button a PILL. A stretch
              child in a flex column fills the line, which is right on a phone —
              a full-width bar is the easier tap target — and wrong from tablet
              up, where it turns the CTA into a green stripe across the block.
              `lg:items-center` then hands alignment back for the row layout. */}
          <div className="mt-8 flex flex-col gap-6 sm:items-start lg:mt-10 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/customise" className={buttonPrimary}>
              Build yours from {PRICE_FROM}
            </Link>

            {/* Stacked below `sm`, side by side above it. On a 375px screen
                the row has 271px to spend once both sets of padding are paid
                for, and the button needs ~130 of them — which leaves an input
                too narrow to finish rendering the word "address", let alone
                show you what you typed. Stacking buys the input the full
                measure back. */}
            <form
              action={NEWSLETTER_ACTION}
              method="post"
              className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:items-center lg:w-auto"
            >
              {/* The label is the accessible name; the placeholder is not one.
                  A placeholder disappears the moment anyone types, which leaves
                  a screen-reader user with an unlabelled box and a sighted user
                  with no reminder of what the field wanted. */}
              <label htmlFor="footer-email" className="sr-only">
                Email address for product updates
              </label>
              <input
                id="footer-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="your email address"
                className="min-w-0 flex-1 rounded-full bg-ink px-5 py-3 text-sm text-surface
                           placeholder:text-surface/45 focus-visible:outline-surface
                           lg:w-64 lg:flex-none"
              />
              <button
                type="submit"
                className="w-full shrink-0 rounded-full bg-surface px-5 py-3 text-sm text-ink
                           transition-opacity duration-200 hover:opacity-85
                           focus-visible:outline-surface sm:w-auto"
              >
                Get updates
              </button>
            </form>
          </div>

          {/* Small print, inside the block — it belongs to the loud half of the
              footer, not the quiet strip below. `/75` rather than a second
              token: it is black on orange, and the token set has no "muted
              black" because this is the only place that needs one. */}
          <p className="mt-8 text-sm text-surface/75 lg:mt-10">
            Copyright © {new Date().getFullYear()} / Corus Keyboards
          </p>
        </div>
      </div>

      {/* The quiet strip. Everything that is navigation rather than invitation
          lives out here on the black, so the lozenge above stays a single
          message instead of a message with a sitemap stapled to it.

          It repeats the lozenge's gutter AND its inner padding rather than
          going back inside <Container>, so the logo starts on the same vertical
          line the display heading does. Dropping to the site measure here
          instead would centre a 1152px row under a full-bleed block and read as
          a mistake at any width past that. */}
      <div className="px-4 sm:px-6">
        <div
          className="flex flex-col items-center gap-6 px-7 py-12
                     sm:flex-row sm:justify-between sm:px-12 lg:px-24"
        >
          <Logo />

          <nav
            aria-label="Footer"
            className="flex flex-wrap justify-center gap-x-6 gap-y-3"
          >
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

          <p className="text-sm text-ink-muted">
            Press &amp; wholesale{" "}
            {/* Braced string, not a bare text node: a literal `//` in JSX
                children trips react/jsx-no-comment-textnodes, which cannot tell
                a separator from a slipped-in line comment. */}
            <span aria-hidden="true" className="px-1 text-ink-muted/50">
              {"//"}
            </span>{" "}
            <a
              href={`mailto:${PRESS_EMAIL}`}
              className="transition-colors hover:text-accent"
            >
              {PRESS_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
