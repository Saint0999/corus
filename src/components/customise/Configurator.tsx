"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BASE_PRICE,
  DEFAULT_SELECTION,
  OPTION_GROUPS,
  type GroupId,
  type Selection,
} from "@/lib/configurator-options";
import { buttonPrimary } from "@/lib/styles";

const priceFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * Build configurator.
 *
 * State design note: the component holds one `Selection` object rather than
 * four separate `useState` calls. Adding a fifth option group then means
 * editing `configurator-options.ts` only — no new state, no new handler.
 *
 * The running total is derived with `useMemo` instead of being stored in state.
 * Anything that can be calculated from existing state should be, otherwise the
 * two can drift out of sync.
 */
export function Configurator() {
  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION);

  const { total, chosen } = useMemo(() => {
    const chosenOptions = OPTION_GROUPS.map((group) => ({
      group: group.label,
      option:
        group.options.find((option) => option.id === selection[group.id]) ??
        group.options[0],
    }));

    return {
      chosen: chosenOptions,
      total: chosenOptions.reduce(
        (sum, entry) => sum + entry.option.price,
        BASE_PRICE,
      ),
    };
  }, [selection]);

  function select(groupId: GroupId, optionId: string) {
    // Always replace the object rather than mutating it — React compares by
    // reference to decide whether to re-render.
    setSelection((current) => ({ ...current, [groupId]: optionId }));
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
      {/* --- Option groups --- */}
      <div className="space-y-10">
        {OPTION_GROUPS.map((group) => (
          // A radio group is the correct semantic here: exactly one choice per
          // group. <fieldset>/<legend> is what tells a screen reader which
          // question the options belong to.
          <fieldset key={group.id}>
            <legend className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              {group.label}
            </legend>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {group.options.map((option) => {
                const isSelected = selection[group.id] === option.id;

                return (
                  <label
                    key={option.id}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors duration-200 ${
                      isSelected
                        ? "border-accent bg-surface-raised"
                        : "border-line bg-surface-raised hover:border-ink-muted"
                    }`}
                  >
                    {/* The native input stays in the DOM (hidden visually, not
                        with `display:none`) so keyboard arrows, form
                        submission and assistive tech all keep working. */}
                    <input
                      type="radio"
                      name={group.id}
                      value={option.id}
                      checked={isSelected}
                      onChange={() => select(group.id, option.id)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">
                        {option.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                          isSelected ? "bg-accent" : "bg-line"
                        }`}
                      />
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-ink-muted">
                      {option.description}
                    </span>
                    <span className="mt-3 block font-mono text-[11px] text-ink-muted">
                      {option.price === 0
                        ? "Included"
                        : `+ ${priceFormatter.format(option.price)}`}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {/* --- Live summary ---
          `sticky` keeps the price in view while the options scroll past. */}
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="rounded-2xl border border-line bg-surface-raised p-6">
          <h2 className="text-lg font-semibold text-ink">Your build</h2>

          <dl className="mt-6 divide-y divide-line border-y border-line">
            {chosen.map((entry) => (
              <div
                key={entry.group}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted">
                  {entry.group}
                </dt>
                <dd className="text-right text-sm text-ink">
                  {entry.option.label}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex items-baseline justify-between">
            <span className="text-sm text-ink-muted">Total</span>
            {/* `aria-live` announces the new total to screen-reader users when
                a selection changes, since nothing else moves on screen. */}
            <span
              aria-live="polite"
              className="text-3xl font-semibold text-accent"
            >
              {priceFormatter.format(total)}
            </span>
          </div>

          <Link href="/features" className={`${buttonPrimary} mt-6 w-full`}>
            Review the spec
          </Link>

          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">
            Built to order · 4 weeks
          </p>
        </div>
      </aside>
    </div>
  );
}
