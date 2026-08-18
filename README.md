# Corus

Marketing site for a custom mechanical keyboard company.
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # all four routes prerender as static HTML
npm run lint
```

## File structure

```
src/
  app/
    layout.tsx                Root layout: fonts, metadata, Header + Footer shell
    fonts.ts                  next/font config + how to add the licensed PP families
    globals.css               Tailwind v4 @theme — all design tokens live here
    page.tsx                  / — hero (reactive-lines backdrop + copy)
    customise/page.tsx        /customise — wraps the <Configurator> island
    about/page.tsx            /about
    features/page.tsx         /features

  components/
    layout/
      Header.tsx              Fixed nav, active-route highlight, mobile menu
      Footer.tsx
      Logo.tsx                Keycap wordmark (inline SVG)
    originkit/
      reactive-lines.tsx      Vendored Originkit component (kept verbatim)
    hero/
      ReactiveLinesBackdrop.tsx  Wrapper: props + first-paint kick
    customise/
      Configurator.tsx        Client island: option state + derived price
    ui/
      Container.tsx           The single page-gutter definition

  lib/
    navigation.ts             Nav links (shared by Header and Footer)
    styles.ts                 Shared class recipes (buttons, panels, eyebrow)
    configurator-options.ts   Product option data + pricing
```

## Design system

Defined once in `src/app/globals.css` under Tailwind v4's `@theme`, which turns
each token into utilities (`--color-accent` → `bg-accent`, `text-accent`, …).

| Token             | Value     | Use                         |
| ----------------- | --------- | --------------------------- |
| `surface`         | `#000000` | Page background — always solid, never a gradient |
| `surface-raised`  | `#0e0e0e` | Cards, panels               |
| `surface-sunken`  | `#050505` | Footer                      |
| `line`            | `#242424` | Hairline borders            |
| `ink`             | `#fafafa` | Headings and high-contrast text |
| `ink-muted`       | `#a3a3a3` | Body copy                   |
| `accent`          | `#cdea1b` | Chartreuse CTA / hover / active state |
| `accent-strong`   | `#b4ce14` | Hover and pressed states    |

On true black the raised/sunken steps are deliberately tiny — a few points of
lightness is enough to separate a card from the page, and more reads as a grey
box floating on black. The hairline border does most of the edge definition.

## Typography

100% free Google Fonts.

| Role                        | Family                        | Weights       | Fallbacks                                    |
| --------------------------- | ----------------------------- | ------------- | -------------------------------------------- |
| Headings (`h1`,`h2`,`h3`)   | **Instrument Serif**          | 400           | Didot, Georgia, Times New Roman, serif       |
| Body, subheadings, UI       | **Inter**                     | 300, 400      | system-ui, -apple-system, Segoe UI, Roboto, sans-serif |
| Eyebrow labels, spec tables | **Geist Mono**                | 400           | ui-monospace, SFMono-Regular, Menlo, monospace |

Configured in `src/app/fonts.ts`, composed into stacks in `globals.css`.

### The Google Fonts import

The project loads these with `next/font`, which self-hosts them at build time.
If you would rather load them from Google directly, this single `@import` as the
**first line** of `src/app/globals.css` is the equivalent:

```css
@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@300;400&family=Geist+Mono:wght@400&display=swap");
```

Or as `<link>` tags in `layout.tsx`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@300;400&family=Geist+Mono:wght@400&display=swap" rel="stylesheet" />
```

Either drops straight in — the stacks already name each family literally as the
fallback inside its `var()`, so nothing else changes. `next/font` stays the
default because an `@import` is render-blocking, costs an extra DNS + TLS
handshake to a third party, and shifts layout when the webfont swaps in.

### Tailwind classes

The `@theme` block generates the utilities from the tokens:

| Class        | Resolves to                     |
| ------------ | ------------------------------- |
| `font-serif` | Instrument Serif stack          |
| `font-sans`  | Inter stack (applied on `body`) |
| `font-mono`  | Geist Mono stack                |

`h1`/`h2`/`h3` get the serif automatically from the `@layer base` block, so
`font-serif` is only needed to opt a non-heading element in.

Two details worth knowing before editing `globals.css`:

- The font block is a plain `@theme`, **not** `@theme inline`. `inline`
  substitutes values into the generated utilities and never emits the custom
  property, so `var(--font-serif)` would be undefined — and the heading rules
  need the raw value.
- Each family is written `var(--next-font-var, "Literal Name")`. The fallback
  inside `var()` is load-bearing: an undefined variable with no fallback makes
  the *entire* `font-family` declaration invalid, collapsing the stack to the
  browser default instead of moving on to the next family.

### Heading hierarchy

Tracking and leading are set once in `@layer base`; only size stays in the
markup.

| Element | Letter-spacing | Line-height |
| ------- | -------------- | ----------- |
| `h1`    | `-0.02em`      | `1.05`      |
| `h2`    | `-0.012em`     | `1.15`      |
| `h3`    | `-0.004em`     | `1.3`       |

**Instrument Serif ships exactly one weight (400), plus an italic.** There is no
600 or 700 to reach for, so heading hierarchy is built from size, tracking and
leading — never from `font-weight`. Putting `font-bold` on a heading would make
the browser synthesise the weight, which looks smeared next to real type.

Because weight is off the table, sizes carry the hierarchy instead: interior
page titles are `text-5xl sm:text-6xl`, section headings `text-4xl`, and card
titles `text-xl`. Card titles in particular need that size — at 18px this face
is too delicate to separate itself from the body copy underneath.

### Inter weights

Shifted one step lighter: **300** for lead paragraphs, **400** for body copy and
for everything in the UI that used to be 500. Small copy deliberately stays at
400 rather than 300 — on a dark background thin strokes lose more legibility
than they gain elegance.

Nothing uses 500 or 600 any more. If you want a heavier UI back, add the weight
to the Inter `weight` array in `src/app/fonts.ts` first — asking for a weight
that was never loaded gets you a synthesised approximation, not a graceful
fallback.

## Notes on the hero backdrop

The hero visual is Originkit's **Reactive Lines** — a cursor-reactive canvas of
curved lines. Added with `npx originkit@latest add reactive-lines`.

- `src/components/originkit/reactive-lines.tsx` is vendored **byte-for-byte** as
  the registry ships it, so a re-add or upgrade applies cleanly. It is excluded
  from ESLint in `eslint.config.mjs` for that reason — reformatting it to house
  style would be exactly the local modification worth avoiding. TypeScript still
  type-checks it.
- Everything this site changes about it lives in
  `src/components/hero/ReactiveLinesBackdrop.tsx`, through props and one effect.
- Lines are white at 50% opacity on a black fill.
- **`backgroundColor` must track `--color-surface`.** The canvas is created with
  `{ alpha: false }`, so it is opaque and repaints that colour every frame. Any
  drift shows up as a visible seam where the hero meets the rest of the page.
- That same opacity, combined with the component starting deferred, means it
  renders a black rectangle until the first `mousemove` — permanently so on
  touch devices, where that event never fires. The wrapper dispatches one
  synthetic move on mount to paint the first frame.
