import type { Coordinates, GenerateRouteResponse, ItineraryDay } from "@/lib/types";

function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/**
 * Reorder locations within each day to minimize total travel distance (greedy nearest-neighbor).
 * Keeps the first location as the start; then repeatedly picks the nearest unvisited location.
 */
export function optimizeDayOrder<T extends { coordinates: Coordinates }>(locations: T[]): T[] {
  if (locations.length <= 2) return [...locations];
  const result: T[] = [locations[0]];
  const remaining = locations.slice(1);

  while (remaining.length > 0) {
    const last = result[result.length - 1].coordinates;
    let bestIdx = 0;
    let bestDist = haversineDistance(last, remaining[0].coordinates);
    for (let i = 1; i < remaining.length; i++) {
      const d = haversineDistance(last, remaining[i].coordinates);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    result.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  return result;
}

/** Optimize the order of locations within each day to minimize travel distance. */
export function optimizeItineraryRoute(itinerary: GenerateRouteResponse): GenerateRouteResponse {
  return {
    days: itinerary.days.map(
      (day): ItineraryDay => ({
        ...day,
        locations: optimizeDayOrder(day.locations),
      })
    ),
  };
}
