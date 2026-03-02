// components/SiteHeader.tsx
import Link from "next/link";
import { cn } from "@/lib/cn";
import { TopTabs } from "@/components/TopTabs";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/25 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/90 text-sm font-extrabold text-emerald-950 shadow-[0_8px_22px_rgba(16,185,129,0.18)]">
            A
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/90">Alignment Travel</span>
          <span className="hidden md:inline-flex ui-chip text-[11px] font-semibold text-white/60">
            decision intelligence
          </span>
        </Link>

        {/* Desktop tabs */}
        <div className="hidden md:block">
          <TopTabs />
        </div>

        {/* Mobile: show Start as primary, tabs still accessible via page content (optional) */}
        <Link
          href="/setup"
          className={cn("md:hidden ui-btn ui-btn-accent rounded-xl px-4 py-2 text-sm font-semibold")}
        >
          Start
        </Link>
      </div>

      {/* Optional: show tabs on mobile too (uncomment if you want) */}
      {/* 
      <div className="md:hidden border-t border-white/10 px-6 pb-3 pt-3">
        <TopTabs />
      </div> 
      */}
    </header>
  );
}