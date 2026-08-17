/**
 * Configurator data.
 *
 * Kept out of the component so the UI is pure presentation — this is the shape
 * you would later swap for a fetch from a CMS or a product API without
 * touching a single line of JSX.
 */

export type Option = {
  id: string;
  label: string;
  description: string;
  /** Added to the base price, in whole pounds. */
  price: number;
};

export type OptionGroup = {
  id: string;
  label: string;
  options: readonly Option[];
};

export const BASE_PRICE = 249;

export const OPTION_GROUPS = [
  {
    id: "layout",
    label: "Layout",
    options: [
      { id: "65", label: "65%", description: "Arrows, no function row", price: 0 },
      { id: "75", label: "75%", description: "Function row, compact", price: 20 },
      { id: "tkl", label: "TKL", description: "Full row, no numpad", price: 40 },
    ],
  },
  {
    id: "switches",
    label: "Switches",
    options: [
      { id: "linear", label: "Linear", description: "Smooth, 45 g, lubed", price: 0 },
      { id: "tactile", label: "Tactile", description: "Rounded bump, 55 g", price: 15 },
      { id: "silent", label: "Silent", description: "Dampened stem, 45 g", price: 25 },
    ],
  },
  {
    id: "case",
    label: "Case finish",
    options: [
      { id: "charcoal", label: "Charcoal", description: "Bead-blasted anodised", price: 0 },
      { id: "amber", label: "Amber", description: "Warm gold anodised", price: 35 },
      { id: "raw", label: "Raw", description: "Brushed, uncoated", price: 30 },
    ],
  },
  {
    id: "keycaps",
    label: "Keycaps",
    options: [
      { id: "pbt", label: "PBT dye-sub", description: "Cherry profile", price: 0 },
      { id: "double", label: "Doubleshot ABS", description: "Cherry profile", price: 25 },
      { id: "blank", label: "Blank PBT", description: "No legends", price: 10 },
    ],
  },
] as const satisfies readonly OptionGroup[];

export type GroupId = (typeof OPTION_GROUPS)[number]["id"];

/** A selection is a map of group id -> chosen option id. */
export type Selection = Record<GroupId, string>;

/** Everything starts on the first (cheapest) option of each group. */
export const DEFAULT_SELECTION = Object.fromEntries(
  OPTION_GROUPS.map((group) => [group.id, group.options[0].id]),
) as Selection;
