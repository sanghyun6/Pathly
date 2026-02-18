"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Timeline, type LocationId } from "@/components/Timeline";
import { MapView } from "@/components/MapView";
import { ExportButton } from "@/components/ExportButton";
import { LocationDetail } from "@/components/LocationDetail";
import { optimizeItineraryRoute } from "@/lib/route-optimizer";
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
  const [optimizing, setOptimizing] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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

  const handleOptimize = useCallback(() => {
    if (!data) return;
    setOptimizing(true);
    requestAnimationFrame(() => {
      const next = optimizeItineraryRoute(data);
      setData(next);
      persistItinerary(next);
      setOptimizing(false);
    });
  }, [data]);

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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 lg:flex-row">
      {/* Left panel (top on mobile): timeline */}
      <aside className="flex min-h-0 flex-1 flex-col border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80 lg:max-w-md lg:border-r lg:shadow-sm">
        <header className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Your itinerary
              </h1>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {data.days.length} day(s) planned
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ExportButton
                targetRef={printRef}
                filename="pathly-itinerary.pdf"
                className="shrink-0"
              />
              <button
                type="button"
                onClick={handleOptimize}
                disabled={optimizing}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {optimizing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                ) : (
                  "Optimize route"
                )}
              </button>
              <Link
                href="/"
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Plan another
              </Link>
            </div>
          </div>
        </header>
        <div ref={printRef} className="min-h-0 flex-1 px-4 sm:px-5">
          <div className="print:block">
            <Timeline
              itinerary={data}
              selectedLocationId={selectedLocationId}
              onSelectLocation={handleSelectLocation}
              editable
              onItineraryChange={handleItineraryChange}
            />
          </div>
        </div>
      </aside>

      {/* Right panel (bottom on mobile): map */}
      <main className="flex min-h-[50vh] min-w-0 flex-1 flex-col border-t border-slate-200 lg:min-h-0 lg:border-l lg:border-t-0">
        <div className="h-full min-h-[50vh] w-full lg:min-h-0">
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
