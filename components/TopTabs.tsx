// components/TopTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/", label: "Home" },
  { href: "/setup", label: "Setup" },
  { href: "/results", label: "Results" },
  { href: "/philosophy", label: "Philosophy" },
  { href: "/methodology", label: "Methodology" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function TopTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-wrap items-center gap-2", className)} aria-label="Primary">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);

        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "ui-btn rounded-full border px-3 py-1.5 text-xs font-semibold transition select-none",
              active
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white/90 hover:bg-black/25"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}