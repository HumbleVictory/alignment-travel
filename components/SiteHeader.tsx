// components/SiteHeader.tsx
import Link from "next/link";
import { cn } from "@/lib/cn";
import { TopTabs } from "@/components/TopTabs";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/25 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-white/90">Alignment Travel</span>
          <span className="hidden md:inline-flex ui-chip text-[11px] font-semibold text-white/60">
            decision intelligence
          </span>
        </Link>

        <div className="hidden md:block">
          <TopTabs />
        </div>

        <Link
          href="/configure/profile"
          className={cn("md:hidden ui-btn ui-btn-accent rounded-xl px-4 py-2 text-sm font-semibold")}
        >
          Start
        </Link>
      </div>
    </header>
  );
}