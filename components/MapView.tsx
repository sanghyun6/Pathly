"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import type { GenerateRouteResponse, ItineraryLocation } from "@/lib/types";
import type { LocationId } from "@/components/Timeline";
import { parseCostToNumber, formatCurrency } from "@/lib/budget";

/** Format "09:00" / "14:30" as "9:00 AM" / "2:30 PM" */
function formatTime(timeStr: string): string {
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;
  const h = parseInt(match[1], 10);
  const m = match[2];
  if (h === 0) return `12:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  if (h < 12) return `${h}:${m} AM`;
  return `${h - 12}:${m} PM`;
}

function formatCostDisplay(estimatedCost: string): string {
  const n = parseCostToNumber(estimatedCost);
  if (n !== null) return formatCurrency(n);
  return estimatedCost || "—";
}

export interface MapViewProps {
  itinerary: GenerateRouteResponse;
  selectedLocationId: LocationId | null;
  onSelectLocation: (locationId: LocationId | null, location: ItineraryLocation | null) => void;
  apiKey: string;
  mapId?: string;
  /** When non-empty, show only locations from these days; when empty, show all. Enables multi-day expansion. */
  expandedDayIndices?: number[];
  /** When set, map zooms to this day's locations only (e.g. the newly expanded day). Other markers stay visible. */
  focusedDayIndex?: number | null;
}

function locationId(dayIndex: number, locIndex: number): LocationId {
  return `${dayIndex}-${locIndex}`;
}

const PIN_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899"];

function getPinColor(dayIndex: number): string {
  return PIN_COLORS[dayIndex % PIN_COLORS.length];
}

function flattenLocations(itinerary: GenerateRouteResponse): Array<{
  location: ItineraryLocation;
  locationId: LocationId;
  dayIndex: number;
  locIndex: number;
}> {
  const out: Array<{
    location: ItineraryLocation;
    locationId: LocationId;
    dayIndex: number;
    locIndex: number;
  }> = [];
  itinerary.days.forEach((day, dayIndex) => {
    day.locations.forEach((location, locIndex) => {
      out.push({
        location,
        locationId: locationId(dayIndex, locIndex),
        dayIndex,
        locIndex,
      });
    });
  });
  return out;
}

/** Hover tooltip overlay: name + time. Hidden when this marker is the selected one (InfoWindow open). */
function useHoverTooltipOverlay(
  map: google.maps.Map | null,
  position: google.maps.LatLngLiteral | null,
  name: string,
  time: string
) {
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const positionRef = useRef(position);
  const contentRef = useRef({ name, time });
  positionRef.current = position;
  contentRef.current = { name, time };

  useEffect(() => {
    if (!map) return;
    const overlay = new google.maps.OverlayView();
    overlay.onAdd = function (this: google.maps.OverlayView) {
      const div = document.createElement("div");
      div.className = "pathly-marker-tooltip";
      div.style.cssText =
        "position:absolute;left:0;top:0;white-space:nowrap;padding:6px 8px;background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:500;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.2);pointer-events:none;z-index:1;";
      this.getPanes()!.floatPane.appendChild(div);
      (this as unknown as { div: HTMLDivElement }).div = div;
    };
    overlay.draw = function (this: google.maps.OverlayView & { div?: HTMLDivElement }) {
      const pos = positionRef.current;
      const div = this.div;
      if (!pos || !div) return;
      const proj = this.getProjection();
      if (!proj) return;
      const point = proj.fromLatLngToDivPixel(new google.maps.LatLng(pos.lat, pos.lng));
      if (!point) return;
      div.style.left = `${Math.round(point.x)}px`;
      div.style.top = `${Math.round(point.y - 12)}px`;
      div.style.transform = "translate(-50%, -100%)";
      const { name: n, time: t } = contentRef.current;
      div.textContent = `${n} — ${t}`;
    };
    overlay.onRemove = function (this: google.maps.OverlayView & { div?: HTMLDivElement }) {
      if (this.div?.parentNode) this.div.parentNode.removeChild(this.div);
    };
    overlayRef.current = overlay;
    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    if (position) {
      ov.setMap(map);
      ov.draw();
    } else {
      ov.setMap(null);
    }
  }, [map, position]);
}

function MapContent({
  points,
  path,
  expandedDayIndices,
  focusedDayIndex,
  selectedLocationId,
  onSelectLocation,
  hoveredMarkerId,
  selectedMarkerId,
  onMarkerMouseEnter,
  onMarkerMouseLeave,
  onMarkerClick,
  onCloseInfoWindow,
  ignoreNextMapClickRef,
}: {
  points: Array<{ location: ItineraryLocation; locationId: LocationId; dayIndex: number }>;
  path: google.maps.LatLngLiteral[];
  expandedDayIndices: number[];
  focusedDayIndex: number | null;
  selectedLocationId: LocationId | null;
  onSelectLocation: (locationId: LocationId | null, location: ItineraryLocation | null) => void;
  hoveredMarkerId: LocationId | null;
  /** Marker with detailed InfoWindow open (clicked). When set, hide hover tooltip for that marker. */
  selectedMarkerId: LocationId | null;
  onMarkerMouseEnter: (id: LocationId) => void;
  onMarkerMouseLeave: () => void;
  onMarkerClick: (id: LocationId) => void;
  onCloseInfoWindow: () => void;
  ignoreNextMapClickRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");

  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapType === "hybrid" ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP);
  }, [map, mapType]);

  // Hover tooltip: show only if (hoveredMarkerId === markerId AND selectedMarkerId !== markerId)
  const tooltipPoint = useMemo(() => {
    if (!hoveredMarkerId || hoveredMarkerId === selectedMarkerId) return null;
    return points.find((p) => p.locationId === hoveredMarkerId) ?? null;
  }, [points, hoveredMarkerId, selectedMarkerId]);

  useHoverTooltipOverlay(
    map,
    tooltipPoint?.location.coordinates ?? null,
    tooltipPoint?.location.name ?? "",
    tooltipPoint ? formatTime(tooltipPoint.location.time) : ""
  );

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", () => {
      if (ignoreNextMapClickRef.current) {
        ignoreNextMapClickRef.current = false;
        return;
      }
      onCloseInfoWindow();
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onCloseInfoWindow, ignoreNextMapClickRef]);

  // Build one path per day (only connect locations within the same day). Order preserved per day.
  // A day with 0 or 1 location gets NO polyline (nothing to connect).
  const pathsByDay = useMemo(() => {
    const byDay = new globalThis.Map<number, google.maps.LatLngLiteral[]>();
    for (const p of points) {
      const dayIndex = p.dayIndex;
      let dayPath = byDay.get(dayIndex);
      if (!dayPath) {
        dayPath = [];
        byDay.set(dayIndex, dayPath);
      }
      dayPath.push({ ...p.location.coordinates });
    }
    const entries = Array.from(byDay.entries());
    if (process.env.NODE_ENV === "development") {
      entries.forEach(([dayIndex, dayPath]) => {
        console.log(`[MapView polyline] dayIndex=${dayIndex} (Day ${dayIndex + 1}) points=${dayPath.length}`, dayPath.length >= 2 ? "→ polyline" : "→ skipped (< 2)");
      });
      const day10Entry = entries.find(([dayIndex]) => dayIndex === 9);
      if (day10Entry) {
        const [dayIndex, dayPath] = day10Entry;
        console.log("[MapView polyline] Day 10 detail:", { dayIndex, pointCount: dayPath.length, points: dayPath });
      }
    }
    return entries
      .filter(([, dayPath]) => dayPath.length >= 2)
      .map(([dayIndex, path]) => ({ dayIndex, path }));
  }, [points]);

  useEffect(() => {
    if (!map) return;
    const polylines: google.maps.Polyline[] = pathsByDay.map(({ dayIndex, path }) => {
      const strokeColor = PIN_COLORS[dayIndex % PIN_COLORS.length];
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor,
        strokeOpacity: 0.9,
        strokeWeight: 5,
      });
      polyline.setMap(map);
      return polyline;
    });
    return () => {
      polylines.forEach((p) => p.setMap(null));
    };
  }, [map, pathsByDay]);

  // Zoom to focused day when one is set (newly expanded); otherwise fit all visible. Other markers stay visible.
  const pathToFit = useMemo(() => {
    if (focusedDayIndex != null) {
      const dayPath = points.filter((p) => p.dayIndex === focusedDayIndex).map((p) => p.location.coordinates);
      return dayPath.length > 0 ? dayPath : path;
    }
    return path;
  }, [focusedDayIndex, points, path]);

  useEffect(() => {
    if (!map || pathToFit.length === 0) return;

    const isValidCoord = (lat: number, lng: number): boolean => {
      if (typeof lat !== "number" || typeof lng !== "number") return false;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
      if (lat === 0 && lng === 0) return false;
      return true;
    };

    const runCamera = () => {
      const raw = pathToFit.map((p) => ({ lat: p.lat, lng: p.lng }));
      const valid = pathToFit.filter((p) => {
        const lat = typeof p.lat === "string" ? Number(p.lat) : p.lat;
        const lng = typeof p.lng === "string" ? Number(p.lng) : p.lng;
        return isValidCoord(lat, lng);
      });

      if (focusedDayIndex === 9) {
        const dropped = pathToFit.filter((p) => {
          const lat = typeof p.lat === "string" ? Number(p.lat) : p.lat;
          const lng = typeof p.lng === "string" ? Number(p.lng) : p.lng;
          return !isValidCoord(lat, lng);
        });
        console.log("[MapView Day 10] raw points", raw);
        console.log("[MapView Day 10] filtered count", valid.length, "dropped", dropped.length, dropped);
      }

      if (valid.length === 0) return;
      if (valid.length === 1) {
        const p = valid[0];
        const lat = typeof p.lat === "number" ? p.lat : Number(p.lat);
        const lng = typeof p.lng === "number" ? p.lng : Number(p.lng);
        map.panTo({ lat, lng });
        map.setZoom(14);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      valid.forEach((p) => {
        const lat = typeof p.lat === "number" ? p.lat : Number(p.lat);
        const lng = typeof p.lng === "number" ? p.lng : Number(p.lng);
        bounds.extend({ lat, lng });
      });
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    };

    const t = window.setTimeout(runCamera, 80);
    return () => window.clearTimeout(t);
  }, [map, pathToFit, focusedDayIndex]);

  const activePoint = useMemo(
    () => points.find((p) => p.locationId === selectedMarkerId),
    [points, selectedMarkerId]
  );

  return (
    <>
      {/* Custom Map/Satellite toggle - matches app design */}
      <div className="absolute left-4 top-4 z-10 flex rounded-xl bg-white/95 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setMapType("roadmap")}
          className={`rounded-l-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
            mapType === "roadmap"
              ? "bg-emerald-500 text-white shadow-inner"
              : "bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setMapType("hybrid")}
          className={`rounded-r-xl border-l border-slate-200/80 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
            mapType === "hybrid"
              ? "bg-emerald-500 text-white shadow-inner"
              : "bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          }`}
        >
          Satellite
        </button>
      </div>
      {points.map(({ location, locationId: id, dayIndex }) => (
        <AdvancedMarker
          key={id}
          position={location.coordinates}
          onMouseEnter={() => onMarkerMouseEnter(id)}
          onMouseLeave={onMarkerMouseLeave}
          onClick={() => {
            ignoreNextMapClickRef.current = true;
            onSelectLocation(id, location);
          }}
        >
          <Pin
            background={selectedLocationId === id ? "#047857" : getPinColor(dayIndex)}
            borderColor={selectedLocationId === id ? "#065f46" : undefined}
            scale={selectedLocationId === id ? 1.2 : 1}
          />
        </AdvancedMarker>
      ))}
      {activePoint && (
        <InfoWindow
          position={activePoint.location.coordinates}
          onCloseClick={onCloseInfoWindow}
        >
          <div className="relative min-w-0 max-w-[240px] p-2 pr-8">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseInfoWindow();
              }}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Day {activePoint.dayIndex + 1}
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {activePoint.location.name}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              <span className="font-medium">Time:</span> {formatTime(activePoint.location.time)}
            </p>
            <p className="text-xs text-slate-600">
              <span className="font-medium">Duration:</span> {activePoint.location.duration}
            </p>
            <p className="mt-1.5 line-clamp-3 text-sm text-slate-600">
              {activePoint.location.description}
            </p>
            <p className="mt-1.5 text-xs font-medium text-slate-700">
              <span className="font-medium">Cost:</span> {formatCostDisplay(activePoint.location.estimatedCost)}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

const DEFAULT_MAP_ID = "DEMO_MAP_ID";

export function MapView({
  itinerary,
  selectedLocationId,
  onSelectLocation,
  apiKey,
  mapId,
  expandedDayIndices = [],
  focusedDayIndex = null,
}: MapViewProps) {
  const effectiveMapId = mapId?.trim() || DEFAULT_MAP_ID;
  const [hoveredMarkerId, setHoveredMarkerId] = useState<LocationId | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<LocationId | null>(null);
  const ignoreNextMapClickRef = useRef(false);

  const points = useMemo(() => {
    const all = flattenLocations(itinerary);
    if (expandedDayIndices.length === 0) return all;
    const set = new Set(expandedDayIndices);
    return all.filter((p) => set.has(p.dayIndex));
  }, [itinerary, expandedDayIndices]);
  const path = useMemo(() => points.map((p) => p.location.coordinates), [points]);
  const center = useMemo(() => {
    if (path.length === 0) return { lat: 0, lng: 0 };
    const lat = path.reduce((s, p) => s + p.lat, 0) / path.length;
    const lng = path.reduce((s, p) => s + p.lng, 0) / path.length;
    return { lat, lng };
  }, [path]);

  const handleMarkerMouseEnter = useCallback((id: LocationId) => setHoveredMarkerId(id), []);
  const handleMarkerMouseLeave = useCallback(() => setHoveredMarkerId(null), []);
  const handleMarkerClick = useCallback((id: LocationId) => {
    setSelectedMarkerId((current) => (current === id ? null : id));
  }, []);
  const handleCloseInfoWindow = useCallback(() => setSelectedMarkerId(null), []);

  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el) return;
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = mapWrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  if (!apiKey?.trim()) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100/60">
        <p className="text-sm text-slate-500">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the map
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div ref={mapWrapperRef} className="relative h-full min-h-[280px] w-full">
        <Map
          mapId={effectiveMapId}
          defaultCenter={center}
          defaultZoom={12}
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          scaleControl={false}
          rotateControl={false}
          zoomControl={false}
          fullscreenControl={false}
          className="h-full min-h-[280px] w-full rounded-lg"
        >
          <MapContent
          points={points}
          path={path}
          expandedDayIndices={expandedDayIndices}
          focusedDayIndex={focusedDayIndex}
          selectedLocationId={selectedLocationId}
          onSelectLocation={onSelectLocation}
          hoveredMarkerId={hoveredMarkerId}
          selectedMarkerId={selectedMarkerId}
          onMarkerMouseEnter={handleMarkerMouseEnter}
          onMarkerMouseLeave={handleMarkerMouseLeave}
          onMarkerClick={handleMarkerClick}
          onCloseInfoWindow={handleCloseInfoWindow}
          ignoreNextMapClickRef={ignoreNextMapClickRef}
        />
        </Map>
        {/* Custom fullscreen button - matches Map/Satellite toggle design */}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200/80 backdrop-blur-sm transition-all duration-200 hover:bg-emerald-50 hover:ring-emerald-200 hover:shadow-emerald-200/30 active:bg-emerald-100"
        >
          {isFullscreen ? (
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4m0 0h5M9 4L4 9m14-5v5m0-5h-5m5 0l-5-5m5 14l-5-5m5 5v-5m0 5h-5m5 0l5-5" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>
    </APIProvider>
  );
}
