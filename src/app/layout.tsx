import type { Metadata } from "next";
import { fontMono, fontSans, fontSerif } from "./fonts";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import GradualBlur from "@/components/reactbits/GradualBlur";
import "./globals.css";

export const metadata: Metadata = {
  // `%s` is replaced by each page's own `title`; the home page uses `default`.
  title: {
    default: "Corus | Custom mechanical keyboards",
    template: "%s | Corus",
  },
  description:
    "Corus builds custom mechanical keyboards one at a time: lubed switches, foam-damped cases and a sound profile you choose before assembly.",
};

/**
 * Root layout — the app shell.
 *
 * Note the `LayoutProps<"/">` type: Next.js generates it from the route tree,
 * so `children` (and any future parallel route slots) stay type-safe without
 * hand-written prop types.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Each font exposes a CSS variable; globals.css composes them into the
      // `--font-serif` / `--font-sans` / `--font-mono` stacks. Adding the
      // licensed PP families later means adding their `.variable` here too.
      className={`${fontSerif.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface font-sans text-ink">
        <Header />
        {/* `pt-16` clears the fixed 4rem header; `flex-1` pins the footer to
            the bottom on short pages. */}
        <main className="flex-1 pt-16">{children}</main>
        <Footer />

        {/* Page-level gradual blur: a band pinned to the BOTTOM OF THE VIEWPORT
            that stays there for the whole scroll, so page content dissolves as
            it reaches the bottom edge of the screen rather than running into
            it. `target="page"` is what makes it `position: fixed` instead of
            absolute, and it is mounted here in the root layout — once, outside
            <main> — so it covers every route and is not re-created on
            navigation.

            It has to sit ABOVE the content to work at all: `backdrop-filter`
            blurs whatever is painted behind it in stacking order, so a blur
            layered underneath the page would have nothing to act on. The
            component adds 100 to `zIndex` for page targets, putting this at
            1100 — over the fixed z-50 header, though the two never meet at
            opposite ends of the screen.

            Being on top does NOT make it swallow clicks: with no
            `hoverIntensity` set the component renders itself
            `pointer-events: none`, so the hero's CTA underneath stays fully
            clickable — it is blurred, not blocked. That is the trade this
            effect asks for, and it is worth knowing where the cost lands:
            anything the design parks in the bottom 6rem of the viewport is
            seen through the blur. `height` is the dial. */}
        <GradualBlur
          target="page"
          position="bottom"
          height="6rem"
          strength={1.5}
          divCount={5}
          curve="bezier"
          exponential
          opacity={1}
        />
      </body>
    </html>
  );
}
