"use client";

import { useState, useCallback } from "react";
import generatePDF from "react-to-pdf";

export interface ExportButtonProps {
  /** Ref attached to the element to capture as PDF */
  targetRef: React.RefObject<HTMLElement | null>;
  filename?: string;
  /** Called when share link is requested (e.g. copy URL or native share) */
  onShare?: () => void;
  className?: string;
}

export function ExportButton({
  targetRef,
  filename = "pathly-itinerary.pdf",
  onShare,
  className = "",
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"idle" | "copied" | "shared">("idle");

  const handleExportPDF = useCallback(async () => {
    if (!targetRef?.current) return;
    setIsExporting(true);
    try {
      await generatePDF(targetRef, {
        filename,
        method: "save",
        resolution: 2,
        page: { margin: 10 },
      });
    } finally {
      setIsExporting(false);
    }
  }, [targetRef, filename]);

  const handleShare = useCallback(async () => {
    if (onShare) {
      onShare();
      return;
    }
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share && navigator.canShare?.({ url })) {
        await navigator.share({
          title: "My Pathly Itinerary",
          url,
          text: "Check out my trip itinerary planned with Pathly",
        });
        setShareFeedback("shared");
        setTimeout(() => setShareFeedback("idle"), 2000);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareFeedback("copied");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareFeedback("copied");
      } catch {
        setShareFeedback("idle");
      }
      setTimeout(() => setShareFeedback("idle"), 2000);
      return;
    }
    setTimeout(() => setShareFeedback("idle"), 2000);
  }, [onShare]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleExportPDF}
        disabled={isExporting}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        {isExporting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-500 dark:border-t-slate-300" />
            <span className="sr-only sm:not-sr-only">Exporting…</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export PDF</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <span>
          {shareFeedback === "copied" ? "Link copied!" : shareFeedback === "shared" ? "Shared!" : "Share link"}
        </span>
      </button>
    </div>
  );
}
