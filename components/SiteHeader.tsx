// components/SiteHeader.tsx
import Link from "next/link";
import { cn } from "@/lib/cn";
import { TopTabs } from "@/components/TopTabs";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full overflow-hidden border-b border-white/10 bg-black/25 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-wide text-white/90">
            Alignment Travel
          </span>

          <span className="hidden md:inline-flex ui-chip text-[11px] font-semibold text-white/60">
            decision intelligence
          </span>
        </Link>

        {/* Desktop tabs: unchanged */}
        <div className="hidden md:block">
          <TopTabs />
        </div>

        {/* Mobile quick-start button */}
        <Link
          href="/configure/profile"
          className={cn(
            "md:hidden ui-btn ui-btn-accent shrink-0 rounded-xl px-4 py-2 text-sm font-semibold"
          )}
        >
          Start
        </Link>
      </div>

      {/* Mobile tabs: visible, clickable, horizontally scrollable */}
      <div className="border-t border-white/10 md:hidden">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TopTabs className="min-w-max flex-nowrap" />
        </div>
      </div>
    </header>
  );
}