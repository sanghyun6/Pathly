import type { ItineraryDay, ItineraryLocation, Coordinates } from "@/lib/types";

function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/** Reorder locations within a day using nearest-neighbor from first location to minimize travel distance. */
function optimizeDayOrder(locations: ItineraryLocation[]): ItineraryLocation[] {
  if (locations.length <= 2) return [...locations];
  const result: ItineraryLocation[] = [locations[0]];
  const remaining = new Set(locations.slice(1).map((_, i) => i + 1));

  while (remaining.size > 0) {
    const last = result[result.length - 1].coordinates;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const idx of remaining) {
      const d = haversineDistance(last, locations[idx].coordinates);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    }
    if (bestIdx >= 0) {
      result.push(locations[bestIdx]);
      remaining.delete(bestIdx);
    }
  }
  return result;
}

/** Returns a new itinerary with locations within each day reordered for efficient route (nearest neighbor). */
export function optimizeItineraryRoute(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day) => ({
    ...day,
    locations: optimizeDayOrder(day.locations),
  }));
}
