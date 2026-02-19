import type { GenerateRouteResponse, ItineraryLocation } from "@/lib/types";

export type CostCategory = "food" | "attraction" | "activity" | "transport";

/**
 * Parse estimatedCost string to a number (USD).
 * Handles: "Free", "$20", "20", "$20-30" (uses first number), "€25" (strips symbol), decimals.
 */
export function parseCostToNumber(cost: string | number | null | undefined): number | null {
  if (cost === null || cost === undefined) return null;
  if (typeof cost === "number") return Number.isFinite(cost) ? cost : null;
  const s = String(cost).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "free" || lower === "0") return 0;
  // Match first number (handles "$20-30", "20 USD", "about $25")
  const match = s.replace(/,/g, "").match(/\d+\.?\d*/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

/** Format number as USD, e.g. $1,234.56 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Sum of parsed costs for a list of locations. Returns null if no parseable costs. */
export function sumLocationCosts(locations: ItineraryLocation[]): number {
  let total = 0;
  for (const loc of locations) {
    const n = parseCostToNumber(loc.estimatedCost);
    if (n !== null) total += n;
  }
  return total;
}

/** Total estimated cost for the entire trip (sum of all days). */
export function sumTripCosts(itinerary: GenerateRouteResponse): number {
  let total = 0;
  for (const day of itinerary.days) {
    total += sumLocationCosts(day.locations);
  }
  return total;
}

/** Cost breakdown by category. Uses optional category on location; uncategorized goes to "other". */
export function sumCostsByCategory(itinerary: GenerateRouteResponse): Record<string, number> {
  const categories: Record<string, number> = {
    food: 0,
    attraction: 0,
    activity: 0,
    transport: 0,
    other: 0,
  };
  for (const day of itinerary.days) {
    for (const loc of day.locations) {
      const n = parseCostToNumber(loc.estimatedCost);
      if (n === null) continue;
      const cat = (loc as ItineraryLocation & { category?: string }).category;
      const key =
        cat && ["food", "attraction", "activity", "transport"].includes(cat) ? cat : "other";
      categories[key] = (categories[key] ?? 0) + n;
    }
  }
  return categories;
}
