/** Request body for POST /api/generate-route */
export interface GenerateRouteRequestBody {
  destination: string;
  startDate: string;
  endDate: string;
  budget: "budget" | "moderate" | "luxury";
  travelStyle: ("sightseeing" | "food" | "activities" | "relaxed")[];
}

/** Coordinates for a location */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** A single location in a day's itinerary */
export interface ItineraryLocation {
  name: string;
  time: string;
  duration: string;
  description: string;
  estimatedCost: string;
  coordinates: Coordinates;
}

/** One day of the itinerary */
export interface ItineraryDay {
  date: string;
  locations: ItineraryLocation[];
}

/** Response from POST /api/generate-route */
export interface GenerateRouteResponse {
  days: ItineraryDay[];
}
