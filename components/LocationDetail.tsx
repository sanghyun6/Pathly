"use client";

import { useEffect } from "react";
import type { ItineraryLocation } from "@/lib/types";
import { parseCostToNumber, formatCurrency } from "@/lib/budget";

function formatCostDisplay(estimatedCost: string): string {
  const n = parseCostToNumber(estimatedCost);
  if (n !== null) return formatCurrency(n);
  return estimatedCost || "—";
}

function getGoogleMapsHref(location: ItineraryLocation): string {
  const { lat, lng } = location.coordinates;
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

  if (hasCoordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name} ${lat},${lng}`)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name)}`;
}

export interface LocationDetailProps {
  location: ItineraryLocation | null;
  onClose: () => void;
  open: boolean;
}

export function LocationDetail({ location, onClose, open }: LocationDetailProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-detail-title"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl shadow-slate-200/50 transition-transform duration-300 ease-out sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        style={{
          transform: open ? "translateY(0)" : "translateY(100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-[85vh] flex-col sm:max-h-[90vh]">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
            <h2 id="location-detail-title" className="text-lg font-semibold text-slate-900">
              {location?.name ?? "Location"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-safe">
            {location ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-emerald-600">
                    {location.time} · {location.duration}
                  </p>
                  <p className="mt-1 text-slate-600">{location.description}</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {formatCostDisplay(location.estimatedCost)}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Map
                  </h3>
                  <a
                    href={getGoogleMapsHref(location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline"
                  >
                    Open in Google Maps
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No location selected.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
