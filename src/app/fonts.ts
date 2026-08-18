import { Geist_Mono, Instrument_Serif, Inter } from "next/font/google";

/**
 * Font configuration — 100% free Google Fonts.
 *
 * These are loaded with `next/font/google` rather than an `@import`, which
 * downloads each family at BUILD time and self-hosts it from your own domain.
 * That means no runtime request to Google, no render-blocking <link> in the
 * <head>, no third-party connection to negotiate, and no layout shift — Next.js
 * generates a size-adjusted local fallback automatically.
 *
 * The equivalent plain-CSS @import is documented in globals.css if you would
 * rather use it.
 *
 * Each family is exposed as a CSS variable, so the stacks are composed in
 * globals.css (see the `@theme` block there) rather than being hard-wired to a
 * class name here.
 */

/**
 * Headings — a high-contrast display serif with a tall x-height and short,
 * tightly-spaced descenders, which is what lets it be set large and tight
 * without falling apart.
 *
 * Instrument Serif ships ONE weight: 400 (plus a matching italic). There is no
 * 600 or 700 to reach for, so hierarchy here is built from size and spacing
 * rather than weight — asking for a weight that is not in the file just makes
 * the browser fake it, which looks smeared next to real type.
 */
export const fontSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
  display: "swap",
});

/**
 * Body, subheadings and UI.
 *
 * Shifted one step lighter: 300 for lead paragraphs, 400 for everything that
 * used to be 500. Small copy stays at 400 rather than 300 — on a dark
 * background thin strokes lose more legibility than they gain elegance.
 */
export const fontSans = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Small uppercase eyebrow labels and spec tables. Not part of the requested
 * pairing, but those labels are load-bearing in this design — and Geist Mono is
 * itself a free Google Font, so the stack stays 100% free.
 */
export const fontMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-geist-mono",
  display: "swap",
});
