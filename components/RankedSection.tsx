// components/RankedSection.tsx
"use client";

import { ScoredCity } from "@/lib/scoring";

export function RankedSection({
  kicker,
  title,
  subtitle,
  items,
  onSelect,
  pinnedIds,
  onTogglePin,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  items: ScoredCity[];
  onSelect: (c: ScoredCity) => void;
  pinnedIds: string[];
  onTogglePin: (c: ScoredCity) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <div className="text-xs font-semibold tracking-widest text-emerald-700">{kicker}</div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          <div className="text-xs text-neutral-600 dark:text-neutral-300">{subtitle}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it) => {
          const id = (it.city?.id ?? "") as string;
          const pinned = pinnedIds.includes(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(it)}
              className="paper-card group rounded-2xl p-4 text-left transition-all hover:-translate-y-[1px] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      {it.city.name}
                      {it.city.country ? `, ${it.city.country}` : ""}
                    </div>

                    <span className="ui-chip text-[11px] font-semibold bg-white/60 dark:bg-black/10 text-neutral-700 dark:text-neutral-200">
                      {it.tier} tier
                    </span>

                    {/* Budget badge (informational only) */}
                    <BudgetBadge it={it} />
                  </div>

                  <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Alignment{" "}
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {it.totalScore.toFixed(1)}
                    </span>
                    {it.city.region ? (
                      <>
                        <span className="text-neutral-400 dark:text-neutral-500"> · </span>
                        {it.city.region}
                      </>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(it.highlights ?? []).slice(0, 3).map((h) => (
                      <span
                        key={h}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/25 dark:text-emerald-100"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(it);
                    }}
                    className={[
                      "ui-btn rounded-full px-3 py-1 text-xs font-semibold",
                      pinned ? "ui-btn-accent" : "text-neutral-800 dark:text-neutral-100",
                    ].join(" ")}
                    title="Pin for compare"
                  >
                    {pinned ? "Pinned" : "Pin"}
                  </button>

                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    View details →
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BudgetBadge({ it }: { it: ScoredCity }) {
  const budget = it.budgetUsd;
  const est = it.estimatedTripCostUsd;
  const status = it.budgetStatus;

  if (budget == null || est == null || status === "unknown") return null;

  const base = "ui-chip text-[11px] font-semibold bg-white/60 dark:bg-black/10";
  const cls =
    status === "over"
      ? "text-rose-800 dark:text-rose-200"
      : "text-emerald-800 dark:text-emerald-200";

  const label =
    status === "over" ? "Overbudget" : status === "within" ? "Within budget" : "Underbudget";

  return (
    <span
      className={`${base} ${cls}`}
      title="Informational only (does not affect ranking)."
    >
      {label}
    </span>
  );
}


