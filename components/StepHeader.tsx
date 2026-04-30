// components/StepHeader.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Step = {
  key: string;
  label: string;
  href: string;
};

const STEPS: Step[] = [
  { key: "profile", label: "Profile", href: "/profile" },
  { key: "setup", label: "Setup", href: "/setup" },
  { key: "outcomes", label: "Outcomes", href: "/results" },
];

function stepIndexFromPath(pathname: string) {
  if (pathname.startsWith("/profile")) return 0;
  if (pathname.startsWith("/setup")) return 1;
  if (pathname.startsWith("/results")) return 2;
  return -1;
}

export function StepHeader({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const activeIdx = stepIndexFromPath(pathname);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs font-semibold tracking-wide text-white/55">
          {activeIdx >= 0 ? `Step ${activeIdx + 1} of ${STEPS.length}` : "Configurator"}
        </div>
        {!compact ? (
          <div className="text-[11px] text-white/45">
            One action per screen. Details stay optional.
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {STEPS.map((s, idx) => {
          const done = activeIdx > idx;
          const active = activeIdx === idx;

          return (
            <div
              key={s.key}
              className={cn(
                "rounded-2xl border px-3 py-2",
                "bg-white/[0.03] backdrop-blur",
                active ? "border-emerald-400/25" : "border-white/10"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-white/85">
                  {s.label}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    active
                      ? "text-emerald-200"
                      : done
                      ? "text-white/55"
                      : "text-white/35"
                  )}
                >
                  {active ? "Current" : done ? "Done" : "Next"}
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    active ? "bg-emerald-400/70" : done ? "bg-white/35" : "bg-white/10"
                  )}
                  style={{ width: done ? "100%" : active ? "60%" : "15%" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}