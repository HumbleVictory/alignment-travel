// app/results/ResultsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CITIES } from "@/data/cities";
import { PROFILES } from "@/data/profiles";
import type { DriverKey, Profile, ScoredCity } from "@/lib/scoring";
import { scoreCities } from "@/lib/scoring";
import { loadSetup, DEFAULT_SETUP } from "@/lib/clientSetup";
import { TierBoard } from "@/components/TierBoard";
import { CityModal, CityFeedback } from "@/components/CityModal";
import { CompareDrawer } from "@/components/CompareDrawer";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

type BudgetFilter = "all" | "within" | "under" | "over";
const RESULTS_FILTER_KEY = "results:budgetFilter:v1";

function loadBudgetFilter(): BudgetFilter {
  if (typeof window === "undefined") return "all";
  try {
    const v = window.localStorage.getItem(RESULTS_FILTER_KEY);
    if (v === "within" || v === "under" || v === "over" || v === "all") return v;
    return "all";
  } catch {
    return "all";
  }
}
function saveBudgetFilter(v: BudgetFilter) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESULTS_FILTER_KEY, v);
  } catch {
    // ignore
  }
}

// Map your "Custom" UX sliders -> decision drivers (0..100 each).
// Now includes weather + crowds too.
function mapCustomToDriverWeightsPct(input: any): Record<DriverKey, number> {
  const cost = clamp(Number(input?.cost ?? 50), 0, 100);
  const comfort = clamp(Number(input?.comfort ?? 50), 0, 100);
  const food = clamp(Number(input?.food ?? 50), 0, 100);
  const nightlife = clamp(Number(input?.nightlife ?? 50), 0, 100);
  const safety = clamp(Number(input?.safety ?? 50), 0, 100);
  const shoppingPref = clamp(Number(input?.shopping ?? 50), 0, 100);

  // ✅ new custom sliders (if you don’t have them yet, defaults still work)
  const weatherPref = clamp(Number(input?.weather ?? 50), 0, 100);
  const crowdsPref = clamp(Number(input?.crowds ?? 50), 0, 100);

  const weights: Record<DriverKey, number> = {
    flight: 0.95 * cost,
    hotel: 0.75 * comfort + 0.65 * cost,
    diningValue: 0.7 * food + 0.55 * nightlife + 0.45 * cost,
    culinaryDensity: 0.8 * food + 0.45 * nightlife,
    shopping: 0.9 * shoppingPref + 0.35 * cost,
    safetyTransit: 0.9 * safety + 0.35 * comfort,

    // ✅ new drivers
    weather: 1.0 * weatherPref + 0.15 * comfort,
    crowds: 1.0 * crowdsPref + 0.15 * comfort,
  };

  (Object.keys(weights) as DriverKey[]).forEach((k) => {
    weights[k] = clamp(weights[k], 0, 100);
  });

  return weights;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  tone?: "neutral" | "emerald" | "rose";
}) {
  const base = "rounded-full border px-3 py-1.5 text-xs font-semibold transition select-none";
  const activeCls =
    tone === "rose"
      ? "border-rose-400/30 bg-rose-400/15 text-rose-50"
      : tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-50"
      : "border-white/25 bg-white/[0.06] text-white";
  const idleCls =
    "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white/90 hover:bg-black/25";

  return (
    <button type="button" onClick={onClick} className={cx(base, active ? activeCls : idleCls)}>
      {label}
      {typeof count === "number" ? <span className="ml-1.5 text-white/60">({count})</span> : null}
    </button>
  );
}

export default function ResultsClient() {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";

  const [hydrated, setHydrated] = useState(false);

  // modal
  const [selected, setSelected] = useState<ScoredCity | null>(null);

  // compare
  const [compareOpen, setCompareOpen] = useState(false);
  const [pinned, setPinned] = useState<ScoredCity[]>([]);

  // personalization (local)
  const [visitedByCountry, setVisitedByCountry] = useState<Record<string, boolean>>({});
  const [tripsByCountry, setTripsByCountry] = useState<Record<string, number>>({});
  const [feedbackByCity, setFeedbackByCity] = useState<Record<string, CityFeedback>>({});

  // Budget filter UI (persistent)
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("all");

  const setup = useMemo(() => (demo ? DEFAULT_SETUP : loadSetup()), [demo]);

  useEffect(() => {
    setHydrated(true);
    setBudgetFilter(demo ? "all" : loadBudgetFilter());
  }, [demo]);

  useEffect(() => {
    if (!hydrated) return;
    if (demo) return;
    saveBudgetFilter(budgetFilter);
  }, [hydrated, demo, budgetFilter]);

  const profile: Profile = useMemo(() => {
    const base =
      ((PROFILES as any[]).find((p) => p?.id === setup.profileId) ?? (PROFILES as any[])[0]) as Profile;

    if (setup.profileId !== "custom") return base;

    return {
      ...base,
      id: "custom",
      name: "Custom",
      weightsPct: mapCustomToDriverWeightsPct(setup.weights),
      description: "Custom priorities mapped into decision drivers",
    };
  }, [setup.profileId, setup.weights]);

  const scored = useMemo(() => {
    return scoreCities(CITIES as any, profile as any, {
      budgetUsd: setup.budgetUsd,
      visitedByCountry,
      tripsByCountry,
    });
  }, [profile, setup.budgetUsd, visitedByCountry, tripsByCountry]);

  // keep pinned references fresh after re-score
  useEffect(() => {
    setPinned((prev) => {
      const ids = prev.map((p) => p.city.id);
      const map = new Map(scored.map((s) => [s.city.id, s] as const));
      return ids.map((id) => map.get(id)).filter(Boolean) as ScoredCity[];
    });
  }, [scored]);

  // HARD GUARANTEE: if anything is pinned, the drawer opens
  useEffect(() => {
    if (!hydrated) return;
    if (pinned.length > 0) setCompareOpen(true);
  }, [hydrated, pinned.length]);

  const budgetCounts = useMemo(() => {
    let within = 0,
      under = 0,
      over = 0,
      unknown = 0;
    for (const s of scored) {
      const st = (s as any).budgetStatus ?? "unknown";
      if (st === "within") within++;
      else if (st === "under") under++;
      else if (st === "over") over++;
      else unknown++;
    }
    return { within, under, over, unknown, all: scored.length };
  }, [scored]);

  const visibleScored = useMemo(() => {
    if (budgetFilter === "all") return scored;
    return scored.filter((s) => ((s as any).budgetStatus ?? "unknown") === budgetFilter);
  }, [scored, budgetFilter]);

  const tiers = useMemo(() => {
    const out: Record<"S" | "A" | "B" | "C" | "D", ScoredCity[]> = { S: [], A: [], B: [], C: [], D: [] };
    for (const it of visibleScored) out[it.tier].push(it);
    return out;
  }, [visibleScored]);

  const pinnedIds = useMemo(() => pinned.map((p) => p.city.id), [pinned]);
  const compareCount = pinned.length;

  function togglePin(it: ScoredCity) {
    setPinned((prev) => {
      const id = it.city.id;
      const exists = prev.some((p) => p.city.id === id);
      if (exists) return prev.filter((p) => p.city.id !== id);
      if (prev.length < 2) return [...prev, it];
      return [prev[1], it];
    });
    setCompareOpen(true);
  }

  function swapPinned() {
    setPinned((prev) => (prev.length === 2 ? [prev[1], prev[0]] : prev));
  }

  function clearPinned() {
    setPinned([]);
  }

  const shiftLeftPx = compareOpen ? 220 : 0;

  if (!hydrated) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium tracking-wide text-emerald-200/80">RESULTS</div>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Your destinations ranked by <span className="text-white">Alignment Score</span>
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Profile: <span className="font-semibold text-white/85">{profile?.name ?? setup.profileId}</span> · Budget:{" "}
              <span className="font-semibold text-white/85">${setup.budgetUsd.toLocaleString()}</span> · Month:{" "}
              <span className="font-semibold text-white/85">{setup.month}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className={[
                "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                compareCount > 0
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:border-emerald-400/35 hover:bg-emerald-400/15"
                  : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white/90",
              ].join(" ")}
              title="Compare pinned cities"
            >
              Compare <span className="text-white/70">({compareCount}/2)</span>
            </button>

            <Link
              href="/setup"
              className="rounded-xl border border-white/15 bg-white/[0.02] px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white/25 hover:bg-white/[0.04]"
            >
              Edit setup
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white/90"
            >
              Home
            </Link>
          </div>
        </header>

        <div className="sticky top-[72px] z-40 mt-5 -mx-6 px-6">
          <div className="rounded-2xl border border-white/10 bg-black/35 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.40)]">
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <FilterPill active={budgetFilter === "all"} onClick={() => setBudgetFilter("all")} label="All" count={budgetCounts.all} />
                <FilterPill active={budgetFilter === "within"} onClick={() => setBudgetFilter("within")} label="Within budget" count={budgetCounts.within} />
                <FilterPill active={budgetFilter === "under"} onClick={() => setBudgetFilter("under")} label="Underbudget" count={budgetCounts.under} tone="emerald" />
                <FilterPill active={budgetFilter === "over"} onClick={() => setBudgetFilter("over")} label="Overbudget" count={budgetCounts.over} tone="rose" />

                {budgetFilter !== "all" ? (
                  <button
                    type="button"
                    onClick={() => setBudgetFilter("all")}
                    className="ml-1 text-xs font-semibold text-white/55 hover:text-white/85"
                    title="Reset budget filter"
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              <div className="text-xs text-white/50">
                Showing <span className="font-semibold text-white/70">{visibleScored.length}</span>{" "}
                {visibleScored.length === 1 ? "city" : "cities"}
                {budgetCounts.unknown > 0 ? (
                  <span className="ml-2 text-white/35">
                    · <span className="font-semibold text-white/45">{budgetCounts.unknown}</span> unknown
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <TierBoard
            tiers={tiers}
            pinnedIds={pinnedIds}
            onSelect={(cityId) => {
              const found = scored.find((s) => s.city.id === cityId) ?? null;
              setSelected(found);
            }}
            onTogglePin={(cityId) => {
              const found = scored.find((s) => s.city.id === cityId);
              if (found) togglePin(found);
            }}
            selectedId={selected?.city?.id ?? null}
          />
        </div>

        {selected ? (
          <CityModal
            selected={selected}
            onClose={() => setSelected(null)}
            country={selected.city?.country}
            visited={selected.city?.country ? visitedByCountry[selected.city.country] : undefined}
            trips={selected.city?.country ? tripsByCountry[selected.city.country] : undefined}
            onSetVisited={(v) => {
              const country = selected.city?.country;
              if (!country) return;
              setVisitedByCountry((p) => ({ ...p, [country]: v }));
            }}
            onSetTrips={(n) => {
              const country = selected.city?.country;
              if (!country) return;
              setTripsByCountry((p) => ({ ...p, [country]: n }));
            }}
            feedback={feedbackByCity[selected.city.id]}
            onSetFeedback={(next) => {
              setFeedbackByCity((p) => ({ ...p, [selected.city.id]: next }));
            }}
            shiftLeftPx={shiftLeftPx}
            isCompareOpen={compareOpen}
            isPinned={pinnedIds.includes(selected.city.id)}
            onTogglePin={() => togglePin(selected)}
          />
        ) : null}

        <CompareDrawer
          pinned={pinned}
          isOpen={compareOpen}
          onClose={() => setCompareOpen(false)}
          onClear={clearPinned}
          onSwap={swapPinned}
          onSelect={(c) => setSelected(c)}
        />
      </div>
    </main>
  );
}