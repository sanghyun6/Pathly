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

function buildPrompt(body: GenerateRouteRequestBody): string {
  const numDays = getNumberOfDays(body.startDate, body.endDate);
  const budgetDesc = BUDGET_DESCRIPTIONS[body.budget] ?? BUDGET_DESCRIPTIONS.moderate;
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

**Rules:**
- Plan realistic timing: include travel time between locations. Use "duration" for how long to spend at each place and space activities so they don't overlap.
- Respect the budget: suggest places and estimated costs that match the budget level (use local currency or USD for estimatedCost).
- For each day, list locations in chronological order (morning to evening).
- Use approximate real coordinates (lat/lng) for well-known places in ${body.destination}; you may estimate if needed.
- "time" should be like "09:00", "14:30". "duration" should be like "2 hours", "45 min".

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
          "estimatedCost": "e.g. $20 or Free",
          "coordinates": { "lat": number, "lng": number }
        }
      ]
    }
  ]
}

Generate the itinerary now.`;
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
  const days = (parsed as { days: unknown }).days as ItineraryDay[];
  for (const day of days) {
    if (!day.date || !Array.isArray(day.locations)) {
      throw new Error("Invalid response: each day must have date and locations array");
    }
    for (const loc of day.locations) {
      if (
        typeof loc.name !== "string" ||
        typeof loc.time !== "string" ||
        typeof loc.duration !== "string" ||
        typeof loc.description !== "string" ||
        typeof loc.estimatedCost !== "string" ||
        !loc.coordinates ||
        typeof loc.coordinates.lat !== "number" ||
        typeof loc.coordinates.lng !== "number"
      ) {
        throw new Error("Invalid response: each location must have name, time, duration, description, estimatedCost, coordinates{lat,lng}");
      }
    }
  }
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
