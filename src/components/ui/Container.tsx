import type { ReactNode } from "react";

/**
 * The one place the page gutter and max width are defined. Every section uses
 * it, so changing the site's measure is a one-line edit.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 lg:px-10 ${className}`}>
      {children}
    </div>
  );
}
