/**
 * Shared class recipes.
 *
 * These are plain strings instead of wrapper components on purpose: `<Link>` is
 * generic over the route type under Next.js' typed routes, and wrapping it in a
 * `<Button href=...>` component erases that inference. Spreading a recipe onto
 * the real `<Link>` / `<button>` keeps full type-safety on `href` while still
 * giving us one place to edit the button design.
 */

/** Solid light-green CTA — the loudest thing on any page. Use one per screen. */
export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 " +
  "text-sm font-normal tracking-wide text-surface transition-colors duration-200 " +
  "hover:bg-accent-strong active:bg-accent-strong";

/** Quiet outline button for the secondary action next to the CTA. */
export const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 " +
  "text-sm font-normal tracking-wide text-ink transition-colors duration-200 " +
  "hover:border-accent hover:text-accent";

/** Small uppercase label that sits above a heading. */
export const eyebrow =
  "text-xs font-mono uppercase tracking-[0.2em] text-accent";

/** Panel used for feature cards, spec tables and configurator groups. */
export const panel =
  "rounded-2xl border border-line bg-surface-raised p-6";
