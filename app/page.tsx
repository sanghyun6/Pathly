"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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

const BUDGET_CARDS: {
  value: BudgetOption;
  icon: string;
  title: string;
  description: string;
  selectedClass: string;
  borderClass: string;
}[] = [
  {
    value: "budget",
    icon: "💰",
    title: "Save",
    description: "Keep costs low",
    selectedClass: "bg-emerald-50 border-emerald-400 shadow-emerald-200/60",
    borderClass: "border-emerald-300",
  },
  {
    value: "moderate",
    icon: "💳",
    title: "Balance",
    description: "Mix of value and comfort",
    selectedClass: "bg-blue-50 border-blue-400 shadow-blue-200/60",
    borderClass: "border-blue-300",
  },
  {
    value: "luxury",
    icon: "💎",
    title: "Splurge",
    description: "Premium experience",
    selectedClass: "bg-violet-50 border-violet-400 shadow-violet-200/60",
    borderClass: "border-violet-300",
  },
];

const TRAVEL_STYLE_CHIPS: { value: TravelStyleOption; icon: string; label: string }[] = [
  { value: "sightseeing", icon: "🏛️", label: "Sightseeing" },
  { value: "food", icon: "🍴", label: "Food" },
  { value: "activities", icon: "🎯", label: "Activities" },
  { value: "relaxed", icon: "😌", label: "Relaxed" },
];

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};
  const trimmedDestination = data.destination.trim();
  if (!trimmedDestination) errors.destination = "Please enter a destination city.";
  if (!data.startDate) errors.startDate = "Please select a start date.";
  if (!data.endDate) errors.endDate = "Please select an end date.";
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.endDate = "End date must be on or after start date.";
  }
  if (!data.budget) errors.budget = "Please select a budget option.";
  if (data.travelStyles.length === 0) errors.travelStyles = "Please select at least one travel style.";
  return errors;
}

function toDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toDateString(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
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
      if (Object.keys(validationErrors).length > 0) return;
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

  const startDateObj = toDate(formData.startDate);
  const endDateObj = toDate(formData.endDate);
  const minEndDate = startDateObj || undefined;

  return (
    <div className="min-h-screen bg-[#F8F9FA] bg-gradient-to-b from-white via-[#F8F9FA] to-slate-100/80">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
        <header className="text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl shadow-sm">
            ✈️
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Pathly
          </h1>
          <p className="mt-2 text-lg text-slate-500 sm:text-xl">
            Your AI Travel Planner
          </p>
        </header>

        <main className="mt-8 sm:mt-10">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/60 transition-shadow duration-200 hover:shadow-xl sm:p-8"
          >
            <div className="space-y-8">
              {/* Destination */}
              <section>
                <label htmlFor="destination" className="block text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Destination city
                </label>
                <input
                  id="destination"
                  type="text"
                  placeholder="e.g. Paris, Tokyo"
                  value={formData.destination}
                  onChange={(e) => updateField("destination", e.target.value)}
                  className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder-slate-400 transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  aria-invalid={!!errors.destination}
                  aria-describedby={errors.destination ? "destination-error" : undefined}
                />
                {errors.destination && (
                  <p id="destination-error" className="mt-1.5 text-sm text-red-500">
                    {errors.destination}
                  </p>
                )}
              </section>

              {/* Dates */}
              <section>
                <span className="block text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Travel dates
                </span>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="startDate" className="mb-1.5 block text-xs font-medium text-slate-500">
                      Start date
                    </label>
                    <DatePicker
                      id="startDate"
                      selected={startDateObj}
                      onChange={(d) => updateField("startDate", toDateString(d))}
                      placeholderText="Select start date"
                      dateFormat="MMM d, yyyy"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                      calendarClassName="pathly-datepicker"
                      wrapperClassName="w-full"
                    />
                    {errors.startDate && (
                      <p className="mt-1.5 text-sm text-red-500">{errors.startDate}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="endDate" className="mb-1.5 block text-xs font-medium text-slate-500">
                      End date
                    </label>
                    <DatePicker
                      id="endDate"
                      selected={endDateObj}
                      onChange={(d) => updateField("endDate", toDateString(d))}
                      minDate={minEndDate}
                      placeholderText="Select end date"
                      dateFormat="MMM d, yyyy"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                      calendarClassName="pathly-datepicker"
                      wrapperClassName="w-full"
                    />
                    {errors.endDate && (
                      <p className="mt-1.5 text-sm text-red-500">{errors.endDate}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Budget cards */}
              <section>
                <span className="block text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Budget
                </span>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {BUDGET_CARDS.map((card) => {
                    const isSelected = formData.budget === card.value;
                    return (
                      <button
                        key={card.value}
                        type="button"
                        onClick={() => updateField("budget", card.value)}
                        className={`flex flex-col items-center rounded-xl border-2 px-4 py-4 text-left transition-all duration-200 hover:shadow-md ${
                          isSelected
                            ? `${card.selectedClass} border-2 shadow-md`
                            : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/80"
                        }`}
                      >
                        <span className="text-2xl" aria-hidden>{card.icon}</span>
                        <span className="mt-2 font-semibold text-slate-900">{card.title}</span>
                        <span className="mt-0.5 text-xs text-slate-500">{card.description}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.budget && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.budget}</p>
                )}
              </section>

              {/* Travel style chips */}
              <section>
                <span className="block text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Travel style
                </span>
                <p className="mt-1 text-xs text-slate-500">Select one or more</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TRAVEL_STYLE_CHIPS.map((chip) => {
                    const isSelected = formData.travelStyles.includes(chip.value);
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => toggleTravelStyle(chip.value)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isSelected
                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                        }`}
                      >
                        <span aria-hidden>{chip.icon}</span>
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                {errors.travelStyles && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.travelStyles}</p>
                )}
              </section>
            </div>

            <div className="mt-10">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
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
