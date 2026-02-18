"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { GenerateRouteResponse } from "@/lib/types";

const LOADING_MESSAGES = [
  "Checking the best spots in town...",
  "Mapping out hidden gems...",
  "Finding the perfect food stops...",
  "Calculating the ideal route...",
  "Adding a pinch of local flavor...",
  "Booking imaginary tickets...",
  "Asking the locals (virtually)...",
  "Avoiding the tourist traps...",
  "Scheduling coffee breaks...",
  "Making every hour count...",
];

const STORAGE_KEY = "pathly-route-result";

function buildRequestBody(searchParams: URLSearchParams) {
  const destination = searchParams.get("destination");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const budget = searchParams.get("budget");
  const travelStyle = searchParams.get("travelStyle");
  if (!destination?.trim() || !startDate || !endDate || !budget) return null;
  const styles = travelStyle
    ? travelStyle.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const allowedStyles = ["sightseeing", "food", "activities", "relaxed"];
  const travelStyleArray = styles.filter((s) => allowedStyles.includes(s));
  if (travelStyleArray.length === 0) return null;
  const allowedBudget = ["budget", "moderate", "luxury"];
  if (!allowedBudget.includes(budget)) return null;
  return {
    destination: destination.trim(),
    startDate,
    endDate,
    budget: budget as "budget" | "moderate" | "luxury",
    travelStyle: travelStyleArray as ("sightseeing" | "food" | "activities" | "relaxed")[],
  };
}

function GeneratingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [messageIndex, setMessageIndex] = useState(0);

  const callApi = useCallback(async () => {
    const body = buildRequestBody(searchParams);
    if (!body) {
      setErrorMessage("Missing or invalid trip details. Please start over from the home page.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      const result = data as GenerateRouteResponse;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      }
      router.replace("/results");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }, [searchParams, router]);

  useEffect(() => {
    callApi();
  }, [callApi]);

  // Rotate loading message every 2.5s
  useEffect(() => {
    if (status !== "loading") return;
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(id);
  }, [status]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md text-center">
        {status === "loading" && (
          <>
            <div
              className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-400"
            />
            <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-white">
              AI is planning your perfect trip...
            </h1>
            <p className="mt-3 text-slate-600 dark:text-slate-400 transition-opacity duration-300">
              {LOADING_MESSAGES[messageIndex]}
            </p>
            <div className="mt-10 flex flex-col gap-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full w-[30%] rounded-full bg-emerald-500 dark:bg-emerald-400"
                  style={{ animation: "generating-pulse 1.5s ease-in-out infinite" }}
                />
              </div>
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400"
                    style={{
                      animation: "generating-bounce 0.6s ease-in-out infinite",
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <span className="text-2xl" aria-hidden>
                ✕
              </span>
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
              Couldn&apos;t generate your route
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{errorMessage}</p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={callApi}
                className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                Try again
              </button>
              <Link
                href="/"
                className="block w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Back to planner
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratingFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 dark:from-slate-950 dark:to-slate-900">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-400" />
      <p className="mt-6 text-slate-600 dark:text-slate-400">Loading...</p>
    </div>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense fallback={<GeneratingFallback />}>
      <GeneratingContent />
    </Suspense>
  );
}
