"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
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

export interface MapViewProps {
  itinerary: GenerateRouteResponse;
  selectedLocationId: LocationId | null;
  onSelectLocation: (locationId: LocationId | null, location: ItineraryLocation | null) => void;
  apiKey: string;
  /** Optional Map ID for Advanced Markers. Use DEMO_MAP_ID for testing or create one in Cloud Console. */
  mapId?: string;
}

function locationId(dayIndex: number, locIndex: number): LocationId {
  return `${dayIndex}-${locIndex}`;
}

const PIN_COLORS = [
  "#059669", // emerald-600
  "#2563eb", // blue-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#dc2626", // red-600
];

function getPinColor(dayIndex: number): string {
  return PIN_COLORS[dayIndex % PIN_COLORS.length];
}

/** Flatten all locations with dayIndex and locIndex for rendering */
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

function MapContent({
  points,
  path,
  selectedLocationId,
  onSelectLocation,
  onHoverChange,
  hoveredLocationId,
}: {
  points: Array<{ location: ItineraryLocation; locationId: LocationId; dayIndex: number }>;
  path: google.maps.LatLngLiteral[];
  selectedLocationId: LocationId | null;
  onSelectLocation: (locationId: LocationId | null, location: ItineraryLocation | null) => void;
  onHoverChange: (locationId: LocationId | null, position: google.maps.LatLngLiteral | null) => void;
  hoveredLocationId: LocationId | null;
}) {
  const map = useMap();

  // Polyline: use native Google Maps API (not exported by vis.gl for 2D)
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

  // Fit bounds to include all markers (with padding)
  useEffect(() => {
    if (!map || path.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, [map, path]);

  const hoveredPoint = useMemo(
    () => points.find((p) => p.locationId === hoveredLocationId),
    [points, hoveredLocationId]
  );

  return (
    <>
      {points.map(({ location, locationId: id, dayIndex }) => (
        <AdvancedMarker
          key={id}
          position={location.coordinates}
          onClick={() => onSelectLocation(id, location)}
          onMouseEnter={() => onHoverChange(id, location.coordinates)}
          onMouseLeave={() => onHoverChange(null, null)}
        >
          <Pin
            background={selectedLocationId === id ? "#047857" : getPinColor(dayIndex)}
            borderColor={selectedLocationId === id ? "#065f46" : undefined}
            scale={selectedLocationId === id ? 1.2 : 1}
          />
        </AdvancedMarker>
      ))}
      {hoveredPoint && (
        <InfoWindow
          position={hoveredPoint.location.coordinates}
          onCloseClick={() => onHoverChange(null, null)}
        >
          <div className="min-w-0 max-w-[220px] p-1">
            <p className="font-semibold text-slate-900">{hoveredPoint.location.name}</p>
            <p className="text-xs text-slate-600">
              {hoveredPoint.location.time} · {hoveredPoint.location.duration}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
              {hoveredPoint.location.description}
            </p>
            <p className="mt-1 text-xs text-slate-500">{hoveredPoint.location.estimatedCost}</p>
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
  const [hoveredLocationId, setHoveredLocationId] = useState<LocationId | null>(null);

  const points = useMemo(() => flattenLocations(itinerary), [itinerary]);
  const path = useMemo(
    () => points.map((p) => p.location.coordinates),
    [points]
  );
  const center = useMemo(() => {
    if (path.length === 0) return { lat: 0, lng: 0 };
    const lat = path.reduce((s, p) => s + p.lat, 0) / path.length;
    const lng = path.reduce((s, p) => s + p.lng, 0) / path.length;
    return { lat, lng };
  }, [path]);

  const handleHoverChange = useCallback(
    (locationId: LocationId | null, _position: google.maps.LatLngLiteral | null) => {
      setHoveredLocationId(locationId);
    },
    []
  );

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
          onHoverChange={handleHoverChange}
          hoveredLocationId={hoveredLocationId}
        />
      </Map>
    </APIProvider>
  );
}
