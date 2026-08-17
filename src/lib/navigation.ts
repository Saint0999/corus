/**
 * Single source of truth for the primary navigation.
 *
 * Keeping the links here (rather than hard-coding them in the header) means
 * the header, the footer and any future command palette all stay in sync.
 *
 * `as const` matters: it keeps each `href` as a string *literal*, which is what
 * Next.js' typed routes need in order to check the link against the real route
 * tree at compile time. Widen it to `string` and `<Link>` will reject it.
 */
export const NAV_LINKS = [
  { href: "/customise", label: "Customise" },
  { href: "/about", label: "About" },
  { href: "/features", label: "Features" },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];
