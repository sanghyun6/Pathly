"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type BudgetOption = "budget" | "moderate" | "luxury";
type TravelStyleOption = "sightseeing" | "food" | "activities" | "relaxed";

interface FormData {
  destination: string;
  startDate: string;
  endDate: string;
  budget: BudgetOption | "";
  travelStyles: TravelStyleOption[];
}

interface FormErrors {
  destination?: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  travelStyles?: string;
}

const BUDGET_OPTIONS: { value: BudgetOption; label: string }[] = [
  { value: "budget", label: "Budget" },
  { value: "moderate", label: "Moderate" },
  { value: "luxury", label: "Luxury" },
];

const TRAVEL_STYLE_OPTIONS: { value: TravelStyleOption; label: string }[] = [
  { value: "sightseeing", label: "Sightseeing" },
  { value: "food", label: "Food" },
  { value: "activities", label: "Activities" },
  { value: "relaxed", label: "Relaxed" },
];

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};

  const trimmedDestination = data.destination.trim();
  if (!trimmedDestination) {
    errors.destination = "Please enter a destination city.";
  }

  if (!data.startDate) {
    errors.startDate = "Please select a start date.";
  }

  if (!data.endDate) {
    errors.endDate = "Please select an end date.";
  }

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.endDate = "End date must be on or after start date.";
  }

  if (!data.budget) {
    errors.budget = "Please select a budget option.";
  }

  if (data.travelStyles.length === 0) {
    errors.travelStyles = "Please select at least one travel style.";
  }

  return errors;
}

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    destination: "",
    startDate: "",
    endDate: "",
    budget: "",
    travelStyles: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback(<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field as keyof FormErrors]: undefined }));
  }, []);

  const toggleTravelStyle = useCallback((value: TravelStyleOption) => {
    setFormData((prev) => ({
      ...prev,
      travelStyles: prev.travelStyles.includes(value)
        ? prev.travelStyles.filter((s) => s !== value)
        : [...prev.travelStyles, value],
    }));
    setErrors((prev) => ({ ...prev, travelStyles: undefined }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors = validateForm(formData);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      setIsSubmitting(true);
      const params = new URLSearchParams({
        destination: formData.destination.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        budget: formData.budget,
        travelStyle: formData.travelStyles.join(","),
      });
      router.push(`/generating?${params.toString()}`);
    },
    [formData, router]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        {/* Hero */}
        <header className="text-center transition-opacity duration-300">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Pathly
          </h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
            Your AI Travel Planner
          </p>
        </header>

        {/* Form card */}
        <main className="mt-8 sm:mt-10">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 sm:p-8"
          >
            <div className="space-y-6">
              {/* Destination */}
              <div>
                <label
                  htmlFor="destination"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Destination city
                </label>
                <input
                  id="destination"
                  type="text"
                  placeholder="e.g. Paris, Tokyo"
                  value={formData.destination}
                  onChange={(e) => updateField("destination", e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                  aria-invalid={!!errors.destination}
                  aria-describedby={errors.destination ? "destination-error" : undefined}
                />
                {errors.destination && (
                  <p id="destination-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.destination}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="startDate"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Start date
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateField("startDate", e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    aria-invalid={!!errors.startDate}
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.startDate}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="endDate"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    End date
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => updateField("endDate", e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    aria-invalid={!!errors.endDate}
                  />
                  {errors.endDate && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.endDate}
                    </p>
                  )}
                </div>
              </div>

              {/* Budget */}
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Budget
                </span>
                <div className="mt-2 flex flex-wrap gap-4">
                  {BUDGET_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-90"
                    >
                      <input
                        type="radio"
                        name="budget"
                        value={value}
                        checked={formData.budget === value}
                        onChange={() => updateField("budget", value)}
                        className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.budget && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.budget}
                  </p>
                )}
              </div>

              {/* Travel style */}
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Travel style
                </span>
                <div className="mt-2 flex flex-wrap gap-4">
                  {TRAVEL_STYLE_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-90"
                    >
                      <input
                        type="checkbox"
                        value={value}
                        checked={formData.travelStyles.includes(value)}
                        onChange={() => toggleTravelStyle(value)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.travelStyles && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.travelStyles}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                {isSubmitting ? "Taking you to planner…" : "Generate My Route"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
