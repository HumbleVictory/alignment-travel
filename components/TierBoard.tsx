// components/TierBoard.tsx
"use client";

import type { ScoredCity } from "@/lib/scoring";

const TIER_ORDER: Array<ScoredCity["tier"]> = ["S", "A", "B", "C", "D"];

const TIER_META: Record<
  ScoredCity["tier"],
  {
    label: string;
    subtitle: string;
    accentBar: string;
    tierPillBg: string;
    tierPillText: string;
    railTint: string;
  }
> = {
  S: {
    label: "S",
    subtitle: "Best-in-class",
    accentBar: "bg-neutral-100",
    tierPillBg: "bg-neutral-100",
    tierPillText: "text-neutral-950",
    railTint: "bg-neutral-100/15",
  },
  A: {
    label: "A",
    subtitle: "Strong picks",
    accentBar: "bg-neutral-200",
    tierPillBg: "bg-neutral-200",
    tierPillText: "text-neutral-950",
    railTint: "bg-neutral-200/15",
  },
  B: {
    label: "B",
    subtitle: "Solid value",
    accentBar: "bg-neutral-300",
    tierPillBg: "bg-neutral-300",
    tierPillText: "text-neutral-950",
    railTint: "bg-neutral-300/15",
  },
  C: {
    label: "C",
    subtitle: "Tradeoffs",
    accentBar: "bg-neutral-400",
    tierPillBg: "bg-neutral-400",
    tierPillText: "text-neutral-950",
    railTint: "bg-neutral-400/15",
  },
  D: {
    label: "D",
    subtitle: "Low fit",
    accentBar: "bg-neutral-500",
    tierPillBg: "bg-neutral-500",
    tierPillText: "text-neutral-950",
    railTint: "bg-neutral-500/15",
  },
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function BudgetBadge({
  status,
  deltaUsd,
}: {
  status: "under" | "within" | "over" | "unknown";
  deltaUsd: number | null;
}) {
  if (status === "unknown") return null;

  const isOver = status === "over";
  const isWithin = status === "within";

  const label = isWithin ? "Within budget" : isOver ? "Over budget" : "Under budget";

  const num =
    typeof deltaUsd === "number" && Number.isFinite(deltaUsd)
      ? Math.round(Math.abs(deltaUsd))
      : null;

  const sub =
    num == null ? "" : isWithin ? `±$${num}` : `${isOver ? "+" : "-"}$${num}`;

  return (
    <span
      className={cx(
        "ui-btn pointer-events-none rounded-full px-2.5 py-1 text-xs font-semibold",
        isWithin && "bg-white/10 text-white",
        isOver && "bg-rose-400/15 text-rose-100",
        !isOver && !isWithin && "bg-emerald-400/15 text-emerald-100"
      )}
      title={label}
    >
      {label}
      {sub ? <span className="ml-1 opacity-70">{sub}</span> : null}
    </span>
  );
}

export function TierBoard({
  tiers,
  pinnedIds,
  onSelect,
  onTogglePin,
  selectedId,
}: {
  tiers: Record<ScoredCity["tier"], ScoredCity[]>;
  pinnedIds: string[];
  onSelect: (cityId: string) => void;
  onTogglePin?: (cityId: string) => void;
  selectedId?: string | null;
}) {
  return (
    <div className="space-y-4">
      {TIER_ORDER.map((tier) => {
        const list = tiers[tier] ?? [];
        if (!list.length) return null;

        const meta = TIER_META[tier];

        return (
          <section key={tier} className="paper-muted rounded-2xl border paper-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className={cx("h-8 w-1.5 rounded-full", meta.accentBar)} />
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "rounded-full px-3 py-1 text-sm font-semibold",
                    meta.tierPillBg,
                    meta.tierPillText
                  )}
                >
                  {meta.label}
                </span>
                <span className="text-sm text-white/70">{meta.subtitle}</span>
              </div>
              <div className="ml-auto text-xs text-white/50">{list.length}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((sc) => {
                const city = sc.city;
                const isPinned = pinnedIds.includes(city.id);
                const isSelected = selectedId === city.id;

                return (
                  <div
                    key={city.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(city.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(city.id);
                      }
                    }}
                    className={cx(
                      "paper-card border paper-border group relative w-[min(440px,100%)] rounded-2xl p-3 text-left",
                      "transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-lg",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                      isSelected && "ring-2 ring-white/25"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white">
                          {city.name}
                        </div>
                        <div className="truncate text-sm text-white/70">
                          {city.country}
                        </div>
                      </div>

                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        <BudgetBadge status={sc.budgetStatus} deltaUsd={sc.budgetDeltaUsd} />

                        {onTogglePin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin(city.id);
                            }}
                            className={cx(
                              "ui-btn rounded-full px-2.5 py-1 text-xs font-semibold",
                              isPinned
                                ? "bg-white text-black"
                                : "bg-white/10 text-white hover:bg-white/15"
                            )}
                            title={isPinned ? "Unpin" : "Pin to compare"}
                          >
                            {isPinned ? "Pinned" : "Pin"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm text-white/70">
                        Score{" "}
                        <span className="font-semibold text-white">
                          {Math.round(sc.totalScore)}
                        </span>
                      </div>
                      <div className={cx("h-1.5 w-24 rounded-full", meta.railTint)}>
                        <div
                          className={cx("h-1.5 rounded-full", meta.accentBar)}
                          style={{ width: `${Math.max(2, Math.min(100, sc.totalScore))}%` }}
                        />
                      </div>
                    </div>

                    {sc.highlights?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {sc.highlights.slice(0, 3).map((h) => (
                          <span
                            key={h}
                            className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/80"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}