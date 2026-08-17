import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

// next/font self-hosts the font files at build time (no request to Google at
// runtime) and exposes them as CSS variables, which globals.css maps onto
// Tailwind's `font-sans` / `font-mono` tokens.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // `%s` is replaced by each page's own `title`; the home page uses `default`.
  title: {
    default: "Corus — Custom mechanical keyboards",
    template: "%s — Corus",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface font-sans text-ink">
        <Header />
        {/* `pt-16` clears the fixed 4rem header; `flex-1` pins the footer to
            the bottom on short pages. */}
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
