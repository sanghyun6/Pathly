import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  GenerateRouteRequestBody,
  ItineraryDay,
  ItineraryLocation,
  ReplanStopRequestBody,
} from "@/lib/types";

const VALID_CATEGORIES = ["food", "attraction", "activity", "transport"] as const;

function isTripRequestBody(value: unknown): value is GenerateRouteRequestBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  const allowedBudget = ["budget", "moderate", "luxury"];
  const allowedStyles = ["sightseeing", "food", "activities", "relaxed"];

  return (
    typeof body.destination === "string" &&
    !!body.destination.trim() &&
    typeof body.startDate === "string" &&
    typeof body.endDate === "string" &&
    typeof body.budget === "string" &&
    allowedBudget.includes(body.budget) &&
    Array.isArray(body.travelStyle) &&
    body.travelStyle.every((style) => typeof style === "string" && allowedStyles.includes(style))
  );
}

function isGenerateRouteResponse(value: unknown): value is ReplanStopRequestBody["itinerary"] {
  if (!value || typeof value !== "object") return false;
  const maybe = value as { days?: unknown };
  return Array.isArray(maybe.days);
}

function buildPrompt(body: ReplanStopRequestBody, targetDay: ItineraryDay, targetLocation: ItineraryLocation): string {
  const dayContext = targetDay.locations
    .map((location, index) => {
      const prefix = index === body.locationIndex ? "[REPLACE THIS STOP]" : "[KEEP]";
      return `${prefix} ${location.time} - ${location.name} (${location.category ?? "uncategorized"}): ${location.description}`;
    })
    .join("\n");

  return `You are revising exactly one stop in an existing travel itinerary.

Trip details:
- Destination: ${body.trip.destination}
- Dates: ${body.trip.startDate} to ${body.trip.endDate}
- Budget: ${body.trip.budget}
- Travel styles: ${body.trip.travelStyle.join(", ")}

Current day plan:
${dayContext}

Stop to replace:
- Current name: ${targetLocation.name}
- Time: ${targetLocation.time}
- Duration: ${targetLocation.duration}
- Category: ${targetLocation.category ?? "unknown"}
- Description: ${targetLocation.description}
- Estimated cost: ${targetLocation.estimatedCost}

Rules:
- Return exactly one replacement stop as valid JSON only.
- Keep the same overall purpose and time slot, but choose a DIFFERENT place or activity from the current stop.
- Keep the response suitable for the same destination, budget, and travel style.
- If the stop is food, coffee, bakery, dessert, drinks, brunch, lunch, or dinner, ALWAYS return a specific real venue name, never a generic label.
- For food and coffee, prefer a direct place name like "Genova Bakery" or "Cafe Name", not phrasing like "Dinner at ..." or "Coffee break at ...".
- Generic names are allowed only for non-venue items like walking, transit, scenic strolls, or hotel rest.
- Use realistic current traveler pricing in USD and avoid underpricing.
- Keep "time" in HH:MM and "duration" in formats like "45 min" or "2 hours".
- Provide approximate real coordinates that match the named place or activity.
- category must be one of: "food", "attraction", "activity", "transport".

Respond with this exact JSON shape:
{
  "location": {
    "name": "Place name",
    "time": "HH:MM",
    "duration": "e.g. 2 hours",
    "description": "Brief description",
    "estimatedCost": 25,
    "category": "food",
    "coordinates": { "lat": number, "lng": number }
  }
}`;
}

function normalizeLocation(loc: Record<string, unknown>): ItineraryLocation {
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
      lat: Number(
        loc.coordinates && typeof loc.coordinates === "object" && "lat" in loc.coordinates
          ? (loc.coordinates as { lat: unknown }).lat
          : 0
      ),
      lng: Number(
        loc.coordinates && typeof loc.coordinates === "object" && "lng" in loc.coordinates
          ? (loc.coordinates as { lng: unknown }).lng
          : 0
      ),
    },
    ...(category ? { category } : {}),
  };
}

function parseJsonFromResponse(text: string): ItineraryLocation {
  let raw = text.trim();
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    raw = codeBlockMatch[1].trim();
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || !("location" in parsed)) {
    throw new Error("Invalid response: missing location");
  }

  const location = (parsed as { location?: unknown }).location;
  if (!location || typeof location !== "object") {
    throw new Error("Invalid response: malformed location");
  }

  return normalizeLocation(location as Record<string, unknown>);
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
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const parsed = body as Partial<ReplanStopRequestBody>;
    if (
      !isTripRequestBody(parsed.trip) ||
      typeof parsed.dayIndex !== "number" ||
      typeof parsed.locationIndex !== "number" ||
      !isGenerateRouteResponse(parsed.itinerary)
    ) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const targetDay = parsed.itinerary.days[parsed.dayIndex];
    const targetLocation = targetDay?.locations?.[parsed.locationIndex];
    if (!targetDay || !targetLocation) {
      return NextResponse.json({ error: "Target stop not found." }, { status: 404 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = buildPrompt(parsed as ReplanStopRequestBody, targetDay, targetLocation);

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No replacement stop generated." }, { status: 502 });
    }

    const location = parseJsonFromResponse(text);
    return NextResponse.json({ location });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.startsWith("Invalid response:")) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    console.error("replan-stop API error:", error);
    return NextResponse.json(
      { error: "Failed to replan this stop. Please try again." },
      { status: 500 }
    );
  }
}
