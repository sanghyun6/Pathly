import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  GenerateRouteRequestBody,
  GenerateRouteResponse,
  ItineraryDay,
  ItineraryLocation,
} from "@/lib/types";

const BUDGET_DESCRIPTIONS: Record<string, string> = {
  budget: "Budget-conscious: prioritize free/cheap attractions, street food, hostels, and public transport.",
  moderate: "Moderate: mix of mid-range restaurants, comfortable hotels, and a balance of free and paid experiences.",
  luxury: "Luxury: high-end dining, premium hotels, private experiences, and top-tier attractions.",
};

function getNumberOfDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
}

const BUDGET_COST_RULES: Record<string, string> = {
  budget:
    "Budget: each location estimatedCost must be a NUMBER in USD between 0 and 30. Use 0 for free entries. Meals/street food ~5-15, attractions ~0-15, activities ~10-25, transport ~2-10. Adjust for destination (e.g. Tokyo slightly higher, Bangkok lower).",
  moderate:
    "Moderate: each estimatedCost must be a NUMBER in USD between 0 and 100. Meals ~15-50, attractions ~10-30, activities ~25-75, transport ~5-25. Vary by destination cost of living.",
  luxury:
    "Luxury: each estimatedCost must be a NUMBER in USD, typically 50-300+ per location. Fine dining ~80-200, premium attractions ~30-80, private experiences ~100-300, transport ~25-100.",
};

function buildPrompt(body: GenerateRouteRequestBody): string {
  const numDays = getNumberOfDays(body.startDate, body.endDate);
  const budgetDesc = BUDGET_DESCRIPTIONS[body.budget] ?? BUDGET_DESCRIPTIONS.moderate;
  const costRules = BUDGET_COST_RULES[body.budget] ?? BUDGET_COST_RULES.moderate;
  const travelStyles = body.travelStyle.length
    ? body.travelStyle.join(", ")
    : "general sightseeing";

  return `You are an expert travel planner. Create a day-by-day itinerary for a trip.

**Destination:** ${body.destination}
**Start date:** ${body.startDate}
**End date:** ${body.endDate}
**Number of days:** ${numDays}
**Budget level:** ${body.budget}. ${budgetDesc}
**Travel style preferences:** ${travelStyles}

**Cost rules (IMPORTANT):**
- ${costRules}
- estimatedCost must be a NUMBER only (e.g. 25 for $25), not a string like "$25". Use 0 for free.
- Consider destination: ${body.destination} has its own cost level—adjust numbers realistically.
- Assign each location a "category": exactly one of "food", "attraction", "activity", "transport" for budget breakdown.

**Other rules:**
- Plan realistic timing: include travel time between locations. Use "duration" for how long to spend at each place.
- For each day, list locations in chronological order (morning to evening).
- Use approximate real coordinates (lat/lng) for well-known places in ${body.destination}.
- "time" format: "09:00", "14:30". "duration" format: "2 hours", "45 min".

Respond with ONLY a single valid JSON object, no markdown or explanation. Use this exact structure:

{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "locations": [
        {
          "name": "Place name",
          "time": "HH:MM",
          "duration": "e.g. 2 hours",
          "description": "Brief description",
          "estimatedCost": 25,
          "category": "food",
          "coordinates": { "lat": number, "lng": number }
        }
      ]
    }
  ]
}

Generate the itinerary now.`;
}

const VALID_CATEGORIES = ["food", "attraction", "activity", "transport"] as const;

function normalizeLocation(loc: Record<string, unknown>): ItineraryDay["locations"][0] {
  const estimatedCost = loc.estimatedCost;
  const costStr =
    typeof estimatedCost === "number"
      ? String(estimatedCost)
      : typeof estimatedCost === "string"
        ? estimatedCost
        : "0";
  const category =
    typeof loc.category === "string" && VALID_CATEGORIES.includes(loc.category as (typeof VALID_CATEGORIES)[number])
      ? (loc.category as (typeof VALID_CATEGORIES)[number])
      : undefined;
  return {
    name: String(loc.name ?? ""),
    time: String(loc.time ?? ""),
    duration: String(loc.duration ?? ""),
    description: String(loc.description ?? ""),
    estimatedCost: costStr,
    coordinates: {
      lat: Number(loc.coordinates && typeof loc.coordinates === "object" && "lat" in loc.coordinates ? (loc.coordinates as { lat: unknown }).lat : 0),
      lng: Number(loc.coordinates && typeof loc.coordinates === "object" && "lng" in loc.coordinates ? (loc.coordinates as { lng: unknown }).lng : 0),
    },
    ...(category ? { category } : {}),
  };
}

function parseJsonFromResponse(text: string): GenerateRouteResponse {
  let raw = text.trim();
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    raw = codeBlockMatch[1].trim();
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { days?: unknown }).days)) {
    throw new Error("Invalid response: missing days array");
  }
  const rawDays = (parsed as { days: unknown[] }).days;
  const days: ItineraryDay[] = rawDays.map((day: unknown) => {
    if (!day || typeof day !== "object" || !Array.isArray((day as { locations?: unknown }).locations)) {
      throw new Error("Invalid response: each day must have date and locations array");
    }
    const d = day as { date?: unknown; locations: unknown[] };
    return {
      date: String(d.date ?? ""),
      locations: d.locations.map((loc) => normalizeLocation(loc as Record<string, unknown>)),
    };
  });
  return { days };
}

function validateBody(body: unknown): body is GenerateRouteRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.destination !== "string" || !b.destination.trim()) return false;
  if (typeof b.startDate !== "string" || !b.startDate) return false;
  if (typeof b.endDate !== "string" || !b.endDate) return false;
  const budget = b.budget as string | undefined;
  if (!budget || !["budget", "moderate", "luxury"].includes(budget)) return false;
  if (!Array.isArray(b.travelStyle)) return false;
  const allowed = ["sightseeing", "food", "activities", "relaxed"];
  if (!(b.travelStyle as unknown[]).every((s) => typeof s === "string" && allowed.includes(s))) return false;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "Server configuration error: GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    if (!validateBody(body)) {
      return NextResponse.json(
        {
          error:
            "Invalid request. Required: destination (string), startDate, endDate (YYYY-MM-DD), budget (budget|moderate|luxury), travelStyle (array of sightseeing|food|activities|relaxed).",
        },
        { status: 400 }
      );
    }

    if (new Date(body.endDate) < new Date(body.startDate)) {
      return NextResponse.json(
        { error: "End date must be on or after start date." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = buildPrompt(body);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "No itinerary generated. Please try again." },
        { status: 502 }
      );
    }

    const itinerary = parseJsonFromResponse(text);
    return NextResponse.json(itinerary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("Invalid response:")) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    if (message.includes("API key") || message.includes("429") || message.includes("403")) {
      return NextResponse.json(
        { error: "Gemini API error. Check your API key and quota." },
        { status: 502 }
      );
    }
    console.error("generate-route API error:", err);
    return NextResponse.json(
      { error: "Failed to generate itinerary. Please try again." },
      { status: 500 }
    );
  }
}
