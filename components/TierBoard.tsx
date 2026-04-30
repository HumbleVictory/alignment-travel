// components/TierBoard.tsx
"use client";

import type { ScoredCity, TopDriver } from "@/lib/scoring";

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

  const label = isWithin ? "Within budget" : isOver ? "Overbudget" : "Underbudget";

  const num =
    typeof deltaUsd === "number" && Number.isFinite(deltaUsd)
      ? Math.round(Math.abs(deltaUsd))
      : null;

  const sub = num == null ? "" : isWithin ? `±$${num}` : `${isOver ? "+" : "-"}$${num}`;

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

function pickStrongest(drivers: TopDriver[] | undefined, n = 2) {
  const list = Array.isArray(drivers) ? drivers.slice() : [];
  return list.sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, n);
}

function pickConstraint(drivers: TopDriver[] | undefined) {
  const list = Array.isArray(drivers) ? drivers.slice() : [];
  // High raw weight + low score = constraint signal
  const ranked = list
    .map((d) => {
      const w = typeof d.weightRaw === "number" ? d.weightRaw : 0;
      const s = typeof d.score === "number" ? d.score : 0;
      return { d, v: w * (100 - s) };
    })
    .sort((a, b) => b.v - a.v);

  const best = ranked[0]?.d ?? null;
  if (!best) return null;

  const w = best.weightRaw ?? 0;
  const s = best.score ?? 0;

  return w >= 45 && s <= 55 ? best : null;
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
    <div className="space-y-5">
      {TIER_ORDER.map((tier) => {
        const list = tiers[tier] ?? [];
        if (!list.length) return null;

        const meta = TIER_META[tier];

        return (
          <section key={tier} className="panel p-5">
            <div className="flex items-center gap-3">
              <div className={cx("h-9 w-1.5 rounded-full", meta.accentBar)} />

              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cx(
                    "shrink-0 rounded-full px-3 py-1 text-sm font-semibold",
                    meta.tierPillBg,
                    meta.tierPillText
                  )}
                >
                  {meta.label}
                </span>
                <span className="truncate text-sm text-white/70">{meta.subtitle}</span>
              </div>

              <div className="ml-auto text-xs font-semibold text-white/45">{list.length}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((sc) => {
                const city = sc.city;
                const isPinned = pinnedIds.includes(city.id);
                const isSelected = selectedId === city.id;

                const strongest = pickStrongest(sc.topDrivers, 2);
                const constraint = pickConstraint(sc.topDrivers);

                const primary = strongest[0]?.label ?? null;
                const secondary = strongest[1]?.label ?? null;

                const score = Math.round(sc.totalScore);

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
                      "rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-4 text-left",
                      "shadow-[0_18px_60px_rgba(0,0,0,0.28)]",
                      "transition hover:-translate-y-[1px] hover:border-white/15 hover:bg-white/[0.06]",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                      isSelected && "ring-2 ring-white/25"
                    )}
                  >
                    {/* top row */}
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white/90">{city.name}</div>
                        <div className="truncate text-sm text-white/65">{city.country}</div>
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
                              isPinned ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15"
                            )}
                            title={isPinned ? "Unpin" : "Pin to compare"}
                          >
                            {isPinned ? "Pinned" : "Pin"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* score emphasis */}
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold tracking-wide text-white/45">ALIGNMENT</div>
                        <div className="mt-1 text-3xl font-semibold text-white">{score}</div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-semibold text-white/45">TIER</div>
                        <div
                          className={cx(
                            "mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            meta.tierPillBg,
                            meta.tierPillText
                          )}
                        >
                          {tier}
                        </div>
                      </div>
                    </div>

                    {/* rail */}
                    <div className="mt-3">
                      <div className={cx("h-1.5 w-full rounded-full", meta.railTint)}>
                        <div
                          className={cx("h-1.5 rounded-full", meta.accentBar)}
                          style={{ width: `${Math.max(2, Math.min(100, sc.totalScore))}%` }}
                        />
                      </div>
                    </div>

                    {/* contributors + causality */}
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] font-semibold tracking-wide text-white/45">STRONGEST CONTRIBUTORS</div>
                      <div className="mt-1 text-sm text-white/80">
                        {primary ? (
                          <>
                            {primary}
                            {secondary ? <span className="text-white/45"> · </span> : null}
                            {secondary ? secondary : null}
                          </>
                        ) : (
                          <span className="text-white/55">—</span>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] leading-snug text-white/55">
                        {primary ? (
                          <>
                            Driven by <span className="font-semibold text-white/70">{primary}</span>
                            {secondary ? (
                              <>
                                {" "}
                                and <span className="font-semibold text-white/70">{secondary}</span>
                              </>
                            ) : null}
                            {constraint ? (
                              <>
                                {" "}
                                · Constraint: <span className="font-semibold text-white/70">{constraint.label}</span>
                              </>
                            ) : null}
                            .
                          </>
                        ) : (
                          <>Weighted evaluation produced this outcome.</>
                        )}
                      </div>
                    </div>
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