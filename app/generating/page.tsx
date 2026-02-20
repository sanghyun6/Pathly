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

const PROGRESS_INTERVAL_MS = 2500;
const PROGRESS_STEP = 10;
const PROGRESS_CAP = 95;

function GeneratingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const callApi = useCallback(async () => {
    const body = buildRequestBody(searchParams);
    if (!body) {
      setErrorMessage("Missing or invalid trip details. Please start over from the home page.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setProgress(0);

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
      setProgress(100);
      setTimeout(() => router.replace("/results"), 400);
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

  // Progress bar: step toward 90–95% every 2.5s while loading
  useEffect(() => {
    if (status !== "loading" || progress >= PROGRESS_CAP) return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(p + PROGRESS_STEP, PROGRESS_CAP));
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, progress]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] bg-gradient-to-b from-white via-[#F8F9FA] to-slate-100/80 px-4">
      <div className="w-full max-w-md text-center">
        {status === "loading" && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">
              AI is planning your perfect trip...
            </h1>
            <p className="mt-3 text-slate-600 transition-opacity duration-300">
              {LOADING_MESSAGES[messageIndex]}
            </p>
            <div className="mt-12 w-full">
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}

        {status === "error" && (
          <div className="rounded-2xl bg-white p-8 shadow-lg shadow-slate-200/50">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <span className="text-2xl" aria-hidden>
                ✕
              </span>
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              Couldn&apos;t generate your route
            </h1>
            <p className="mt-2 text-slate-600">{errorMessage}</p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={callApi}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
              >
                Try again
              </button>
              <Link
                href="/"
                className="block w-full rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] px-4">
      <p className="text-slate-600">Loading...</p>
      <div className="mt-6 h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-0 rounded-full bg-emerald-500" />
      </div>
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
