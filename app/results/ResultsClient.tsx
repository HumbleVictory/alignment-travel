// app/results/ResultsClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

type BudgetStatusFilter = "within" | "under" | "over";

type TopicLens =
  | "cost"
  | "comfort"
  | "food"
  | "culture"
  | "nightlife"
  | "safety"
  | "shopping"
  | "weather"
  | "crowds";

type TopicFilter = "all" | TopicLens;

const RESULTS_BUDGET_FILTER_KEY_OLD = "results:budgetFilter:v1";
const RESULTS_BUDGET_FILTERS_KEY = "results:budgetFilters:v2";

const RESULTS_TOPIC_FILTER_KEY_OLD = "results:topicFilter:v1";
const RESULTS_TOPIC_FILTERS_KEY = "results:topicFilters:v2";

const TOPIC_FILTERS: Array<{
  id: TopicFilter;
  label: string;
  description: string;
}> = [
  {
    id: "all",
    label: "All",
    description: "Default alignment order.",
  },
  {
    id: "cost",
    label: "Cost",
    description: "Best value across flights, hotels, and dining.",
  },
  {
    id: "comfort",
    label: "Comfort",
    description: "Hotels, ease, weather, and lower-friction travel.",
  },
  {
    id: "food",
    label: "Food",
    description: "Dining value and culinary density.",
  },
  {
    id: "culture",
    label: "Culture",
    description: "A soft proxy using culinary depth, shopping, and practical ease.",
  },
  {
    id: "nightlife",
    label: "Nightlife",
    description: "Food energy, dining value, and late-night momentum proxy.",
  },
  {
    id: "safety",
    label: "Safety",
    description: "Safety and transit confidence.",
  },
  {
    id: "shopping",
    label: "Shopping",
    description: "Retail value and luxury/contemporary shopping signal.",
  },
  {
    id: "weather",
    label: "Weather",
    description: "Seasonal climate fit.",
  },
  {
    id: "crowds",
    label: "Crowds",
    description: "Lower crowd pressure.",
  },
];

function isBudgetStatusFilter(v: unknown): v is BudgetStatusFilter {
  return v === "within" || v === "under" || v === "over";
}

function isTopicLens(v: unknown): v is TopicLens {
  return (
    v === "cost" ||
    v === "comfort" ||
    v === "food" ||
    v === "culture" ||
    v === "nightlife" ||
    v === "safety" ||
    v === "shopping" ||
    v === "weather" ||
    v === "crowds"
  );
}

function uniqueBudgetFilters(values: unknown[]): BudgetStatusFilter[] {
  const out: BudgetStatusFilter[] = [];

  for (const value of values) {
    if (isBudgetStatusFilter(value) && !out.includes(value)) out.push(value);
  }

  return out;
}

function uniqueTopicFilters(values: unknown[]): TopicLens[] {
  const out: TopicLens[] = [];

  for (const value of values) {
    if (isTopicLens(value) && !out.includes(value)) out.push(value);
  }

  return out;
}

function loadBudgetFilters(): BudgetStatusFilter[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RESULTS_BUDGET_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return uniqueBudgetFilters(parsed);
    }

    // Back-compat with the older single-select setting.
    const old = window.localStorage.getItem(RESULTS_BUDGET_FILTER_KEY_OLD);
    return isBudgetStatusFilter(old) ? [old] : [];
  } catch {
    return [];
  }
}

function saveBudgetFilters(v: BudgetStatusFilter[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RESULTS_BUDGET_FILTERS_KEY, JSON.stringify(uniqueBudgetFilters(v)));
  } catch {
    // ignore
  }
}

function loadTopicFilters(): TopicLens[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RESULTS_TOPIC_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return uniqueTopicFilters(parsed);
    }

    // Back-compat with the older single-select setting.
    const old = window.localStorage.getItem(RESULTS_TOPIC_FILTER_KEY_OLD);
    return isTopicLens(old) ? [old] : [];
  } catch {
    return [];
  }
}

function saveTopicFilters(v: TopicLens[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RESULTS_TOPIC_FILTERS_KEY, JSON.stringify(uniqueTopicFilters(v)));
  } catch {
    // ignore
  }
}

// Map "Custom" UX sliders -> decision drivers (0..100 each)
function mapCustomToDriverWeightsPct(input: any): Record<DriverKey, number> {
  const cost = clamp(Number(input?.cost ?? 50), 0, 100);
  const comfort = clamp(Number(input?.comfort ?? 50), 0, 100);
  const food = clamp(Number(input?.food ?? 50), 0, 100);
  const culture = clamp(Number(input?.culture ?? 50), 0, 100);
  const nightlife = clamp(Number(input?.nightlife ?? 50), 0, 100);
  const safety = clamp(Number(input?.safety ?? 50), 0, 100);
  const shoppingPref = clamp(Number(input?.shopping ?? 50), 0, 100);
  const weatherPref = clamp(Number(input?.weather ?? 50), 0, 100);
  const crowdsPref = clamp(Number(input?.crowds ?? 50), 0, 100);

  const weights: Record<DriverKey, number> = {
    flight: 0.95 * cost,
    hotel: 0.75 * comfort + 0.65 * cost,
    diningValue: 0.7 * food + 0.55 * nightlife + 0.45 * cost,
    culinaryDensity: 0.8 * food + 0.45 * nightlife + 0.35 * culture,
    shopping: 0.9 * shoppingPref + 0.35 * cost + 0.25 * culture,
    safetyTransit: 0.9 * safety + 0.35 * comfort + 0.2 * culture,
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
  tone?: "neutral" | "emerald" | "rose" | "gold";
}) {
  const base = "rounded-full border px-3 py-1.5 text-xs font-semibold transition select-none";

  const activeCls =
    tone === "rose"
      ? "border-rose-400/30 bg-rose-400/15 text-rose-50"
      : tone === "emerald"
        ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-50"
        : tone === "gold"
          ? "border-[#c8aa6e]/35 bg-[#c8aa6e]/12 text-[#f1dfb8]"
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

function rawScoreOf(city: ScoredCity) {
  return Math.round(Number((city as any)?.totalScore ?? (city as any)?.score ?? 0));
}

function scoreOf(city: ScoredCity) {
  return Math.round(
    Number((city as any)?.displayScore ?? (city as any)?.totalScore ?? (city as any)?.score ?? 0)
  );
}

function tierOf(city: ScoredCity): ScoredCity["tier"] {
  const value = String((city as any)?.displayTier ?? (city as any)?.tier ?? "C");

  if (value === "S" || value === "A" || value === "B" || value === "C" || value === "D") {
    return value;
  }

  return "C";
}

function componentOf(city: ScoredCity, key: DriverKey) {
  const value = Number((city as any)?.components?.[key] ?? 0);
  return Number.isFinite(value) ? clamp(value, 0, 100) : 0;
}

function weightedAvg(parts: Array<[number, number]>) {
  let total = 0;
  let weight = 0;

  for (const [value, w] of parts) {
    if (!Number.isFinite(value) || !Number.isFinite(w) || w <= 0) continue;

    total += value * w;
    weight += w;
  }

  return weight > 0 ? total / weight : 0;
}

function topicScore(city: ScoredCity, topic: TopicLens) {
  const flight = componentOf(city, "flight");
  const hotel = componentOf(city, "hotel");
  const diningValue = componentOf(city, "diningValue");
  const culinaryDensity = componentOf(city, "culinaryDensity");
  const shopping = componentOf(city, "shopping");
  const safetyTransit = componentOf(city, "safetyTransit");
  const weather = componentOf(city, "weather");
  const crowds = componentOf(city, "crowds");

  if (topic === "cost") {
    return weightedAvg([
      [flight, 0.4],
      [hotel, 0.35],
      [diningValue, 0.25],
    ]);
  }

  if (topic === "comfort") {
    return weightedAvg([
      [hotel, 0.38],
      [safetyTransit, 0.25],
      [weather, 0.22],
      [crowds, 0.15],
    ]);
  }

  if (topic === "food") {
    return weightedAvg([
      [culinaryDensity, 0.58],
      [diningValue, 0.42],
    ]);
  }

  if (topic === "culture") {
    return weightedAvg([
      [culinaryDensity, 0.46],
      [shopping, 0.24],
      [safetyTransit, 0.18],
      [crowds, 0.12],
    ]);
  }

  if (topic === "nightlife") {
    return weightedAvg([
      [culinaryDensity, 0.45],
      [diningValue, 0.35],
      [shopping, 0.12],
      [safetyTransit, 0.08],
    ]);
  }

  if (topic === "safety") return safetyTransit;
  if (topic === "shopping") return shopping;
  if (topic === "weather") return weather;
  if (topic === "crowds") return crowds;

  return rawScoreOf(city);
}

function combinedTopicScore(city: ScoredCity, topics: TopicLens[]) {
  if (!topics.length) return rawScoreOf(city);

  const scores = topics.map((topic) => topicScore(city, topic));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
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
  const comparePanelRef = useRef<HTMLElement | null>(null);

  const params = useSearchParams();
  const demo = params.get("demo") === "1";

  const useSidePanel = useMediaQuery("(min-width: 1180px)");

  const [hydrated, setHydrated] = useState(false);

  const [selected, setSelected] = useState<ScoredCity | null>(null);

  const [pinned, setPinned] = useState<ScoredCity[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const [visitedByCity, setVisitedByCity] = useState<Record<string, boolean>>({});
  const [tripsByCity, setTripsByCity] = useState<Record<string, number>>({});
  const [feedbackByCity, setFeedbackByCity] = useState<Record<string, CityFeedback>>({});

  const [budgetFilters, setBudgetFilters] = useState<BudgetStatusFilter[]>([]);
  const [topicFilters, setTopicFilters] = useState<TopicLens[]>([]);

  const setup = useMemo(() => (demo ? DEFAULT_SETUP : loadSetup()), [demo]);

  useEffect(() => {
    setHydrated(true);
    setBudgetFilters(demo ? [] : loadBudgetFilters());
    setTopicFilters(demo ? [] : loadTopicFilters());
  }, [demo]);

  useEffect(() => {
    if (!hydrated) return;
    if (demo) return;

    saveBudgetFilters(budgetFilters);
  }, [hydrated, demo, budgetFilters]);

  useEffect(() => {
    if (!hydrated) return;
    if (demo) return;

    saveTopicFilters(topicFilters);
  }, [hydrated, demo, topicFilters]);

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
      tripDays: (setup as any).tripDays ?? (setup as any).days,
      groupDynamic: (setup as any).groupDynamic,
      visitedByCity,
      tripsByCity,
      feedbackByCity,
    });
  }, [
    profile,
    (setup as any).budgetUsd,
    (setup as any).tripDays,
    (setup as any).days,
    (setup as any).groupDynamic,
    visitedByCity,
    tripsByCity,
    feedbackByCity,
  ]);

  useEffect(() => {
    setPinned((prev) => {
      if (!prev.length) return prev;

      const ids = prev.map((p) => p.city.id);
      const map = new Map(scored.map((s) => [s.city.id, s] as const));

      return ids.map((id) => map.get(id)).filter(Boolean) as ScoredCity[];
    });
  }, [scored]);

  useEffect(() => {
    if (!hydrated) return;

    if (pinned.length === 0) {
      setCompareOpen(false);
      return;
    }

    if (useSidePanel) {
      setCompareOpen(true);
      return;
    }

    if (pinned.length >= 2) {
      setCompareOpen(true);
      return;
    }

    setCompareOpen(false);
  }, [hydrated, pinned.length, useSidePanel]);

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

  const selectedTopicMetas = useMemo(() => {
    return topicFilters
      .map((id) => TOPIC_FILTERS.find((topic) => topic.id === id))
      .filter(Boolean) as Array<(typeof TOPIC_FILTERS)[number]>;
  }, [topicFilters]);

  const topicLensLabel = useMemo(() => {
    if (!selectedTopicMetas.length) return "All";
    return selectedTopicMetas.map((topic) => topic.label).join(" + ");
  }, [selectedTopicMetas]);

  const topicLensDescription = useMemo(() => {
    if (!selectedTopicMetas.length) return "Choose one or more topics to surface cities strongest in those areas.";
    if (selectedTopicMetas.length === 1) return selectedTopicMetas[0].description;

    return "Ranking cities by their combined strength across the selected topics.";
  }, [selectedTopicMetas]);

  const visibleScored = useMemo(() => {
    const budgetFiltered =
      budgetFilters.length === 0
        ? scored
        : scored.filter((s) => budgetFilters.includes(((s as any).budgetStatus ?? "unknown") as BudgetStatusFilter));

    if (topicFilters.length === 0) return budgetFiltered;

    return [...budgetFiltered].sort((a, b) => {
      const topicDelta = combinedTopicScore(b, topicFilters) - combinedTopicScore(a, topicFilters);
      if (Math.abs(topicDelta) > 1e-9) return topicDelta;

      const scoreDelta = rawScoreOf(b) - rawScoreOf(a);
      if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;

      return (a.city.name ?? "").localeCompare(b.city.name ?? "");
    });
  }, [scored, budgetFilters, topicFilters]);

  const tiers = useMemo(() => {
    const out: Record<"S" | "A" | "B" | "C" | "D", ScoredCity[]> = {
      S: [],
      A: [],
      B: [],
      C: [],
      D: [],
    };

    for (const it of visibleScored) out[tierOf(it)].push(it);

    return out;
  }, [visibleScored]);

  const pinnedIds = useMemo(() => pinned.map((p) => p.city.id), [pinned]);

  const selectedFresh = useMemo(() => {
    if (!selected) return null;

    return scored.find((s) => s.city.id === selected.city.id) ?? selected;
  }, [selected, scored]);

  const compareCount = pinned.length;
  const compareVisible = compareCount > 0 && compareOpen;

  function toggleBudgetFilter(next: BudgetStatusFilter) {
    setBudgetFilters((prev) => {
      if (prev.includes(next)) return prev.filter((item) => item !== next);
      return [...prev, next];
    });
  }

  function toggleTopicFilter(next: TopicLens) {
    setTopicFilters((prev) => {
      if (prev.includes(next)) return prev.filter((item) => item !== next);
      return [...prev, next];
    });
  }

  function togglePin(it: ScoredCity) {
    const id = it.city.id;
    const exists = pinned.some((p) => p.city.id === id);

    if (exists) {
      const next = pinned.filter((p) => p.city.id !== id);
      setPinned(next);
      setCompareOpen(useSidePanel ? next.length > 0 : next.length >= 2);
      return;
    }

    if (pinned.length < 2) {
      const next = [...pinned, it];
      setPinned(next);
      setCompareOpen(useSidePanel ? next.length > 0 : next.length >= 2);
      return;
    }

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

  const showCompare = hydrated && compareVisible;
  const showSideCompare = showCompare && useSidePanel;
  const showMobileCompare = showCompare;
  const shiftLeftPx = showSideCompare ? 390 : 0;

  useEffect(() => {
    if (!showSideCompare) return;

    const onPointerDown = (event: PointerEvent) => {
      const panel = comparePanelRef.current;
      const target = event.target;

      if (!panel) return;
      if (!(target instanceof Node)) return;
      if (panel.contains(target)) return;

      if (target instanceof Element && target.closest("[data-compare-toggle='true']")) return;

      setCompareOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);

    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [showSideCompare]);

  useEffect(() => {
    if (!showMobileCompare) return;
    if (useSidePanel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showMobileCompare, useSidePanel]);

  useEffect(() => {
    if (!showMobileCompare) return;
    if (useSidePanel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCompareOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showMobileCompare, useSidePanel]);

  if (!hydrated) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div
        className="mx-auto grid max-w-[1540px] gap-6 px-6 py-10"
        style={{
          gridTemplateColumns: "minmax(0, 1120px)",
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
                data-compare-toggle="true"
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
                    <div className="text-[11px] font-semibold tracking-wide text-white/45">CONFIGURATION</div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-semibold text-white/80">
                        {profile?.name ?? (setup as any).profileId}
                      </span>

                      <span className="text-white/35">·</span>

                      <span className="text-white/70">
                        Budget{" "}
                        <span className="font-semibold text-white/85">{formatUsd((setup as any).budgetUsd)}</span>
                      </span>

                      <span className="text-white/35">·</span>

                      <span className="text-white/70">
                        Month <span className="font-semibold text-white/85">{(setup as any).month}</span>
                      </span>
                    </div>

                    <div className="mt-3 text-[11px] text-white/45">
                      Showing <span className="font-semibold text-white/70">{visibleScored.length}</span>{" "}
                      {visibleScored.length === 1 ? "city" : "cities"}
                      {budgetCounts.unknown > 0 ? (
                        <span className="ml-2 text-white/35">
                          · <span className="font-semibold text-white/45">{budgetCounts.unknown}</span> unknown
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 h-px w-full bg-white/10" />

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-[11px] font-semibold tracking-wide text-white/45">BUDGET FILTER</div>

                        {budgetFilters.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setBudgetFilters([])}
                            className="text-xs font-semibold text-white/45 transition hover:text-white/80"
                            title="Reset budget filters"
                          >
                            Reset
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <FilterPill
                          active={budgetFilters.length === 0}
                          onClick={() => setBudgetFilters([])}
                          label="All"
                          count={budgetCounts.all}
                        />

                        <FilterPill
                          active={budgetFilters.includes("within")}
                          onClick={() => toggleBudgetFilter("within")}
                          label="Within"
                          count={budgetCounts.within}
                        />

                        <FilterPill
                          active={budgetFilters.includes("under")}
                          onClick={() => toggleBudgetFilter("under")}
                          label="Under"
                          count={budgetCounts.under}
                          tone="emerald"
                        />

                        <FilterPill
                          active={budgetFilters.includes("over")}
                          onClick={() => toggleBudgetFilter("over")}
                          label="Over"
                          count={budgetCounts.over}
                          tone="rose"
                        />
                      </div>
                    </div>

                    <div className="mt-4 h-px w-full bg-white/10" />

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-[11px] font-semibold tracking-wide text-white/45">TOPIC LENS</div>

                        {topicFilters.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setTopicFilters([])}
                            className="text-xs font-semibold text-white/45 transition hover:text-white/80"
                            title="Reset topic lens"
                          >
                            Reset
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <FilterPill
                          active={topicFilters.length === 0}
                          onClick={() => setTopicFilters([])}
                          label="All"
                        />

                        {TOPIC_FILTERS.filter((topic) => topic.id !== "all").map((topic) => (
                          <FilterPill
                            key={topic.id}
                            active={topicFilters.includes(topic.id as TopicLens)}
                            onClick={() => toggleTopicFilter(topic.id as TopicLens)}
                            label={topic.label}
                            tone="gold"
                          />
                        ))}
                      </div>

                      <div
                        className={[
                          "mt-3 rounded-2xl border p-3 text-xs leading-5",
                          topicFilters.length > 0
                            ? "border-[#c8aa6e]/15 bg-[#c8aa6e]/10 text-white/52"
                            : "border-white/10 bg-black/15 text-white/38",
                        ].join(" ")}
                      >
                        {topicFilters.length > 0 ? (
                          <>
                            Showing cities through a{" "}
                            <span className="font-semibold text-[#f1dfb8]">{topicLensLabel}</span> lens.{" "}
                            {topicLensDescription}
                          </>
                        ) : (
                          topicLensDescription
                        )}
                      </div>

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
      </div>

      {showSideCompare ? (
        <aside
          ref={comparePanelRef}
          className="fixed z-50 hidden w-[420px] min-[1180px]:block"
          style={{
            top: 108,
            right: 24,
            bottom: 20,
          }}
        >
          <PinnedComparePanel
            pinned={pinned}
            onClear={clearPinned}
            onClose={() => setCompareOpen(false)}
            onSelect={handleCompareSelect}
          />
        </aside>
      ) : null}

      {showMobileCompare && !useSidePanel && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="City comparison"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483647,
              }}
            >
              <button
                type="button"
                aria-label="Close comparison"
                onClick={() => setCompareOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 1,
                  background: "rgba(0, 0, 0, 0.84)",
                  border: 0,
                  padding: 0,
                  margin: 0,
                  cursor: "default",
                }}
              />

              <div
                style={{
                  position: "fixed",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2,
                  maxHeight: "100svh",
                  overflowY: "auto",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 460,
                    margin: "0 auto",
                  }}
                >
                  <PinnedComparePanel
                    pinned={pinned}
                    onClear={clearPinned}
                    onClose={() => setCompareOpen(false)}
                    onSelect={handleCompareSelect}
                    compact
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
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

  const leader =
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
        "relative flex w-full flex-col overflow-hidden rounded-[32px] border border-white/[0.10] bg-[#05070b]",
        "shadow-[0_34px_110px_rgba(0,0,0,0.82)] ring-1 ring-white/[0.045]",
        compact ? "max-h-[calc(100svh-24px)]" : "h-full max-h-full",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(200,170,110,0.08),transparent_34%),linear-gradient(180deg,#070a0f_0%,#05070b_46%,#06080c_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.22),rgba(200,170,110,0.62),transparent)]" />

      <div className="relative border-b border-white/[0.08] bg-[#070a0f]/95 px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c8aa6e] shadow-[0_0_16px_rgba(200,170,110,0.62)]" />
              <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#c8aa6e]/78">
                Comparison console
              </div>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <div className="text-[42px] font-semibold leading-none tracking-[-0.075em] text-white">
                {pinned.length}/2
              </div>

              <div className="pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">
                pinned
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.10] bg-[#11161d] text-lg leading-none text-white/70 transition hover:border-white/[0.18] hover:bg-[#171e27] hover:text-white"
            aria-label="Close comparison"
            title="Close comparison"
          >
            ×
          </button>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-[#0b1017] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/32">
            Alignment spread
          </div>

          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-white/82">
              {first && second ? `${Math.abs(diff)} point${Math.abs(diff) === 1 ? "" : "s"}` : "Waiting"}
            </div>

            <div className="rounded-full border border-white/[0.08] bg-[#10151c] px-3 py-1.5 text-[11px] font-semibold text-white/58">
              {leader}
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto bg-[#05070b] p-5">
        <div className="space-y-4">
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
      </div>

      <div className="relative grid grid-cols-2 gap-3 border-t border-white/[0.08] bg-[#05070a] p-5">
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
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group relative w-full cursor-pointer overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#0d1219] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] transition hover:border-[#c8aa6e]/35 hover:bg-[#111821] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/35"
      title={`Open ${city.city.name}`}
    >
      <div
        className={[
          "absolute inset-y-4 left-0 w-[3px] rounded-r-full",
          slot === 1 ? "bg-[#c8aa6e]" : "bg-[#8f9fb0]",
        ].join(" ")}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.14),rgba(200,170,110,0.18),transparent)]" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[30px] font-semibold leading-none tracking-[-0.06em] text-white">
            {city.city.name}
          </div>

          <div className="mt-2 truncate text-sm font-medium text-white/50">{city.city.country}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Alignment
          </div>

          <div className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.06em] text-white">
            {scoreOf(city)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <CompareBadge tone={budget.tone}>{budget.label}</CompareBadge>
        {budget.value ? <CompareBadge tone={budget.tone}>{budget.value}</CompareBadge> : null}
        <CompareBadge>Tier {tierOf(city)}</CompareBadge>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/28">
          Selected compare slot {slot}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect();
          }}
          className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/62 transition hover:border-[#c8aa6e]/35 hover:bg-[#c8aa6e]/10 hover:text-[#f1dfb8] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          Open →
        </button>
      </div>
    </div>
  );
}

function EmptyCompareSlot() {
  return (
    <div className="relative w-full overflow-hidden rounded-[26px] border border-dashed border-white/[0.10] bg-[#0a0e13] p-5 text-left">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.08),transparent)]" />

      <div className="text-base font-semibold text-white/72">Awaiting another city</div>

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
  children: ReactNode;
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
  children: ReactNode;
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