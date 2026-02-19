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
}

function locationId(dayIndex: number, locIndex: number): LocationId {
  return `${dayIndex}-${locIndex}`;
}

const PIN_COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#dc2626"];

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

  useEffect(() => {
    if (!map || path.length < 2) return;
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#059669",
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    polyline.setMap(map);
    return () => polyline.setMap(null);
  }, [map, path]);

  useEffect(() => {
    if (!map || path.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, [map, path]);

  const activePoint = useMemo(
    () => points.find((p) => p.locationId === selectedMarkerId),
    [points, selectedMarkerId]
  );

  return (
    <>
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
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Day {activePoint.dayIndex + 1}
            </p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              {activePoint.location.name}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium">Time:</span> {formatTime(activePoint.location.time)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium">Duration:</span> {activePoint.location.duration}
            </p>
            <p className="mt-1.5 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
              {activePoint.location.description}
            </p>
            <p className="mt-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
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
}: MapViewProps) {
  const effectiveMapId = mapId?.trim() || DEFAULT_MAP_ID;
  const [hoveredMarkerId, setHoveredMarkerId] = useState<LocationId | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<LocationId | null>(null);
  const ignoreNextMapClickRef = useRef(false);

  const points = useMemo(() => flattenLocations(itinerary), [itinerary]);
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

  if (!apiKey?.trim()) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100/50 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the map
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        mapId={effectiveMapId}
        defaultCenter={center}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full min-h-[280px] w-full rounded-lg"
      >
        <MapContent
          points={points}
          path={path}
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
    </APIProvider>
  );
}
