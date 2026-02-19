"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Timeline, type LocationId } from "@/components/Timeline";
import { MapView } from "@/components/MapView";
import { LocationDetail } from "@/components/LocationDetail";
import { TripBudgetSummary } from "@/components/TripBudgetSummary";
import type { GenerateRouteResponse, ItineraryLocation } from "@/lib/types";

const STORAGE_KEY = "pathly-route-result";

function persistItinerary(data: GenerateRouteResponse) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export default function ResultsPage() {
  const [data, setData] = useState<GenerateRouteResponse | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<LocationId | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<ItineraryLocation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!data || data.days.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 dark:from-slate-950 dark:to-slate-900">
        <p className="text-center text-slate-600 dark:text-slate-400">
          No itinerary found. Generate one from the planner.
        </p>
        <Link
          href="/"
          className="mt-4 min-h-[44px] rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Plan a trip
        </Link>
      </div>
    );
  }

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapsMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 lg:flex-row">
      <aside className="flex min-h-0 w-full flex-col overflow-hidden border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80 lg:max-w-md lg:shrink-0 lg:border-r lg:shadow-sm">
        <header className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Your itinerary
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {data.days.length} day(s) planned
          </p>
        </header>
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <TripBudgetSummary itinerary={data} className="mb-4" />
          <Timeline
            itinerary={data}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleSelectLocation}
            editable
            onItineraryChange={handleItineraryChange}
          />
        </div>
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden border-t border-slate-200 lg:border-l lg:border-t-0">
        <div className="absolute inset-0">
          <MapView
            itinerary={data}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleSelectLocation}
            apiKey={mapsApiKey}
            mapId={mapsMapId}
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
