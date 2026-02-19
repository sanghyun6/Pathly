"use client";

import { useState } from "react";
import type { GenerateRouteResponse } from "@/lib/types";
import { sumTripCosts, sumCostsByCategory, formatCurrency } from "@/lib/budget";

export interface TripBudgetSummaryProps {
  itinerary: GenerateRouteResponse;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food & dining",
  attraction: "Attractions",
  activity: "Activities",
  transport: "Transport",
  other: "Other",
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-in-out ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function TripBudgetSummary({ itinerary, className = "" }: TripBudgetSummaryProps) {
  const [expanded, setExpanded] = useState(true);
  const total = sumTripCosts(itinerary);
  const byCategory = sumCostsByCategory(itinerary);
  const hasBreakdown = Object.entries(byCategory).some(([k, v]) => k !== "other" && v > 0);

  return (
    <section
      className={`rounded-xl bg-slate-100/80 shadow-sm ${className}`}
      aria-label="Trip budget summary"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 py-2.5 pr-2 pl-3 text-left sm:pl-4"
        aria-expanded={expanded}
        aria-controls="trip-cost-breakdown"
      >
        <span className="text-sm font-medium text-slate-600">
          Trip cost
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-700">
          <ChevronIcon open={expanded} />
        </span>
      </button>
      <div
        id="trip-cost-breakdown"
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`border-t border-slate-200/80 px-3 pb-3 pt-2 transition-opacity duration-300 ease-in-out sm:px-4 sm:pb-4 sm:pt-3 ${expanded ? "opacity-100" : "opacity-0"}`}
          >
            <p className="text-xl font-bold text-slate-900 sm:text-2xl">
              {total > 0 ? formatCurrency(total) : "—"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Total for {itinerary.days.length} day{itinerary.days.length === 1 ? "" : "s"}
            </p>
            {hasBreakdown && (
              <dl className="mt-3 space-y-2">
                {(["food", "attraction", "activity", "transport", "other"] as const).map((key) => {
                  const value = byCategory[key] ?? 0;
                  if (value <= 0) return null;
                  return (
                    <div key={key} className="flex justify-between text-sm">
                      <dt className="text-slate-600">
                        {CATEGORY_LABELS[key] ?? key}
                      </dt>
                      <dd className="font-medium text-slate-900">
                        {formatCurrency(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
