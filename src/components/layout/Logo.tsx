/**
 * The Corus wordmark: a keycap glyph plus the name.
 *
 * `aria-hidden` on the SVG keeps screen readers from announcing decorative
 * shapes — the adjacent text already says "Corus".
 */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-accent"
        aria-hidden="true"
        focusable="false"
      >
        {/* keycap skirt */}
        <rect
          x="2.5"
          y="3.5"
          width="19"
          height="17"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        {/* keycap top face */}
        <rect x="6.5" y="7" width="11" height="8" rx="2" fill="currentColor" />
      </svg>
      <span className="text-lg font-normal tracking-tight text-ink">
        Corus
      </span>
    </span>
  );
}
