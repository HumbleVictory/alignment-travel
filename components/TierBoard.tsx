// components/TierBoard.tsx
"use client";

import type { MouseEvent } from "react";
import type { ScoredCity, TopDriver } from "@/lib/scoring";
import type { TripStyleMatch } from "@/lib/tripStyles";

type ShortlistStatus = "shortlist" | "maybe" | "not_this_trip";

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

function displayScoreOf(sc: ScoredCity) {
  return Math.round(
    Number((sc as any)?.displayScore ?? sc.totalScore ?? 0)
  );
}

function displayTierOf(sc: ScoredCity): ScoredCity["tier"] {
  return (((sc as any)?.displayTier ?? sc.tier ?? "C") as ScoredCity["tier"]);
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
        "pointer-events-none inline-flex max-w-full min-w-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        isWithin && "border-white/12 bg-white/[0.055] text-white/72",
        isOver && "border-rose-300/20 bg-rose-400/[0.08] text-rose-100/90",
        !isOver &&
          !isWithin &&
          "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100/90"
      )}
      title={label}
    >
      <span className="truncate">{label}</span>
      {sub ? <span className="ml-1 shrink-0 opacity-65">{sub}</span> : null}
    </span>
  );
}

function PinButton({
  isPinned,
  onClick,
}: {
  isPinned: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group/pin relative shrink-0 overflow-hidden rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98]",
        isPinned
          ? "border-amber-100/35 bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_10px_32px_rgba(251,191,36,0.15)]"
          : "border-white/14 bg-black/35 text-white/78 hover:border-white/26 hover:bg-white/[0.07] hover:text-white"
      )}
      title={isPinned ? "Remove from compare" : "Pin to compare"}
    >
      <span className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap">
        <span
          className={cx(
            "h-1.5 w-1.5 rounded-full transition",
            isPinned ? "bg-black" : "bg-white/40 group-hover/pin:bg-amber-100/80"
          )}
        />
        {isPinned ? "Pinned" : "Pin"}
      </span>
    </button>
  );
}

function shortlistLabel(status: ShortlistStatus) {
  if (status === "shortlist") return "Saved";
  if (status === "maybe") return "Maybe";
  return "Pass";
}

function ShortlistPill({
  cityId,
  value,
  current,
  onSetStatus,
}: {
  cityId: string;
  value: ShortlistStatus;
  current: ShortlistStatus | null;
  onSetStatus: (cityId: string, status: ShortlistStatus | null) => void;
}) {
  const active = current === value;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSetStatus(cityId, active ? null : value);
      }}
      className={cx(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active && value === "shortlist" && "border-emerald-300/24 bg-emerald-400/12 text-emerald-100",
        active && value === "maybe" && "border-[#c8aa6e]/28 bg-[#c8aa6e]/12 text-[#f1dfb8]",
        active && value === "not_this_trip" && "border-white/18 bg-white/[0.08] text-white/72",
        !active && "border-white/[0.10] bg-black/24 text-white/46 hover:border-white/18 hover:text-white/72"
      )}
      title={`Mark ${shortlistLabel(value)}`}
    >
      {shortlistLabel(value)}
    </button>
  );
}

function ShortlistControls({
  cityId,
  status,
  onSetStatus,
}: {
  cityId: string;
  status: ShortlistStatus | null;
  onSetStatus: (cityId: string, status: ShortlistStatus | null) => void;
}) {
  return (
    <div className="relative mt-3 rounded-2xl border border-white/[0.08] bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">
          Decision
        </div>
        {status ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
            {shortlistLabel(status)}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ShortlistPill cityId={cityId} value="shortlist" current={status} onSetStatus={onSetStatus} />
        <ShortlistPill cityId={cityId} value="maybe" current={status} onSetStatus={onSetStatus} />
        <ShortlistPill cityId={cityId} value="not_this_trip" current={status} onSetStatus={onSetStatus} />
      </div>
    </div>
  );
}

function pickStrongest(drivers: TopDriver[] | undefined, n = 2) {
  const list = Array.isArray(drivers) ? drivers.slice() : [];
  return list.sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, n);
}

function pickConstraint(drivers: TopDriver[] | undefined) {
  const list = Array.isArray(drivers) ? drivers.slice() : [];

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
  shortlistByCity = {},
  onSetShortlistStatus,
  tripStyleMatchByCity = {},
}: {
  tiers: Record<ScoredCity["tier"], ScoredCity[]>;
  pinnedIds: string[];
  onSelect: (cityId: string) => void;
  onTogglePin?: (cityId: string) => void;
  selectedId?: string | null;
  shortlistByCity?: Record<string, ShortlistStatus>;
  onSetShortlistStatus?: (cityId: string, status: ShortlistStatus | null) => void;
  tripStyleMatchByCity?: Record<string, TripStyleMatch>;
}) {
  return (
    <div className="space-y-5">
      {TIER_ORDER.map((tier) => {
        const list = tiers[tier] ?? [];
        if (!list.length) return null;

        const meta = TIER_META[tier];

        return (
          <section
            key={tier}
            className="panel p-5 shadow-[0_26px_100px_rgba(0,0,0,0.28)]"
          >
            <div className="flex items-center gap-3">
              <div
                className={cx(
                  "h-9 w-1.5 rounded-full shadow-[0_0_24px_rgba(255,255,255,0.14)]",
                  meta.accentBar
                )}
              />

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

                <span className="truncate text-sm text-white/68">
                  {meta.subtitle}
                </span>
              </div>

              <div className="ml-auto text-xs font-semibold text-white/38">
                {list.length}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((sc) => {
                const city = sc.city;
                const isPinned = pinnedIds.includes(city.id);
                const isSelected = selectedId === city.id;
                const shortlistStatus = shortlistByCity[city.id] ?? null;
                const strongest = pickStrongest(sc.topDrivers, 2);
                const constraint = pickConstraint(sc.topDrivers);
                const primary = strongest[0]?.label ?? null;
                const secondary = strongest[1]?.label ?? null;
                const score = displayScoreOf(sc);
                const displayTier = displayTierOf(sc);
                const cardMeta = TIER_META[displayTier] ?? meta;
                const tripStyleMatch = tripStyleMatchByCity[city.id] ?? null;
                const tripStyleTarget =
                  tripStyleMatch?.matchedLabels.length
                    ? tripStyleMatch.matchedLabels.slice(0, 2).join(", ")
                    : tripStyleMatch?.selectedLabels.slice(0, 2).join(", ");

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
                      "group relative min-w-0 overflow-hidden rounded-[28px] border p-4 text-left transition duration-150 will-change-transform",
                      "bg-[#070b12] shadow-[0_18px_70px_rgba(0,0,0,0.36)]",
                      "hover:-translate-y-[1px] hover:border-white/18 hover:bg-[#090e18]",
                      "active:scale-[0.998] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/22",
                      isPinned
                        ? "border-amber-100/26 ring-1 ring-amber-100/16"
                        : "border-white/10",
                      isSelected && "ring-2 ring-white/24"
                    )}
                  >
                    <div
                      className={cx(
                        "pointer-events-none absolute inset-x-0 top-0 h-px",
                        isPinned
                          ? "bg-[linear-gradient(to_right,rgba(251,191,36,0.62),rgba(255,255,255,0.28),transparent)]"
                          : "bg-[linear-gradient(to_right,rgba(255,255,255,0.18),transparent)]"
                      )}
                    />

                    {isPinned ? (
                      <div className="pointer-events-none absolute right-0 top-0 h-24 w-36 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.11),transparent_62%)]" />
                    ) : null}

                    <div className="relative min-w-0 space-y-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold tracking-tight text-white/92">
                          {city.name}
                        </div>

                        <div className="mt-0.5 truncate text-sm text-white/56">
                          {city.country}
                        </div>

                        {isPinned ? (
                          <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
                            Selected for compare
                          </div>
                        ) : null}

                        {shortlistStatus ? (
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/62">
                            {shortlistLabel(shortlistStatus)} decision
                          </div>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <BudgetBadge
                          status={sc.budgetStatus}
                          deltaUsd={sc.budgetDeltaUsd}
                        />

                        {onTogglePin ? (
                          <PinButton
                            isPinned={isPinned}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin(city.id);
                            }}
                          />
                        ) : null}
                      </div>

                      {tripStyleMatch ? (
                        <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] leading-5 text-white/50">
                          <span className="font-semibold text-white/66">
                            {tripStyleMatch.label} match for {tripStyleTarget}
                          </span>
                          {tripStyleMatch.influence === "boosted" ? (
                            <span className="text-white/42">
                              {" "}
                              · Helps ranking
                            </span>
                          ) : tripStyleMatch.influence === "reduced" ? (
                            <span className="text-white/42">
                              {" "}
                              · Ranking tempered
                            </span>
                          ) : (
                            <span className="text-white/42">
                              {" "}
                              · Style fit reviewed
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {onSetShortlistStatus ? (
                      <ShortlistControls
                        cityId={city.id}
                        status={shortlistStatus}
                        onSetStatus={onSetShortlistStatus}
                      />
                    ) : null}

                    <div className="relative mt-5 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">
                          {tripStyleMatch ? "Recommendation" : "Alignment"}
                        </div>

                        <div className="mt-1 text-4xl font-semibold tracking-[-0.045em] text-white">
                          {score}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">
                          Tier
                        </div>

                        <div
                          className={cx(
                            "mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            cardMeta.tierPillBg,
                            cardMeta.tierPillText
                          )}
                        >
                          {displayTier}
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-3">
                      <div
                        className={cx(
                          "h-1.5 w-full overflow-hidden rounded-full",
                          cardMeta.railTint
                        )}
                      >
                        <div
                          className={cx(
                            "h-1.5 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.12)]",
                            cardMeta.accentBar
                          )}
                          style={{
                            width: `${Math.max(2, Math.min(100, score))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="relative mt-3 rounded-2xl border border-white/9 bg-black/28 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">
                        Strongest contributors
                      </div>

                      <div className="mt-1 text-sm text-white/78">
                        {primary ? (
                          <>
                            {primary}
                            {secondary ? (
                              <span className="text-white/36"> · </span>
                            ) : null}
                            {secondary ? secondary : null}
                          </>
                        ) : (
                          <span className="text-white/45">—</span>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] leading-snug text-white/50">
                        {primary ? (
                          <>
                            Driven by{" "}
                            <span className="font-semibold text-white/68">
                              {primary}
                            </span>
                            {secondary ? (
                              <>
                                {" "}
                                and{" "}
                                <span className="font-semibold text-white/68">
                                  {secondary}
                                </span>
                              </>
                            ) : null}
                            {constraint ? (
                              <>
                                {" "}
                                · Constraint:{" "}
                                <span className="font-semibold text-white/68">
                                  {constraint.label}
                                </span>
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
