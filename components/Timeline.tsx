"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GenerateRouteResponse, ItineraryDay, ItineraryLocation } from "@/lib/types";
import { formatCurrency, sumLocationCosts, parseCostToNumber } from "@/lib/budget";

export type LocationId = string;

function formatDayTotal(locations: ItineraryLocation[]): string {
  const total = sumLocationCosts(locations);
  return total > 0 ? formatCurrency(total) : "—";
}

function formatCostDisplay(estimatedCost: string): string {
  const n = parseCostToNumber(estimatedCost);
  if (n !== null) return formatCurrency(n);
  return estimatedCost || "—";
}

export interface TimelineProps {
  itinerary: GenerateRouteResponse;
  selectedLocationId: LocationId | null;
  onSelectLocation: (locationId: LocationId | null, location: ItineraryLocation | null) => void;
  /** When true, show remove buttons and allow drag-and-drop reorder */
  editable?: boolean;
  onItineraryChange?: (days: ItineraryDay[]) => void;
}

export function locationId(dayIndex: number, locIndex: number): LocationId {
  return `${dayIndex}-${locIndex}`;
}

export function Timeline({
  itinerary,
  selectedLocationId,
  onSelectLocation,
  editable = false,
  onItineraryChange,
}: TimelineProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() =>
    new Set(itinerary.days.length > 0 ? [0] : [])
  );

  const toggleDay = useCallback((dayIndex: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <ol className="space-y-2 pb-4 pr-2">
          {itinerary.days.map((day, dayIndex) => (
            <DaySection
              key={day.date}
              itinerary={itinerary}
              day={day}
              dayIndex={dayIndex}
              isExpanded={expandedDays.has(dayIndex)}
              onToggle={() => toggleDay(dayIndex)}
              selectedLocationId={selectedLocationId}
              onSelectLocation={onSelectLocation}
              editable={editable}
              onItineraryChange={onItineraryChange}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

interface DaySectionProps {
  itinerary: GenerateRouteResponse;
  day: ItineraryDay;
  dayIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  selectedLocationId: LocationId | null;
  onSelectLocation: (locationId: LocationId | null, location: ItineraryLocation | null) => void;
  editable: boolean;
  onItineraryChange?: (days: ItineraryDay[]) => void;
}

function DaySection({
  itinerary,
  day,
  dayIndex,
  isExpanded,
  onToggle,
  selectedLocationId,
  onSelectLocation,
  editable,
  onItineraryChange,
}: DaySectionProps) {
  const dailyTotalFormatted = formatDayTotal(day.locations);
  const dateLabel = new Date(day.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onItineraryChange) return;
      const oldIndex = day.locations.findIndex((_, i) => String(i) === active.id);
      const newIndex = day.locations.findIndex((_, i) => String(i) === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = [...day.locations];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      const newDays = itinerary.days.map((d, i) =>
        i === dayIndex ? { ...d, locations: next } : d
      );
      onItineraryChange(newDays);
    },
    [day, dayIndex, onItineraryChange]
  );

  const handleRemove = useCallback(
    (locIndex: number) => {
      if (!onItineraryChange) return;
      const next = day.locations.filter((_, i) => i !== locIndex);
      const newDays = itinerary.days.map((d, i) =>
        i === dayIndex ? { ...d, locations: next } : d
      );
      onItineraryChange(newDays);
    },
    [day, dayIndex, itinerary, onItineraryChange]
  );

  const sortableIds = day.locations.map((_, i) => String(i));

  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:px-5"
        aria-expanded={isExpanded}
      >
        <span className="font-semibold text-slate-900 dark:text-white">
          Day {dayIndex + 1}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">{dateLabel}</span>
        <span
          className={`shrink-0 transition-transform duration-200 ease-out ${isExpanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-slate-200 px-4 pb-4 pt-2 dark:border-slate-700 sm:px-5">
            {editable && onItineraryChange ? (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-3">
                    {day.locations.map((loc, locIndex) => (
                      <SortableLocationCard
                        key={locIndex}
                        location={loc}
                        locationId={locationId(dayIndex, locIndex)}
                        isSelected={selectedLocationId === locationId(dayIndex, locIndex)}
                        onSelect={() => onSelectLocation(locationId(dayIndex, locIndex), loc)}
                        onRemove={() => handleRemove(locIndex)}
                        sortableId={String(locIndex)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            ) : (
              <ul className="space-y-3">
                {day.locations.map((loc, locIndex) => (
                  <LocationCard
                    key={locIndex}
                    location={loc}
                    locationId={locationId(dayIndex, locIndex)}
                    isSelected={selectedLocationId === locationId(dayIndex, locIndex)}
                    onSelect={() => onSelectLocation(locationId(dayIndex, locIndex), loc)}
                  />
                ))}
              </ul>
            )}
            <div className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Estimated day total: </span>
              <span className="font-medium text-slate-900 dark:text-white">
                {dailyTotalFormatted}
              </span>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

interface SortableLocationCardProps {
  location: ItineraryLocation;
  locationId: LocationId;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  sortableId: string;
}

function SortableLocationCard({
  location,
  locationId,
  isSelected,
  onSelect,
  onRemove,
  sortableId,
}: SortableLocationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
      <div className="flex gap-2">
        {attributes && listeners && (
          <button
            type="button"
            className="flex shrink-0 touch-none cursor-grab active:cursor-grabbing items-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onSelect}
            data-location-id={locationId}
            className={`w-full rounded-lg border px-3 py-3 text-left transition-all duration-200 sm:px-4 sm:py-3.5 ${
              isSelected
                ? "border-emerald-500 bg-emerald-50 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/40"
                : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {location.time}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {location.duration}
              </span>
            </div>
            <h3 className="mt-1 font-medium text-slate-900 dark:text-white">
              {location.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
              {location.description}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {formatCostDisplay(location.estimatedCost)}
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex shrink-0 items-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          aria-label="Remove location"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </li>
  );
}

interface LocationCardProps {
  location: ItineraryLocation;
  locationId: LocationId;
  isSelected: boolean;
  onSelect: () => void;
}

function LocationCard({ location, locationId, isSelected, onSelect }: LocationCardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        data-location-id={locationId}
        className={`w-full rounded-lg border px-3 py-3 text-left transition-all duration-200 sm:px-4 sm:py-3.5 ${
          isSelected
            ? "border-emerald-500 bg-emerald-50 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/40"
            : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {location.time}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {location.duration}
          </span>
        </div>
        <h3 className="mt-1 font-medium text-slate-900 dark:text-white">
          {location.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
          {location.description}
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {formatCostDisplay(location.estimatedCost)}
        </p>
      </button>
    </li>
  );
}
