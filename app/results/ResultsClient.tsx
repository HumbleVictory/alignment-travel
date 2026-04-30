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
import { CityModal, type CityFeedback } from "@/components/CityModal";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    update();
    media.addEventListener?.("change", update);

    return () => media.removeEventListener?.("change", update);
  }, [query]);

  return matches;
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

// Map "Custom" UX sliders -> decision drivers (0..100 each)
function mapCustomToDriverWeightsPct(input: any): Record<DriverKey, number> {
  const cost = clamp(Number(input?.cost ?? 50), 0, 100);
  const comfort = clamp(Number(input?.comfort ?? 50), 0, 100);
  const food = clamp(Number(input?.food ?? 50), 0, 100);
  const nightlife = clamp(Number(input?.nightlife ?? 50), 0, 100);
  const safety = clamp(Number(input?.safety ?? 50), 0, 100);
  const shoppingPref = clamp(Number(input?.shopping ?? 50), 0, 100);
  const weatherPref = clamp(Number(input?.weather ?? 50), 0, 100);
  const crowdsPref = clamp(Number(input?.crowds ?? 50), 0, 100);

  const weights: Record<DriverKey, number> = {
    flight: 0.95 * cost,
    hotel: 0.75 * comfort + 0.65 * cost,
    diningValue: 0.7 * food + 0.55 * nightlife + 0.45 * cost,
    culinaryDensity: 0.8 * food + 0.45 * nightlife,
    shopping: 0.9 * shoppingPref + 0.35 * cost,
    safetyTransit: 0.9 * safety + 0.35 * comfort,
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

function formatUsd(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "—";
}

function formatUsdDelta(n: unknown) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";

  const abs = Math.round(Math.abs(n)).toLocaleString();
  return `${n < 0 ? "-" : "+"}$${abs}`;
}

function scoreOf(city: ScoredCity) {
  return Math.round(Number((city as any)?.totalScore ?? (city as any)?.score ?? 0));
}

function tierOf(city: ScoredCity) {
  return String((city as any)?.tier ?? "C");
}

function budgetBadge(city: ScoredCity) {
  const status = String((city as any)?.budgetStatus ?? "unknown");
  const delta = (city as any)?.budgetDeltaUsd;

  if (status === "under") {
    return {
      label: "Under budget",
      value: formatUsdDelta(delta),
      tone: "green" as const,
    };
  }

  if (status === "over") {
    return {
      label: "Over budget",
      value: formatUsdDelta(delta),
      tone: "red" as const,
    };
  }

  if (status === "within") {
    return {
      label: "Within budget",
      value: "",
      tone: "neutral" as const,
    };
  }

  return {
    label: "Budget pending",
    value: "",
    tone: "neutral" as const,
  };
}

export default function ResultsClient() {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";

  /**
   * Lowered from 1320 so normal desktop/laptop widths still show
   * the right-side comparison panel.
   */
  const useSidePanel = useMediaQuery("(min-width: 1180px)");

  const [hydrated, setHydrated] = useState(false);

  // Modal
  const [selected, setSelected] = useState<ScoredCity | null>(null);

  // Compare
  const [pinned, setPinned] = useState<ScoredCity[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  // Personalization
  const [visitedByCity, setVisitedByCity] = useState<Record<string, boolean>>({});
  const [tripsByCity, setTripsByCity] = useState<Record<string, number>>({});
  const [feedbackByCity, setFeedbackByCity] = useState<Record<string, CityFeedback>>({});

  // Budget filter UI
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
    const base = ((PROFILES as any[]).find((p) => p?.id === setup.profileId) ??
      (PROFILES as any[])[0]) as Profile;

    if (setup.profileId !== "custom") return base;

    return {
      ...base,
      id: "custom",
      name: "Custom",
      weightsPct: mapCustomToDriverWeightsPct((setup as any).weights),
      description: "Custom priorities mapped into decision drivers",
    };
  }, [setup.profileId, (setup as any).weights]);

  const scored = useMemo(() => {
    return scoreCities(CITIES as any, profile as any, {
      budgetUsd: (setup as any).budgetUsd,
      visitedByCity,
      tripsByCity,
      feedbackByCity,
    });
  }, [profile, (setup as any).budgetUsd, visitedByCity, tripsByCity, feedbackByCity]);

  // Keep pinned city references fresh after scores change.
  useEffect(() => {
    setPinned((prev) => {
      if (!prev.length) return prev;

      const ids = prev.map((p) => p.city.id);
      const map = new Map(scored.map((s) => [s.city.id, s] as const));

      return ids.map((id) => map.get(id)).filter(Boolean) as ScoredCity[];
    });
  }, [scored]);

  // If all cities are unpinned, hide compare.
  // If there are pinned cities, keep/open compare.
  useEffect(() => {
    if (pinned.length === 0) {
      setCompareOpen(false);
      return;
    }

    setCompareOpen(true);
  }, [pinned.length]);

  const budgetCounts = useMemo(() => {
    let within = 0;
    let under = 0;
    let over = 0;
    let unknown = 0;

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
    const out: Record<"S" | "A" | "B" | "C" | "D", ScoredCity[]> = {
      S: [],
      A: [],
      B: [],
      C: [],
      D: [],
    };

    for (const it of visibleScored) out[it.tier].push(it);

    return out;
  }, [visibleScored]);

  const pinnedIds = useMemo(() => pinned.map((p) => p.city.id), [pinned]);

  const selectedFresh = useMemo(() => {
    if (!selected) return null;

    return scored.find((s) => s.city.id === selected.city.id) ?? selected;
  }, [selected, scored]);

  const compareCount = pinned.length;
  const compareVisible = compareCount > 0 && compareOpen;

  function togglePin(it: ScoredCity) {
    const id = it.city.id;
    const exists = pinned.some((p) => p.city.id === id);

    if (exists) {
      const next = pinned.filter((p) => p.city.id !== id);
      setPinned(next);
      setCompareOpen(next.length > 0);
      return;
    }

    if (pinned.length < 2) {
      setPinned([...pinned, it]);
      setCompareOpen(true);
      return;
    }

    // If already two are pinned, replace the older slot and keep compare visible.
    setPinned([pinned[1], it]);
    setCompareOpen(true);
  }

  function clearPinned() {
    setPinned([]);
    setCompareOpen(false);
  }

  function handleCompareSelect(city: ScoredCity) {
    setCompareOpen(false);
    setSelected(city);
  }

  const showSideCompare = hydrated && useSidePanel && compareVisible;
  const showMobileCompare = hydrated && !useSidePanel && compareVisible;
  const shiftLeftPx = showSideCompare ? 390 : 0;

  if (!hydrated) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div
        className="mx-auto grid max-w-[1540px] gap-6 px-6 py-10"
        style={{
          gridTemplateColumns: showSideCompare ? "minmax(0, 1120px) 360px" : "minmax(0, 1120px)",
          justifyContent: "center",
          alignItems: "start",
        }}
      >
        <div className="shell p-6 md:p-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium tracking-wide text-emerald-200/80">RESULTS</div>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Your best matches</h1>
              <div className="mt-2 text-xs text-white/55">Same math. Clearer view.</div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  if (compareCount > 0) setCompareOpen(true);
                }}
                className={[
                  "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                  compareCount > 0
                    ? "border-[#c8aa6e]/35 bg-[#c8aa6e]/10 text-[#f1dfb8] hover:border-[#c8aa6e]/50 hover:bg-[#c8aa6e]/15"
                    : "cursor-not-allowed border-white/10 bg-black/20 text-white/35",
                ].join(" ")}
                title={compareCount > 0 ? "Compare pinned cities" : "Pin cities to compare"}
              >
                Compare <span className="text-white/70">({compareCount}/2)</span>
              </button>

              <Link
                href="/configure"
                className="rounded-xl border border-white/15 bg-white/[0.02] px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white/25 hover:bg-white/[0.04]"
              >
                Edit
              </Link>

              <Link
                href="/"
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white/90"
              >
                Home
              </Link>
            </div>
          </header>

          <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-[88px] lg:self-start">
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/35 shadow-[0_18px_60px_rgba(0,0,0,0.40)] backdrop-blur-md">
                  <div className="p-4">
                    <div className="text-[11px] font-semibold tracking-wide text-white/45">
                      CONFIGURATION
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-semibold text-white/80">
                        {profile?.name ?? (setup as any).profileId}
                      </span>

                      <span className="text-white/35">·</span>

                      <span className="text-white/70">
                        Budget{" "}
                        <span className="font-semibold text-white/85">
                          {formatUsd((setup as any).budgetUsd)}
                        </span>
                      </span>

                      <span className="text-white/35">·</span>

                      <span className="text-white/70">
                        Month{" "}
                        <span className="font-semibold text-white/85">{(setup as any).month}</span>
                      </span>
                    </div>

                    <div className="mt-3 text-[11px] text-white/45">
                      Showing{" "}
                      <span className="font-semibold text-white/70">{visibleScored.length}</span>{" "}
                      {visibleScored.length === 1 ? "city" : "cities"}
                      {budgetCounts.unknown > 0 ? (
                        <span className="ml-2 text-white/35">
                          ·{" "}
                          <span className="font-semibold text-white/45">
                            {budgetCounts.unknown}
                          </span>{" "}
                          unknown
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 h-px w-full bg-white/10" />

                    <div className="mt-4">
                      <div className="text-[11px] font-semibold tracking-wide text-white/45">
                        BUDGET FILTER
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <FilterPill
                          active={budgetFilter === "all"}
                          onClick={() => setBudgetFilter("all")}
                          label="All"
                          count={budgetCounts.all}
                        />

                        <FilterPill
                          active={budgetFilter === "within"}
                          onClick={() => setBudgetFilter("within")}
                          label="Within"
                          count={budgetCounts.within}
                        />

                        <FilterPill
                          active={budgetFilter === "under"}
                          onClick={() => setBudgetFilter("under")}
                          label="Under"
                          count={budgetCounts.under}
                          tone="emerald"
                        />

                        <FilterPill
                          active={budgetFilter === "over"}
                          onClick={() => setBudgetFilter("over")}
                          label="Over"
                          count={budgetCounts.over}
                          tone="rose"
                        />
                      </div>

                      {budgetFilter !== "all" ? (
                        <button
                          type="button"
                          onClick={() => setBudgetFilter("all")}
                          className="mt-3 text-xs font-semibold text-white/55 hover:text-white/85"
                          title="Reset filter"
                        >
                          Reset
                        </button>
                      ) : null}

                      <Link
                        href="/methodology"
                        className="mt-4 inline-block text-xs font-semibold text-emerald-200/90 hover:text-emerald-200"
                        title="Methodology"
                      >
                        How scoring works →
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/55">
                  Pin up to <span className="font-semibold text-white/80">2</span> cities to compare.
                </div>
              </div>
            </aside>

            <section className="min-w-0">
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
            </section>
          </div>

          {selectedFresh ? (
            <CityModal
              selected={selectedFresh}
              onClose={() => setSelected(null)}
              country={selectedFresh.city?.country}
              visited={visitedByCity[selectedFresh.city.id]}
              trips={tripsByCity[selectedFresh.city.id]}
              onSetVisited={(v) => {
                const cityId = selectedFresh.city.id;
                if (!cityId) return;

                setVisitedByCity((p) => ({ ...p, [cityId]: v }));
              }}
              onSetTrips={(n) => {
                const cityId = selectedFresh.city.id;
                if (!cityId) return;

                setTripsByCity((p) => ({ ...p, [cityId]: n }));
                setVisitedByCity((p) => ({ ...p, [cityId]: n > 0 }));
              }}
              feedback={feedbackByCity[selectedFresh.city.id]}
              onSetFeedback={(next) => {
                setFeedbackByCity((p) => ({ ...p, [selectedFresh.city.id]: next }));
              }}
              shiftLeftPx={shiftLeftPx}
              isCompareOpen={compareVisible}
              isPinned={pinnedIds.includes(selectedFresh.city.id)}
              onTogglePin={() => togglePin(selectedFresh)}
            />
          ) : null}
        </div>

        {showSideCompare ? (
          <aside className="sticky top-[88px] self-start">
            <PinnedComparePanel
              pinned={pinned}
              onClear={clearPinned}
              onClose={() => setCompareOpen(false)}
              onSelect={handleCompareSelect}
            />
          </aside>
        ) : null}
      </div>

      {showMobileCompare ? (
        <div className="fixed inset-x-4 bottom-4 z-[1200]">
          <PinnedComparePanel
            pinned={pinned}
            onClear={clearPinned}
            onClose={() => setCompareOpen(false)}
            onSelect={handleCompareSelect}
            compact
          />
        </div>
      ) : null}
    </main>
  );
}

function PinnedComparePanel({
  pinned,
  onClear,
  onClose,
  onSelect,
  compact = false,
}: {
  pinned: ScoredCity[];
  onClear: () => void;
  onClose: () => void;
  onSelect: (city: ScoredCity) => void;
  compact?: boolean;
}) {
  const first = pinned[0] ?? null;
  const second = pinned[1] ?? null;

  const diff = first && second ? scoreOf(first) - scoreOf(second) : 0;

  const readout =
    first && second
      ? diff === 0
        ? "Even match"
        : diff > 0
          ? `${first.city.name} leads by ${Math.abs(diff)}`
          : `${second.city.name} leads by ${Math.abs(diff)}`
      : first
        ? `${first.city.name} locked`
        : "No cities pinned";

  return (
    <div
      className={[
        "relative z-[1200] overflow-hidden rounded-[30px] border border-white/10 bg-[#06080c]",
        "shadow-[0_30px_90px_rgba(0,0,0,0.62)] ring-1 ring-white/[0.05]",
        compact ? "max-h-[70vh] overflow-y-auto" : "max-h-[calc(100vh-112px)]",
      ].join(" ")}
    >
      <div className="h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.2),rgba(200,170,110,0.55),transparent)]" />

      <div className="border-b border-white/[0.08] bg-[#070a0f] p-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#c8aa6e] shadow-[0_0_14px_rgba(200,170,110,0.55)]" />

          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/42">
            Comparison
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-[32px] font-semibold leading-none tracking-[-0.06em] text-white">
              {pinned.length}/2
            </div>

            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">
              pinned
            </div>
          </div>

          <div className="max-w-[180px] rounded-full border border-white/10 bg-[#10151c] px-3 py-1.5 text-right text-[11px] font-semibold text-white/62">
            {readout}
          </div>
        </div>

        {first && second ? (
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0b1017] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/32">
              Alignment spread
            </div>

            <div className="mt-1 text-sm font-semibold text-white/76">
              {Math.abs(diff)} points
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        {first ? (
          <PinnedCompareSlot city={first} slot={1} onSelect={() => onSelect(first)} />
        ) : (
          <EmptyCompareSlot />
        )}

        {second ? (
          <PinnedCompareSlot city={second} slot={2} onSelect={() => onSelect(second)} />
        ) : (
          <EmptyCompareSlot />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-white/[0.08] bg-[#05070a] p-5">
        <ComparePanelButton onClick={onClear}>Clear</ComparePanelButton>
        <ComparePanelButton onClick={onClose}>Close</ComparePanelButton>
      </div>
    </div>
  );
}

function PinnedCompareSlot({
  city,
  slot,
  onSelect,
}: {
  city: ScoredCity;
  slot: 1 | 2;
  onSelect: () => void;
}) {
  const budget = budgetBadge(city);

  return (
    <div className="group relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1219] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/18 hover:bg-[#111821]">
      <div
        className={[
          "absolute inset-y-4 left-0 w-[3px] rounded-r-full",
          slot === 1 ? "bg-[#c8aa6e]" : "bg-[#8f9fb0]",
        ].join(" ")}
      />

      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.14),transparent)]" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[28px] font-semibold leading-none tracking-[-0.05em] text-white">
            {city.city.name}
          </div>

          <div className="mt-2 truncate text-sm text-white/50">{city.city.country}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Alignment
          </div>

          <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.05em] text-white">
            {scoreOf(city)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <CompareBadge tone={budget.tone}>{budget.label}</CompareBadge>
        {budget.value ? <CompareBadge tone={budget.tone}>{budget.value}</CompareBadge> : null}
        <CompareBadge>Tier {tierOf(city)}</CompareBadge>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect();
          }}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/62 transition hover:border-[#c8aa6e]/35 hover:bg-[#c8aa6e]/10 hover:text-[#f1dfb8] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          Open →
        </button>
      </div>
    </div>
  );
}

function EmptyCompareSlot() {
  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-dashed border-white/10 bg-[#0a0e13] p-5 text-left">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.08),transparent)]" />

      <div className="text-base font-semibold text-white/70">Awaiting another city</div>

      <div className="mt-2 text-sm leading-6 text-white/42">
        Pin another city from the board to complete the comparison.
      </div>
    </div>
  );
}

function ComparePanelButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-[16px] border border-white/10 bg-[#11161d] text-sm font-semibold text-white/78 transition hover:border-white/16 hover:bg-[#171e27] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      {children}
    </button>
  );
}

function CompareBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red";
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        tone === "green"
          ? "border-emerald-400/18 bg-emerald-400/10 text-emerald-100"
          : tone === "red"
            ? "border-rose-400/18 bg-rose-400/10 text-rose-100"
            : "border-white/10 bg-white/[0.04] text-white/62",
      ].join(" ")}
    >
      {children}
    </span>
  );
}