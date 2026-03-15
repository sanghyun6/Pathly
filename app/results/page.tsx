"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Timeline, type LocationId } from "@/components/Timeline";
import { MapView } from "@/components/MapView";
import { LocationDetail } from "@/components/LocationDetail";
import { TripBudgetSummary } from "@/components/TripBudgetSummary";
import type {
  GenerateRouteRequestBody,
  GenerateRouteResponse,
  ItineraryLocation,
  ReplanStopRequestBody,
} from "@/lib/types";

const STORAGE_KEY = "pathly-route-result";
const REQUEST_STORAGE_KEY = "pathly-route-request";

function persistItinerary(data: GenerateRouteResponse) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export default function ResultsPage() {
  const [data, setData] = useState<GenerateRouteResponse | null>(null);
  const [tripRequest, setTripRequest] = useState<GenerateRouteRequestBody | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<LocationId | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<ItineraryLocation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedDayIndices, setExpandedDayIndices] = useState<number[]>(() => [0]);
  const [focusedDayIndex, setFocusedDayIndex] = useState<number | null>(0);
  const [replanningLocationId, setReplanningLocationId] = useState<LocationId | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GenerateRouteResponse;
        if (parsed?.days && Array.isArray(parsed.days)) {
          setData(parsed);
        }
      }
      const rawRequest = sessionStorage.getItem(REQUEST_STORAGE_KEY);
      if (rawRequest) {
        const parsedRequest = JSON.parse(rawRequest) as GenerateRouteRequestBody;
        if (parsedRequest?.destination && parsedRequest?.budget) {
          setTripRequest(parsedRequest);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectLocation = useCallback((locationId: LocationId | null, location: ItineraryLocation | null) => {
    setSelectedLocationId(locationId);
    setSelectedLocation(location);
    setDetailOpen(!!location);
  }, []);

  const handleItineraryChange = useCallback((days: GenerateRouteResponse["days"]) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = { ...prev, days };
      persistItinerary(next);
      return next;
    });
  }, []);

  const handleReplanLocation = useCallback(
    async (dayIndex: number, locationIndex: number) => {
      if (!data || !tripRequest) return;
      const targetLocationId = `${dayIndex}-${locationIndex}`;
      setReplanningLocationId(targetLocationId);

      try {
        const payload: ReplanStopRequestBody = {
          trip: tripRequest,
          dayIndex,
          locationIndex,
          itinerary: data,
        };

        const res = await fetch("/api/replan-stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const responseData = await res.json();
        if (!res.ok) {
          throw new Error(responseData.error ?? "Failed to replan this stop.");
        }

        const nextLocation = responseData.location as ItineraryLocation;
        setData((prev) => {
          if (!prev) return prev;
          const nextDays = prev.days.map((day, currentDayIndex) => {
            if (currentDayIndex !== dayIndex) return day;
            return {
              ...day,
              locations: day.locations.map((location, currentLocationIndex) =>
                currentLocationIndex === locationIndex ? nextLocation : location
              ),
            };
          });
          const next = { ...prev, days: nextDays };
          persistItinerary(next);
          return next;
        });

        if (selectedLocationId === targetLocationId) {
          setSelectedLocation(nextLocation);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to replan this stop.";
        if (typeof window !== "undefined") {
          window.alert(message);
        }
      } finally {
        setReplanningLocationId(null);
      }
    },
    [data, tripRequest, selectedLocationId]
  );

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  if (!data || data.days.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] px-4">
        <p className="text-center text-slate-600">
          No itinerary found. Generate one from the planner.
        </p>
        <Link
          href="/"
          className="mt-4 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700"
        >
          Plan a trip
        </Link>
      </div>
    );
  }

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapsMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8F9FA] lg:flex-row">
      <aside className="flex min-h-0 w-full flex-col overflow-hidden bg-white shadow-lg shadow-slate-200/50 lg:max-w-md lg:shrink-0">
        <header className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Your itinerary
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {data.days.length} day(s) planned
          </p>
        </header>
        <div
          className="scrollbar-pathly min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <TripBudgetSummary itinerary={data} className="mt-6 mb-4" />
          <Timeline
            itinerary={data}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleSelectLocation}
            editable
            onItineraryChange={handleItineraryChange}
            onReplanLocation={tripRequest ? handleReplanLocation : undefined}
            replanningLocationId={replanningLocationId}
            expandedDayIndices={expandedDayIndices}
            onExpandedDayIndicesChange={setExpandedDayIndices}
            onDayExpanded={setFocusedDayIndex}
          />
        </div>
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <MapView
            itinerary={data}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleSelectLocation}
            apiKey={mapsApiKey}
            mapId={mapsMapId}
            expandedDayIndices={expandedDayIndices}
            focusedDayIndex={focusedDayIndex}
          />
        </div>
      </main>

      <LocationDetail
        location={selectedLocation}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
