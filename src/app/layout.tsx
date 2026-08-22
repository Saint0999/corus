import type { Metadata } from "next";
import { fontMono, fontSans, fontSerif } from "./fonts";
import { Header } from "@/components/layout/Header";
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
        {/* `pt-16` clears the fixed 4rem header; `flex-1` makes the page fill
            the window on short routes rather than leaving the shell short.

            The footer and the page-level bottom blur used to sit here, after
            <main>, and that is exactly why they turned up on /customise:
            anything rendered in the root layout renders on EVERY route. Both
            now belong to `app/page.tsx`, the only route that wants them. */}
        <main className="flex-1 pt-16">{children}</main>
      </body>
    </html>
  );
}
