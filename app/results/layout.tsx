import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Itinerary",
  description: "View and edit your Pathly travel itinerary. Export as PDF, optimize your route, and explore each location.",
  robots: "noindex, follow",
};

export default function ResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen transition-opacity duration-200 ease-out">
      {children}
    </div>
  );
}
