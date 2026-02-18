import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pathly – Your AI Travel Planner",
    template: "%s | Pathly",
  },
  description:
    "Plan your perfect trip with AI-powered itineraries. Get day-by-day routes, budgets, and travel styles tailored to you.",
  keywords: ["travel", "itinerary", "AI", "trip planner", "vacation", "route"],
  authors: [{ name: "Pathly" }],
  openGraph: {
    title: "Pathly – Your AI Travel Planner",
    description: "Plan your perfect trip with AI-powered itineraries.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pathly – Your AI Travel Planner",
    description: "Plan your perfect trip with AI-powered itineraries.",
  },
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
