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
import { loadSetup, DEFAULT_SETUP, type SetupTravelScope } from "@/lib/clientSetup";
import {
  calculateTripStyleMatch,
  joinStyleLabels,
  sanitizeTripStyles,
  tripStyleLabels,
  type TripStyleId,
  type TripStyleMatch,
} from "@/lib/tripStyles";
import { TierBoard } from "@/components/TierBoard";
import {
  CityModal,
  type CityFeedback,
  type PlanningIntent,
  type PremiumInterestRequest,
  type PremiumInterestSource,
  type PremiumInterestType,
} from "@/components/CityModal";

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

type ShortlistStatus = "shortlist" | "maybe" | "not_this_trip";
type PlanningIntentRecord = {
  intent: PlanningIntent;
  updatedAt: string;
};
type PlanningIntentByCity = Record<string, PlanningIntentRecord>;
type PremiumInterestRecord = PremiumInterestRequest & {
  createdAt: string;
  updatedAt?: string;
};
type TripStyleMatchByCity = Record<string, TripStyleMatch>;

const RESULTS_BUDGET_FILTER_KEY_OLD = "results:budgetFilter:v1";
const RESULTS_BUDGET_FILTERS_KEY = "results:budgetFilters:v2";

const RESULTS_TOPIC_FILTER_KEY_OLD = "results:topicFilter:v1";
const RESULTS_TOPIC_FILTERS_KEY = "results:topicFilters:v2";
const RESULTS_SHORTLIST_KEY = "results:shortlist:v1";
const RESULTS_PLANNING_INTENTS_KEY = "alignment-travel-planning-intents-v1";
const RESULTS_PREMIUM_INTEREST_KEY = "alignment-travel-premium-interest-v1";

const PREMIUM_INTEREST_TYPES: PremiumInterestType[] = [
  "premium_planning",
  "hotel_comparison",
  "booking_intelligence",
  "hotel_fit",
  "flight_convenience",
  "neighborhood_guidance",
  "shortlist_review",
  "advisor_handoff",
  "premium_report",
];

const DECISION_REVIEW_PREMIUM_OPTIONS: Array<{
  id: PremiumInterestType;
  label: string;
  description: string;
}> = [
  {
    id: "hotel_fit",
    label: "Hotel fit",
    description: "Hotel quality, location fit, and value signals.",
  },
  {
    id: "flight_convenience",
    label: "Flight convenience",
    description: "Routing simplicity, timing risk, and realistic effort.",
  },
  {
    id: "neighborhood_guidance",
    label: "Neighborhood guidance",
    description: "Stay-area fit for your travel style and comfort level.",
  },
  {
    id: "shortlist_review",
    label: "Final shortlist review",
    description: "A cleaner final call across saved destinations.",
  },
  {
    id: "advisor_handoff",
    label: "Advisor handoff later",
    description: "Curated help after choosing a destination.",
  },
  {
    id: "premium_report",
    label: "Premium report",
    description: "A deeper future report for final decision support.",
  },
];

const TRAVEL_SCOPE_LABEL: Record<SetupTravelScope, string> = {
  domestic_us: "Domestic — United States",
  international: "International",
  both: "Open to both",
};

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

function isShortlistStatus(v: unknown): v is ShortlistStatus {
  return v === "shortlist" || v === "maybe" || v === "not_this_trip";
}

function loadShortlistByCity(): Record<string, ShortlistStatus> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(RESULTS_SHORTLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const out: Record<string, ShortlistStatus> = {};

    for (const [cityId, status] of Object.entries(parsed)) {
      if (typeof cityId === "string" && isShortlistStatus(status)) out[cityId] = status;
    }

    return out;
  } catch {
    return {};
  }
}

function saveShortlistByCity(v: Record<string, ShortlistStatus>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RESULTS_SHORTLIST_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function isPlanningIntent(v: unknown): v is PlanningIntent {
  return v === "track" || v === "prepare_options" || v === "compare_hotels";
}

function loadPlanningIntentByCity(): PlanningIntentByCity {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(RESULTS_PLANNING_INTENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const out: PlanningIntentByCity = {};

    for (const [cityId, value] of Object.entries(parsed)) {
      if (typeof cityId !== "string" || !value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }

      const entry = value as Partial<PlanningIntentRecord>;
      if (!isPlanningIntent(entry.intent)) continue;

      out[cityId] = {
        intent: entry.intent,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
      };
    }

    return out;
  } catch {
    return {};
  }
}

function savePlanningIntentByCity(v: PlanningIntentByCity) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RESULTS_PLANNING_INTENTS_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function isPremiumInterestSource(v: unknown): v is PremiumInterestSource {
  return v === "destination_console" || v === "decision_review";
}

function isPremiumInterestType(v: unknown): v is PremiumInterestType {
  return PREMIUM_INTEREST_TYPES.includes(v as PremiumInterestType);
}

function loadPremiumInterestRequests(): PremiumInterestRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RESULTS_PREMIUM_INTEREST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

        const item = entry as Partial<PremiumInterestRecord>;

        if (
          !isPremiumInterestSource(item.source) ||
          !isPremiumInterestType(item.interestType) ||
          typeof item.createdAt !== "string" ||
          (item.email !== undefined && typeof item.email !== "string")
        ) {
          return null;
        }

        return {
          email: typeof item.email === "string" ? item.email : undefined,
          cityId: typeof item.cityId === "string" ? item.cityId : undefined,
          cityName: typeof item.cityName === "string" ? item.cityName : undefined,
          source: item.source,
          interestType: item.interestType,
          selectedReportModules: Array.isArray(item.selectedReportModules)
            ? item.selectedReportModules.filter((module): module is string => typeof module === "string")
            : undefined,
          createdAt: item.createdAt,
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
        };
      })
      .filter(Boolean) as PremiumInterestRecord[];
  } catch {
    return [];
  }
}

// Temporary local prototype for Phase 2A/2B/2C. Replace with a real provider/backend
// before treating premium interest as production lead capture.
function savePremiumInterestRequests(v: PremiumInterestRecord[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RESULTS_PREMIUM_INTEREST_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function shortlistStatusLabel(status: ShortlistStatus) {
  if (status === "shortlist") return "Saved";
  if (status === "maybe") return "Maybe";
  return "Pass";
}

function shortlistStatusDescription(status: ShortlistStatus) {
  if (status === "shortlist") return "Strong contender";
  if (status === "maybe") return "Keep watching";
  return "Not this trip";
}

function planningIntentBadgeLabel(intent: PlanningIntent) {
  if (intent === "track") return "Tracking";
  if (intent === "prepare_options") return "Booking options";
  return "Hotel compare";
}

function planningIntentSummaryLabel(intent: PlanningIntent, count: number) {
  const destination = count === 1 ? "destination" : "destinations";

  if (intent === "track") return `${count} ${destination} being tracked for planning review.`;
  if (intent === "prepare_options") return `${count} ${destination} marked for future booking review.`;
  return `${count} ${destination} marked for hotel comparison.`;
}

function isValidEmail(value: string) {
  const clean = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return false;

  const [localPart, domain] = clean.split("@");
  if (!localPart || !domain) return false;

  const labels = domain.split(".");
  const tld = labels[labels.length - 1] ?? "";
  const primaryDomain = labels[0] ?? "";

  return (
    localPart.length >= 3 &&
    primaryDomain.length >= 3 &&
    tld.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
  );
}

function sanitizeTravelScopeValue(value: unknown): SetupTravelScope {
  if (value === "domestic_us" || value === "international" || value === "both") return value;
  return "both";
}

function cityMatchesTravelScope(city: { country?: string; regionScope?: unknown }, scope: SetupTravelScope) {
  if (scope === "both") return true;

  const regionScope =
    city.regionScope === "domestic_us" || city.regionScope === "international"
      ? city.regionScope
      : city.country === "United States"
        ? "domestic_us"
        : "international";

  return regionScope === scope;
}

function decisionTripStyleInsight({
  items,
  selectedTripStyles,
  tripStyleMatchByCity,
}: {
  items: Array<{ city: ScoredCity; status: ShortlistStatus }>;
  selectedTripStyles: TripStyleId[];
  tripStyleMatchByCity: TripStyleMatchByCity;
}) {
  if (!selectedTripStyles.length || !items.length) return null;

  const styleCounts = new Map<TripStyleId, number>();
  let strong = 0;
  let low = 0;

  for (const style of selectedTripStyles) styleCounts.set(style, 0);

  for (const item of items) {
    const match = tripStyleMatchByCity[item.city.city.id] ?? null;
    if (!match) continue;

    if (match.strength === "strong") strong++;
    if (match.strength === "low") low++;

    for (const style of match.matchedIds) {
      styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
    }
  }

  const leadingStyles = [...styleCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([style]) => style);

  if (!leadingStyles.length) {
    return {
      title: "Trip style fit",
      body: `Your saved set does not strongly match ${joinStyleLabels(tripStyleLabels(selectedTripStyles))} yet. Keep one or two alternates in view before making the final call.`,
    };
  }

  const leadingLabel = joinStyleLabels(tripStyleLabels(leadingStyles));
  const strongCopy =
    strong > 0
      ? `${strong} marked destination${strong === 1 ? "" : "s"} strongly match your selected trip style.`
      : "The fit is present, but still worth pressure-testing before you promote a final pick.";
  const lowCopy =
    low > 0
      ? ` ${low} marked destination${low === 1 ? " is" : "s are"} a lower style match, so review the tradeoffs before moving forward.`
      : "";

  return {
    title: "Trip style fit",
    body: `Your decision set leans toward ${leadingLabel}. ${strongCopy}${lowCopy}`,
  };
}

function applyTripStyleRecommendationInfluence(
  baseScored: ScoredCity[],
  selectedTripStyles: TripStyleId[]
) {
  if (!selectedTripStyles.length) return baseScored;

  return baseScored
    .map((item) => {
      const match = calculateTripStyleMatch(selectedTripStyles, (item.city as any).tripStyles);
      const adjustment = match?.adjustment ?? 0;
      const baseAlignmentScore = Number((item as any).totalScore ?? 0);
      const baseDisplayScore = Number((item as any).displayScore ?? baseAlignmentScore);
      const recommendationScore = clamp(baseAlignmentScore + adjustment, 0, 100);
      const displayScore = Math.round(clamp(baseDisplayScore + adjustment, 0, 100));

      return {
        ...item,
        baseAlignmentScore,
        baseDisplayScore,
        baseDisplayTier: (item as any).displayTier ?? item.tier,
        recommendationScore,
        tripStyleAdjustment: adjustment,
        displayScore,
        displayTier: displayTierFromRecommendationScore(displayScore),
      };
    })
    .sort((a, b) => {
      const recommendationDelta =
        Number((b as any).recommendationScore ?? b.totalScore ?? 0) -
        Number((a as any).recommendationScore ?? a.totalScore ?? 0);
      if (Math.abs(recommendationDelta) > 1e-9) return recommendationDelta;

      const baseDelta =
        Number((b as any).totalScore ?? 0) - Number((a as any).totalScore ?? 0);
      if (Math.abs(baseDelta) > 1e-9) return baseDelta;

      return (a.city.name ?? "").localeCompare(b.city.name ?? "");
    });
}


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
  return Math.round(
    Number((city as any)?.recommendationScore ?? (city as any)?.totalScore ?? (city as any)?.score ?? 0)
  );
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

function displayTierFromRecommendationScore(score: number): ScoredCity["tier"] {
  const s = clamp(score, 0, 100);

  if (s >= 92) return "S";
  if (s >= 88) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";

  return "D";
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

  const useSidePanel = useMediaQuery("(min-width: 1024px)");

  const [hydrated, setHydrated] = useState(false);

  const [selected, setSelected] = useState<ScoredCity | null>(null);

  const [pinned, setPinned] = useState<ScoredCity[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [decisionDrawerOpen, setDecisionDrawerOpen] = useState(false);

  const [visitedByCity, setVisitedByCity] = useState<Record<string, boolean>>({});
  const [tripsByCity, setTripsByCity] = useState<Record<string, number>>({});
  const [feedbackByCity, setFeedbackByCity] = useState<Record<string, CityFeedback>>({});

  const [budgetFilters, setBudgetFilters] = useState<BudgetStatusFilter[]>([]);
  const [topicFilters, setTopicFilters] = useState<TopicLens[]>([]);
  const [shortlistByCity, setShortlistByCity] = useState<Record<string, ShortlistStatus>>({});
  const [planningIntentByCity, setPlanningIntentByCity] = useState<PlanningIntentByCity>({});
  const [premiumInterestRequests, setPremiumInterestRequests] = useState<PremiumInterestRecord[]>([]);

  const setup = useMemo(() => (demo ? DEFAULT_SETUP : loadSetup()), [demo]);
  const travelScope = sanitizeTravelScopeValue((setup as any).travelScope);
  const travelScopeLabel = TRAVEL_SCOPE_LABEL[travelScope];
  const selectedTripStyles = useMemo(() => sanitizeTripStyles((setup as any).tripStyles), [setup]);
  const selectedTripStyleLabel = selectedTripStyles.length
    ? joinStyleLabels(tripStyleLabels(selectedTripStyles))
    : null;

  useEffect(() => {
    setHydrated(true);
    setBudgetFilters(demo ? [] : loadBudgetFilters());
    setTopicFilters(demo ? [] : loadTopicFilters());
    setShortlistByCity(demo ? {} : loadShortlistByCity());
    setPlanningIntentByCity(loadPlanningIntentByCity());
    setPremiumInterestRequests(loadPremiumInterestRequests());
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

  useEffect(() => {
    if (!hydrated) return;
    if (demo) return;

    saveShortlistByCity(shortlistByCity);
  }, [hydrated, demo, shortlistByCity]);

  useEffect(() => {
    if (!hydrated) return;

    savePlanningIntentByCity(planningIntentByCity);
  }, [hydrated, planningIntentByCity]);

  useEffect(() => {
    if (!hydrated) return;

    savePremiumInterestRequests(premiumInterestRequests);
  }, [hydrated, premiumInterestRequests]);

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

  const eligibleCities = useMemo(() => {
    return (CITIES as any[]).filter((city) => cityMatchesTravelScope(city, travelScope));
  }, [travelScope]);

  const baseScored = useMemo(() => {
    return scoreCities(eligibleCities as any, profile as any, {
      budgetUsd: (setup as any).budgetUsd,
      tripDays: (setup as any).tripDays ?? (setup as any).days,
      groupDynamic: (setup as any).groupDynamic,
      visitedByCity,
      tripsByCity,
      feedbackByCity,
    });
  }, [
    eligibleCities,
    profile,
    (setup as any).budgetUsd,
    (setup as any).tripDays,
    (setup as any).days,
    (setup as any).groupDynamic,
    visitedByCity,
    tripsByCity,
    feedbackByCity,
  ]);

  const scored = useMemo(() => {
    return applyTripStyleRecommendationInfluence(baseScored, selectedTripStyles);
  }, [baseScored, selectedTripStyles]);

  const tripStyleMatchByCity = useMemo(() => {
    if (!selectedTripStyles.length) return {};

    const next: TripStyleMatchByCity = {};

    for (const city of scored) {
      const match = calculateTripStyleMatch(selectedTripStyles, (city.city as any).tripStyles);
      if (match) next[city.city.id] = match;
    }

    return next;
  }, [scored, selectedTripStyles]);

  useEffect(() => {
    setPinned((prev) => {
      if (!prev.length) return prev;

      const ids = prev.map((p) => p.city.id);
      const map = new Map(scored.map((s) => [s.city.id, s] as const));

      return ids.map((id) => map.get(id)).filter(Boolean) as ScoredCity[];
    });
  }, [scored]);

  useEffect(() => {
    if (!selected) return;
    if (scored.some((s) => s.city.id === selected.city.id)) return;
    setSelected(null);
  }, [scored, selected]);

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

  const shortlistCounts = useMemo(() => {
    let shortlist = 0;
    let maybe = 0;
    let notThisTrip = 0;
    const scoredIds = new Set(scored.map((city) => city.city.id));

    for (const [cityId, status] of Object.entries(shortlistByCity)) {
      if (!scoredIds.has(cityId)) continue;

      if (status === "shortlist") shortlist++;
      else if (status === "maybe") maybe++;
      else if (status === "not_this_trip") notThisTrip++;
    }

    return { shortlist, maybe, notThisTrip, total: shortlist + maybe + notThisTrip };
  }, [scored, shortlistByCity]);

  const shortlistTopCity = useMemo(() => {
    const ids = Object.entries(shortlistByCity)
      .filter(([, status]) => status === "shortlist")
      .map(([cityId]) => cityId);

    if (!ids.length) return null;

    return scored.find((city) => ids.includes(city.city.id)) ?? null;
  }, [scored, shortlistByCity]);

  const decisionBoardItems = useMemo(() => {
    const statusRank: Record<ShortlistStatus, number> = {
      shortlist: 0,
      maybe: 1,
      not_this_trip: 2,
    };

    return Object.entries(shortlistByCity)
      .map(([cityId, status]) => {
        const city = scored.find((item) => item.city.id === cityId) ?? null;
        return city ? { city, status } : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        const statusDelta = statusRank[a!.status] - statusRank[b!.status];
        if (statusDelta !== 0) return statusDelta;

        return scoreOf(b!.city) - scoreOf(a!.city);
      }) as Array<{ city: ScoredCity; status: ShortlistStatus }>;
  }, [scored, shortlistByCity]);

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

    return scored.find((s) => s.city.id === selected.city.id) ?? null;
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

  function setShortlistStatus(cityId: string, status: ShortlistStatus | null) {
    setShortlistByCity((prev) => {
      const next = { ...prev };

      if (!status) delete next[cityId];
      else next[cityId] = status;

      return next;
    });
  }

  function setPlanningIntentForCity(cityId: string, intent: PlanningIntent) {
    if (!cityId) return;

    setPlanningIntentByCity((prev) => ({
      ...prev,
      [cityId]: {
        intent,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function savePremiumInterest(request: PremiumInterestRequest) {
    const now = new Date().toISOString();
    const cleanEmail = request.email?.trim();

    setPremiumInterestRequests((prev) => [
      ...prev,
      {
        ...request,
        email: cleanEmail || undefined,
        selectedReportModules: Array.isArray(request.selectedReportModules)
          ? request.selectedReportModules.filter(Boolean)
          : undefined,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  function clearShortlistStatuses() {
    setShortlistByCity({});
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
    setSelected(city);
  }

  const showCompare = hydrated && compareVisible;
  const showSideCompare = showCompare && useSidePanel;
  const showMobileCompare = showCompare;
  const showFloatingCompare = hydrated && pinned.length > 0 && !compareOpen;
  const shiftLeftPx = showSideCompare ? 440 : 0;

  useEffect(() => {
    if (!showSideCompare) return;

    const onPointerDown = (event: PointerEvent) => {
      const panel = comparePanelRef.current;
      const target = event.target;

      if (!panel) return;
      if (!(target instanceof Node)) return;

      if (panel.contains(target)) return;

      if (target instanceof Element) {
        // The Destination Console is its own fixed portal. Clicking inside it should
        // not close the Comparison Console or interrupt button clicks inside the modal.
        if (target.closest("[data-city-modal-root='true']")) return;
        if (target.closest("[data-city-modal-panel='true']")) return;
        if (target.closest("[data-compare-toggle='true']")) return;
      }

      setCompareOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
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

  useEffect(() => {
    if (!decisionDrawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDecisionDrawerOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [decisionDrawerOpen]);

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

                      <span className="text-white/35">-</span>

                      <span className="text-white/70">
                        Destination pool{" "}
                        <span className="font-semibold text-white/85">{travelScopeLabel}</span>
                      </span>

                      {selectedTripStyleLabel ? (
                        <>
                          <span className="text-white/35">-</span>

                          <span className="text-white/70">
                            Trip style{" "}
                            <span className="font-semibold text-white/85">{selectedTripStyleLabel}</span>
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-3 text-[11px] text-white/45">
                      Showing <span className="font-semibold text-white/70">{visibleScored.length}</span>{" "}
                      {visibleScored.length === 1 ? "city" : "cities"}
                      <span className="ml-2 text-white/35">
                        - <span className="font-semibold text-white/45">{scored.length}</span> in pool
                      </span>
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

                      {selectedTripStyleLabel ? (
                        <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/16 p-3 text-xs leading-5 text-white/40">
                          Trip style is factored into ranking when selected. Topic Lens
                          inspects a category inside the result set.
                        </div>
                      ) : null}

                      <Link
                        href="/methodology"
                        className="mt-4 inline-block text-xs font-semibold text-emerald-200/90 hover:text-emerald-200"
                        title="Methodology"
                      >
                        How scoring works →
                      </Link>

                      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/16 p-3 text-xs leading-5 text-white/42">
                        Alignment Score reflects relative fit based on your stated
                        preferences, budget, travel style, and personalization signals.
                        {selectedTripStyleLabel
                          ? " Selected trip style is applied as a recommendation adjustment after base alignment. Current rankings are not paid placement."
                          : " Current rankings are based on alignment logic, not paid placement."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/55">
                  Pin up to <span className="font-semibold text-white/80">2</span> cities to compare.
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/72">
                        Trip decision board
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/82">
                        {shortlistCounts.shortlist} saved contender{shortlistCounts.shortlist === 1 ? "" : "s"}
                      </div>
                    </div>

                    {shortlistCounts.total > 0 ? (
                      <button
                        type="button"
                        onClick={clearShortlistStatuses}
                        className="text-xs font-semibold text-white/42 transition hover:text-white/80"
                        title="Clear shortlist decisions"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
                    <div className="rounded-2xl border border-emerald-300/12 bg-emerald-400/[0.06] px-2 py-2 text-emerald-100/78">
                      {shortlistCounts.shortlist}<span className="block text-[10px] text-white/36">Saved</span>
                    </div>
                    <div className="rounded-2xl border border-[#c8aa6e]/14 bg-[#c8aa6e]/[0.055] px-2 py-2 text-[#f1dfb8]/78">
                      {shortlistCounts.maybe}<span className="block text-[10px] text-white/36">Maybe</span>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-2 py-2 text-white/58">
                      {shortlistCounts.notThisTrip}<span className="block text-[10px] text-white/36">Pass</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#080c12] p-3 text-xs leading-5 text-white/48">
                    {shortlistTopCity ? (
                      <>
                        Top saved contender: <span className="font-semibold text-white/78">{shortlistTopCity.city.name}</span>.
                      </>
                    ) : shortlistCounts.total > 0 ? (
                      "You have cities marked, but none are saved yet."
                    ) : (
                      "Save contenders as you browse. Pinning is for comparing two cities; this is your broader decision set."
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCompareOpen(false);
                      setDecisionDrawerOpen(true);
                    }}
                    className="mt-3 w-full rounded-2xl border border-[#c8aa6e]/18 bg-[#c8aa6e]/[0.065] px-3 py-2.5 text-sm font-semibold text-[#f1dfb8] transition hover:border-[#c8aa6e]/32 hover:bg-[#c8aa6e]/[0.095] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/30"
                    title="Review saved cities"
                  >
                    Review decision set
                  </button>
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              {visibleScored.length > 0 ? (
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
                  shortlistByCity={shortlistByCity}
                  onSetShortlistStatus={setShortlistStatus}
                  tripStyleMatchByCity={tripStyleMatchByCity}
                />
              ) : (
                <div className="rounded-[28px] border border-white/[0.10] bg-[#080c12] p-6 shadow-[0_26px_100px_rgba(0,0,0,0.28)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8aa6e]/72">
                    Destination pool
                  </div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white/92">
                    No destinations match this view yet
                  </div>
                  <div className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                    {scored.length === 0
                      ? "Your current travel scope narrows the destination pool too tightly. Switch to Open to both to compare the full set."
                      : "Your current filters narrow the destination pool too tightly. Reset filters or adjust travel scope to compare more cities."}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/configure/setup"
                      className="rounded-2xl border border-[#c8aa6e]/20 bg-[#c8aa6e]/[0.075] px-4 py-2.5 text-sm font-semibold text-[#f1dfb8] transition hover:border-[#c8aa6e]/34 hover:bg-[#c8aa6e]/[0.11]"
                    >
                      Adjust travel scope
                    </Link>

                    {budgetFilters.length > 0 || topicFilters.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBudgetFilters([]);
                          setTopicFilters([]);
                        }}
                        className="rounded-2xl border border-white/[0.09] bg-white/[0.035] px-4 py-2.5 text-sm font-semibold text-white/62 transition hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-white/82"
                      >
                        Reset filters
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
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
              comparisonCities={pinned}
              isPinned={pinnedIds.includes(selectedFresh.city.id)}
              onTogglePin={() => togglePin(selectedFresh)}
              shortlistStatus={shortlistByCity[selectedFresh.city.id] ?? null}
              onSetShortlistStatus={(status) => setShortlistStatus(selectedFresh.city.id, status)}
              planningIntent={planningIntentByCity[selectedFresh.city.id]?.intent ?? null}
              onSetPlanningIntent={(intent) => setPlanningIntentForCity(selectedFresh.city.id, intent)}
              onSubmitPremiumInterest={savePremiumInterest}
              tripStyleMatch={tripStyleMatchByCity[selectedFresh.city.id] ?? null}
              zIndex={decisionDrawerOpen ? 2147483500 : undefined}
            />
          ) : null}
        </div>
      </div>

      {decisionDrawerOpen && typeof document !== "undefined"
        ? createPortal(
            <DecisionBoardDrawer
              items={decisionBoardItems}
              counts={shortlistCounts}
              onClose={() => setDecisionDrawerOpen(false)}
              onClear={clearShortlistStatuses}
              onOpenCity={(city) => {
                setSelected(city);
              }}
              onSetStatus={(cityId, status) => setShortlistStatus(cityId, status)}
              planningIntentByCity={planningIntentByCity}
              onSubmitPremiumInterest={savePremiumInterest}
              selectedTripStyles={selectedTripStyles}
              tripStyleMatchByCity={tripStyleMatchByCity}
            />,
            document.body
          )
        : null}

      {showSideCompare && typeof document !== "undefined"
        ? createPortal(
            <aside
              ref={comparePanelRef}
              className="fixed hidden w-[420px] min-[1024px]:block min-[1440px]:w-[460px]"
              style={{
                position: "fixed",
                top: 96,
                right: 24,
                bottom: 20,
                zIndex: 2147483000,
              }}
            >
              <PinnedComparePanel
                pinned={pinned}
                onClear={clearPinned}
                onClose={() => setCompareOpen(false)}
                onSelect={handleCompareSelect}
              />
            </aside>,
            document.body
          )
        : null}

      {showFloatingCompare && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              data-compare-toggle="true"
              onClick={() => setCompareOpen(true)}
              className="rounded-2xl border border-[#c8aa6e]/35 bg-[#070a0f]/95 px-5 py-3 text-sm font-semibold text-[#f1dfb8] shadow-[0_22px_70px_rgba(0,0,0,0.70)] backdrop-blur-xl transition hover:border-[#c8aa6e]/55 hover:bg-[#10161f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/35"
              style={{
                position: "fixed",
                right: 24,
                bottom: 24,
                zIndex: 2147483001,
              }}
              title="Open comparison"
            >
              Compare <span className="text-white/70">({pinned.length}/2)</span>
            </button>,
            document.body
          )
        : null}

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


function DecisionBoardDrawer({
  items,
  counts,
  onClose,
  onClear,
  onOpenCity,
  onSetStatus,
  planningIntentByCity,
  onSubmitPremiumInterest,
  selectedTripStyles,
  tripStyleMatchByCity,
}: {
  items: Array<{ city: ScoredCity; status: ShortlistStatus }>;
  counts: { shortlist: number; maybe: number; notThisTrip: number; total: number };
  onClose: () => void;
  onClear: () => void;
  onOpenCity: (city: ScoredCity) => void;
  onSetStatus: (cityId: string, status: ShortlistStatus | null) => void;
  planningIntentByCity: PlanningIntentByCity;
  onSubmitPremiumInterest: (request: PremiumInterestRequest) => void;
  selectedTripStyles: TripStyleId[];
  tripStyleMatchByCity: TripStyleMatchByCity;
}) {
  const saved = items.filter((item) => item.status === "shortlist");
  const maybe = items.filter((item) => item.status === "maybe");
  const passed = items.filter((item) => item.status === "not_this_trip");
  const topSaved = saved[0]?.city ?? null;
  const topMaybe = maybe[0]?.city ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trip decision board"
      className="fixed inset-0"
      style={{ zIndex: 2147483400 }}
    >
      <button
        type="button"
        aria-label="Close trip decision board"
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-black/72 backdrop-blur-[2px]"
      />

      <div className="absolute inset-x-3 bottom-3 top-3 mx-auto flex max-w-[1180px] overflow-hidden rounded-[34px] border border-white/[0.11] bg-[#05070b] shadow-[0_38px_130px_rgba(0,0,0,0.86)] ring-1 ring-white/[0.045] sm:inset-x-6 sm:bottom-6 sm:top-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(200,170,110,0.09),transparent_34%),radial-gradient(circle_at_70%_10%,rgba(16,185,129,0.07),transparent_32%),linear-gradient(180deg,#070a0f_0%,#05070b_52%,#06080c_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.22),rgba(200,170,110,0.62),transparent)]" />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/[0.08] bg-[#070a0f]/92 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c8aa6e] shadow-[0_0_16px_rgba(200,170,110,0.62)]" />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#c8aa6e]/78">
                    Trip decision board
                  </div>
                </div>

                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-white sm:text-4xl">
                  Review your decision set
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                  Saved cities are your strongest contenders. Maybe cities stay in consideration. Passed cities are kept here so your reasoning stays visible while you narrow the trip.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-[#11161d] text-lg leading-none text-white/70 transition hover:border-white/[0.18] hover:bg-[#171e27] hover:text-white"
                aria-label="Close decision board"
                title="Close decision board"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <DecisionMetric label="Saved" value={counts.shortlist} tone="saved" />
              <DecisionMetric label="Maybe" value={counts.maybe} tone="maybe" />
              <DecisionMetric label="Passed" value={counts.notThisTrip} tone="pass" />
              <DecisionMetric label="Total marked" value={counts.total} />
            </div>
          </header>

          <div className="relative flex-1 overflow-y-auto p-5 sm:p-6">
            {items.length > 0 ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                <div className="space-y-5">
                  <DecisionSection
                    title="Saved contenders"
                    subtitle="Best current candidates for the trip."
                    empty="No saved cities yet. Mark cities as Saved from the board or destination console."
                    items={saved}
                    onOpenCity={onOpenCity}
                    onSetStatus={onSetStatus}
                    planningIntentByCity={planningIntentByCity}
                  />

                  <DecisionSection
                    title="Maybe"
                    subtitle="Worth keeping around, but not top picks yet."
                    empty="No maybe cities yet."
                    items={maybe}
                    onOpenCity={onOpenCity}
                    onSetStatus={onSetStatus}
                    planningIntentByCity={planningIntentByCity}
                  />

                  <DecisionSection
                    title="Not this trip"
                    subtitle="Useful to remember what you ruled out."
                    empty="No passed cities yet."
                    items={passed}
                    onOpenCity={onOpenCity}
                    onSetStatus={onSetStatus}
                    planningIntentByCity={planningIntentByCity}
                  />
                </div>

                <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                  <FinalDecisionReviewCard
                    saved={saved}
                    maybe={maybe}
                    counts={counts}
                    planningIntentByCity={planningIntentByCity}
                    onOpenCity={onOpenCity}
                    onClose={onClose}
                    onSubmitPremiumInterest={onSubmitPremiumInterest}
                    selectedTripStyles={selectedTripStyles}
                    tripStyleMatchByCity={tripStyleMatchByCity}
                  />

                  <div className="rounded-[26px] border border-white/[0.09] bg-[#0b1017] p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/32">
                      Board actions
                    </div>

                    <button
                      type="button"
                      onClick={onClear}
                      className="mt-4 w-full rounded-2xl border border-white/[0.10] bg-[#11161d] px-4 py-3 text-sm font-semibold text-white/72 transition hover:border-rose-300/25 hover:bg-rose-400/[0.08] hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    >
                      Clear all decisions
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 w-full rounded-2xl border border-[#c8aa6e]/20 bg-[#c8aa6e]/[0.07] px-4 py-3 text-sm font-semibold text-[#f1dfb8] transition hover:border-[#c8aa6e]/34 hover:bg-[#c8aa6e]/[0.11] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/30"
                    >
                      Keep browsing
                    </button>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-[30px] border border-dashed border-white/[0.10] bg-[#0a0e13]/80 p-8 text-center">
                <div className="max-w-md">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#c8aa6e]/18 bg-[#c8aa6e]/[0.07] text-lg font-semibold text-[#f1dfb8]">
                    +
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">
                    No cities marked yet
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">
                    Use Save, Maybe, or Pass on city cards and destination reports to build your decision set.
                  </p>

                  <div className="mt-5 rounded-[22px] border border-[#c8aa6e]/14 bg-[#c8aa6e]/[0.055] p-4 text-left">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8aa6e]/72">
                      Final decision review
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white/78">
                      No shortlist yet
                    </div>
                    <div className="mt-1 text-xs leading-5 text-white/46">
                      Save at least one destination to identify a best current pick and final comparison note.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 rounded-2xl border border-[#c8aa6e]/20 bg-[#c8aa6e]/[0.07] px-5 py-3 text-sm font-semibold text-[#f1dfb8] transition hover:border-[#c8aa6e]/34 hover:bg-[#c8aa6e]/[0.11]"
                  >
                    Start browsing
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisionMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "saved" | "maybe" | "pass";
}) {
  const toneClass =
    tone === "saved"
      ? "border-emerald-300/14 bg-emerald-400/[0.07] text-emerald-100/82"
      : tone === "maybe"
        ? "border-[#c8aa6e]/16 bg-[#c8aa6e]/[0.065] text-[#f1dfb8]/82"
        : tone === "pass"
          ? "border-white/[0.08] bg-white/[0.04] text-white/60"
          : "border-white/[0.09] bg-white/[0.04] text-white/72";

  return (
    <div className={`rounded-[22px] border px-4 py-3 ${toneClass}`}>
      <div className="text-2xl font-semibold leading-none tracking-[-0.05em]">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/36">{label}</div>
    </div>
  );
}

function DecisionSection({
  title,
  subtitle,
  empty,
  items,
  onOpenCity,
  onSetStatus,
  planningIntentByCity,
}: {
  title: string;
  subtitle: string;
  empty: string;
  items: Array<{ city: ScoredCity; status: ShortlistStatus }>;
  onOpenCity: (city: ScoredCity) => void;
  onSetStatus: (cityId: string, status: ShortlistStatus | null) => void;
  planningIntentByCity: PlanningIntentByCity;
}) {
  return (
    <section className="rounded-[28px] border border-white/[0.09] bg-[#0b1017] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8aa6e]/70">{title}</div>
          <div className="mt-1 text-sm leading-6 text-white/42">{subtitle}</div>
        </div>
        <div className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/52">
          {items.length}
        </div>
      </div>

      {items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <DecisionCityCard
              key={item.city.city.id}
              city={item.city}
              status={item.status}
              planningIntent={planningIntentByCity[item.city.city.id]?.intent ?? null}
              onOpen={() => onOpenCity(item.city)}
              onSetStatus={(status) => onSetStatus(item.city.city.id, status)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[22px] border border-dashed border-white/[0.09] bg-black/18 p-5 text-sm leading-6 text-white/42">
          {empty}
        </div>
      )}
    </section>
  );
}

function DecisionCityCard({
  city,
  status,
  planningIntent,
  onOpen,
  onSetStatus,
}: {
  city: ScoredCity;
  status: ShortlistStatus;
  planningIntent: PlanningIntent | null;
  onOpen: () => void;
  onSetStatus: (status: ShortlistStatus | null) => void;
}) {
  const budget = budgetBadge(city);
  const strongest = topDrivers(city, 3);

  return (
    <article className="rounded-[24px] border border-white/[0.09] bg-[#080c12] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold tracking-[-0.03em] text-white">{city.city.name}</div>
          <div className="mt-1 truncate text-sm text-white/48">{city.city.country}</div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Score</div>
          <div className="mt-1 text-2xl font-semibold leading-none tracking-[-0.06em] text-white">{scoreOf(city)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CompareBadge tone={budget.tone}>{budget.label}</CompareBadge>
        {budget.value ? <CompareBadge tone={budget.tone}>{budget.value}</CompareBadge> : null}
        <CompareBadge>Tier {tierOf(city)}</CompareBadge>
        <CompareBadge>{shortlistStatusDescription(status)}</CompareBadge>
        {planningIntent ? (
          <CompareBadge>Planning: {planningIntentBadgeLabel(planningIntent)}</CompareBadge>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">Strongest reasons</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {strongest.map((item) => (
            <CompareBadge key={item.key}>{item.label}</CompareBadge>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-2xl border border-[#c8aa6e]/18 bg-[#c8aa6e]/[0.065] px-3 py-2 text-sm font-semibold text-[#f1dfb8] transition hover:border-[#c8aa6e]/32 hover:bg-[#c8aa6e]/[0.095] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/30"
        >
          Open report
        </button>

        <button
          type="button"
          onClick={() => onSetStatus(null)}
          className="rounded-2xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white/58 transition hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-white/78 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          Remove
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <DecisionStatusMiniButton active={status === "shortlist"} onClick={() => onSetStatus("shortlist")}>Saved</DecisionStatusMiniButton>
        <DecisionStatusMiniButton active={status === "maybe"} onClick={() => onSetStatus("maybe")}>Maybe</DecisionStatusMiniButton>
        <DecisionStatusMiniButton active={status === "not_this_trip"} onClick={() => onSetStatus("not_this_trip")}>Pass</DecisionStatusMiniButton>
      </div>
    </article>
  );
}

function DecisionStatusMiniButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-2 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "border-[#c8aa6e]/28 bg-[#c8aa6e]/[0.10] text-[#f1dfb8]"
          : "border-white/[0.08] bg-white/[0.025] text-white/46 hover:border-white/[0.14] hover:bg-white/[0.045] hover:text-white/70",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function FinalDecisionReviewCard({
  saved,
  maybe,
  counts,
  planningIntentByCity,
  onOpenCity,
  onClose,
  onSubmitPremiumInterest,
  selectedTripStyles,
  tripStyleMatchByCity,
}: {
  saved: Array<{ city: ScoredCity; status: ShortlistStatus }>;
  maybe: Array<{ city: ScoredCity; status: ShortlistStatus }>;
  counts: { shortlist: number; maybe: number; notThisTrip: number; total: number };
  planningIntentByCity: PlanningIntentByCity;
  onOpenCity: (city: ScoredCity) => void;
  onClose: () => void;
  onSubmitPremiumInterest: (request: PremiumInterestRequest) => void;
  selectedTripStyles: TripStyleId[];
  tripStyleMatchByCity: TripStyleMatchByCity;
}) {
  const topSaved = saved[0]?.city ?? null;
  const topMaybe = maybe[0]?.city ?? null;
  const bestPick = topSaved ?? topMaybe;
  const bestPickSource = topSaved ? "saved set" : topMaybe ? "maybe set" : null;
  const savedAndMaybe = [...saved, ...maybe];
  const planningCounts = savedAndMaybe.reduce(
    (acc, item) => {
      const intent = planningIntentByCity[item.city.city.id]?.intent ?? null;
      if (intent) acc[intent] += 1;
      return acc;
    },
    { track: 0, prepare_options: 0, compare_hotels: 0 } as Record<PlanningIntent, number>
  );
  const planningSummaries = (Object.keys(planningCounts) as PlanningIntent[])
    .filter((intent) => planningCounts[intent] > 0)
    .map((intent) => planningIntentSummaryLabel(intent, planningCounts[intent]));
  const styleInsight = decisionTripStyleInsight({
    items: savedAndMaybe,
    selectedTripStyles,
    tripStyleMatchByCity,
  });

  const bestScore = bestPick ? scoreOf(bestPick) : 0;
  const hasPlanningIntent = planningSummaries.length > 0;
  const showPremiumInterest = counts.shortlist > 0 || hasPlanningIntent;
  const showPremiumReportPreview = counts.shortlist > 0 || counts.maybe > 0 || hasPlanningIntent;

  const quality =
    counts.shortlist === 0 && counts.maybe === 0
      ? "No shortlist yet"
      : counts.shortlist >= 2 && bestScore >= 88 && hasPlanningIntent
        ? "Strong shortlist"
        : counts.shortlist >= 1 && bestScore >= 84
          ? "Still narrowing"
          : "Needs more review";

  const summary =
    counts.shortlist > 0
      ? `You have ${counts.shortlist} saved destination${counts.shortlist === 1 ? "" : "s"} and ${counts.maybe} maybe${counts.maybe === 1 ? "" : "s"} still worth reviewing.`
      : counts.maybe > 0
        ? `You have ${counts.maybe} maybe destination${counts.maybe === 1 ? "" : "s"} in consideration, but no saved contender yet.`
        : "Start by saving at least one destination to build a final review.";

  const tradeoffNote =
    counts.shortlist >= 2
      ? "Your top choices are close enough to deserve a final comparison pass."
      : counts.shortlist === 1 && hasPlanningIntent
        ? "You have strong fit; check planning cost and intent before moving forward."
        : counts.maybe > 0
          ? "Review maybe cities and promote one clear contender when the fit feels right."
          : "Start by saving at least one destination to build a final review.";

  return (
    <div className="rounded-[26px] border border-[#c8aa6e]/16 bg-[#c8aa6e]/[0.045] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8aa6e]/74">
            Final decision review
          </div>
          <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white/92">
            {quality}
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-[#c8aa6e]/18 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f1dfb8]/70">
          Advisor read
        </span>
      </div>

      {bestPick ? (
        <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-[#080c12]/82 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
            Best current pick
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-white/90">
                {bestPick.city.name}
              </div>
              <div className="mt-1 text-xs leading-5 text-white/46">
                Based on your {bestPickSource}, this destination currently has the strongest overall alignment.
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xl font-semibold leading-none tracking-[-0.05em] text-white">
                {scoreOf(bestPick)}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/32">
                Tier {tierOf(bestPick)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[22px] border border-dashed border-white/[0.10] bg-[#080c12]/60 p-4">
          <div className="text-sm font-semibold text-white/76">No best pick yet</div>
          <p className="mt-2 text-sm leading-6 text-white/46">
            Save or mark a destination as Maybe to unlock a final decision read.
          </p>
        </div>
      )}

      <p className="mt-4 text-sm leading-6 text-white/58">{summary}</p>

      <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-black/18 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">
          Next comparison note
        </div>
        <div className="mt-2 text-sm leading-6 text-white/56">{tradeoffNote}</div>
      </div>

      {styleInsight ? (
        <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-black/18 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">
            {styleInsight.title}
          </div>
          <div className="mt-2 text-sm leading-6 text-white/56">{styleInsight.body}</div>
          <div className="mt-3 text-[11px] leading-5 text-white/34">
            Trip style is applied after base alignment to shape recommendation order.
            It does not change the underlying scoring model.
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {planningSummaries.length > 0 ? (
          planningSummaries.slice(0, 2).map((summaryLine) => (
            <div
              key={summaryLine}
              className="rounded-2xl border border-emerald-400/12 bg-emerald-400/[0.055] px-3 py-2 text-xs leading-5 text-emerald-50/76"
            >
              {summaryLine}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs leading-5 text-white/40">
            No planning intent saved on Saved or Maybe destinations yet.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2">
        {bestPick ? (
          <button
            type="button"
            onClick={() => onOpenCity(bestPick)}
            className="rounded-2xl border border-[#c8aa6e]/20 bg-[#c8aa6e]/[0.075] px-4 py-3 text-sm font-semibold text-[#f1dfb8] transition hover:border-[#c8aa6e]/34 hover:bg-[#c8aa6e]/[0.11] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/30"
          >
            Open top report
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white/62 transition hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-white/82 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          {counts.maybe > 0 && counts.shortlist === 0 ? "Review maybe cities" : "Continue narrowing"}
        </button>
      </div>

      {counts.shortlist >= 2 ? (
        <div className="mt-3 text-[11px] leading-5 text-white/36">
          To compare saved cities, pin two contenders from the board or results view.
        </div>
      ) : null}

      {showPremiumReportPreview ? (
        <DecisionReportPreview
          bestPick={bestPick}
          onSubmitPremiumInterest={onSubmitPremiumInterest}
        />
      ) : null}

      {showPremiumInterest ? (
        <>
          <DecisionPremiumPreview hasPlanningIntent={hasPlanningIntent} />
          <DecisionReviewInterestCapture
            bestPick={bestPick}
            hasPlanningIntent={hasPlanningIntent}
            onSubmitPremiumInterest={onSubmitPremiumInterest}
          />
        </>
      ) : null}

      <div className="mt-4 border-t border-white/[0.06] pt-4 text-[11px] leading-5 text-white/34">
        Final Decision Review summarizes your saved set. It does not override your
        rankings or change the scoring model.
      </div>
    </div>
  );
}

function DecisionReviewInterestCapture({
  bestPick,
  hasPlanningIntent,
  onSubmitPremiumInterest,
}: {
  bestPick: ScoredCity | null;
  hasPlanningIntent: boolean;
  onSubmitPremiumInterest: (request: PremiumInterestRequest) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [selectedInterestType, setSelectedInterestType] = useState<PremiumInterestType>(
    hasPlanningIntent ? "hotel_fit" : "shortlist_review"
  );

  useEffect(() => {
    setSelectedInterestType(hasPlanningIntent ? "hotel_fit" : "shortlist_review");
  }, [hasPlanningIntent]);

  return (
    <form
      noValidate
      className="mt-4 rounded-[22px] border border-[#c8aa6e]/14 bg-[#c8aa6e]/[0.045] p-4"
      onSubmit={(event) => {
        event.preventDefault();

        const cleanEmail = email.trim();

        if (!isValidEmail(cleanEmail)) {
          setError("Enter a valid email to request access.");
          setSubmitted(false);
          return;
        }

        onSubmitPremiumInterest({
          email: cleanEmail,
          cityId: bestPick?.city.id,
          cityName: bestPick?.city.name,
          source: "decision_review",
          interestType: selectedInterestType,
        });

        setError("");
        setSubmitted(true);
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/74">
        Premium planning access
      </div>

      <div className="mt-2 text-xs leading-5 text-white/48">
        Request early access to future booking intelligence for hotel quality,
        flight convenience, neighborhood fit, and timing risk. This helps us
        understand which premium planning tools would be most useful.
      </div>

      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
          Most useful area
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {DECISION_REVIEW_PREMIUM_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.description}
              onClick={() => {
                setSelectedInterestType(option.id);
                setSubmitted(false);
              }}
              className={[
                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/25",
                selectedInterestType === option.id
                  ? "border-[#c8aa6e]/30 bg-[#c8aa6e]/[0.12] text-[#f1dfb8]"
                  : "border-white/[0.09] bg-white/[0.035] text-white/50 hover:border-white/[0.16] hover:text-white/72",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <input
          type="text"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError("");
            if (submitted) setSubmitted(false);
          }}
          placeholder="you@example.com"
          className="h-10 min-w-0 rounded-[14px] border border-white/[0.10] bg-[#080c12] px-3 text-sm font-medium text-white/82 outline-none transition placeholder:text-white/28 focus:border-[#c8aa6e]/42"
        />

        <button
          type="submit"
          className="rounded-2xl border border-[#c8aa6e]/20 bg-[#c8aa6e]/[0.075] px-4 py-2.5 text-sm font-semibold text-[#f1dfb8] transition hover:border-[#c8aa6e]/34 hover:bg-[#c8aa6e]/[0.11] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/30"
        >
          Request early access
        </button>
      </div>

      {error ? <div className="mt-2 text-xs leading-5 text-rose-100/74">{error}</div> : null}

      {submitted ? (
        <div className="mt-3 rounded-[16px] border border-emerald-400/16 bg-emerald-400/[0.08] px-3 py-2 text-xs leading-5 text-emerald-50/82">
          Request saved. Premium planning access is not live yet; this only
          records your interest in future planning intelligence.
        </div>
      ) : null}

      <div className="mt-3 text-[11px] leading-5 text-white/36">
        No booking links. No paid placement. This is only for future planning
        intelligence.
      </div>
    </form>
  );
}

function DecisionReportPreview({
  bestPick,
  onSubmitPremiumInterest,
}: {
  bestPick: ScoredCity | null;
  onSubmitPremiumInterest: (request: PremiumInterestRequest) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const selectedReportModules = [
    "executive_verdict",
    "hotel_zone_guidance",
    "flight_timing_risk",
    "value_planning_risk",
    "shortlist_comparison",
  ];

  return (
    <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-[#080c12]/74 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/72">
        Premium report preview
      </div>

      <div className="mt-2 text-xs leading-5 text-white/48">
        You are building a decision set. A future premium report could help make the
        final call with an advisor-style verdict, stay-area guidance, flight timing
        risk, value context, and clearer shortlist tradeoffs.
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          "Executive verdict",
          "Stay-area guidance",
          "Flight timing risk",
          "Value risk",
          "Shortlist comparison",
        ].map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] font-semibold text-white/48"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.06] pt-3">
        <button
          type="button"
          onClick={() => {
            onSubmitPremiumInterest({
              cityId: bestPick?.city.id,
              cityName: bestPick?.city.name,
              source: "decision_review",
              interestType: "premium_report",
              selectedReportModules,
            });
            setSubmitted(true);
          }}
          className={[
            "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/30",
            submitted
              ? "border-emerald-300/18 bg-emerald-400/[0.08] text-emerald-50/82"
              : "border-[#c8aa6e]/20 bg-[#c8aa6e]/[0.075] text-[#f1dfb8] hover:border-[#c8aa6e]/34 hover:bg-[#c8aa6e]/[0.11]",
          ].join(" ")}
        >
          {submitted ? "Report interest saved" : "Save report interest"}
        </button>

        {submitted ? (
          <div className="rounded-[16px] border border-emerald-400/16 bg-emerald-400/[0.08] px-3 py-2 text-xs leading-5 text-emerald-50/82">
            Premium report interest saved. Reports are not live yet, but this
            decision set is marked for future premium review.
          </div>
        ) : null}

        <div className="text-[11px] leading-5 text-white/34">
          This does not change your alignment score or ranking.
        </div>
      </div>
    </div>
  );
}

function DecisionPremiumPreview({ hasPlanningIntent }: { hasPlanningIntent: boolean }) {
  return (
    <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-black/18 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/72">
        Premium decision support
      </div>
      <div className="mt-2 text-xs leading-5 text-white/48">
        Your shortlist is taking shape. Future premium planning may help pressure-test
        hotel fit, flight convenience, stay-area match, and the final saved-city
        tradeoff before moving to live booking sites.
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["Hotel fit", "Flight convenience", "Stay-area fit", "Shortlist review"].map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] font-semibold text-white/48"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="mt-3 text-[11px] leading-5 text-white/34">
        Premium planning access is not live yet. Planning interest does not affect
        your alignment score{hasPlanningIntent ? " or saved planning intent" : ""}.
      </div>
    </div>
  );
}

const COMPARISON_DRIVERS: Array<{
  key: DriverKey;
  label: string;
}> = [
  { key: "flight", label: "Flights" },
  { key: "hotel", label: "Hotels" },
  { key: "diningValue", label: "Dining value" },
  { key: "culinaryDensity", label: "Food depth" },
  { key: "shopping", label: "Shopping" },
  { key: "safetyTransit", label: "Safety + transit" },
  { key: "weather", label: "Weather" },
  { key: "crowds", label: "Low crowds" },
];

type ComparisonWinner = "first" | "second" | "even";

function driverScore(city: ScoredCity, key: DriverKey) {
  return Math.round(componentOf(city, key));
}

function topDrivers(city: ScoredCity, limit = 3) {
  return [...COMPARISON_DRIVERS]
    .map((driver) => ({
      ...driver,
      score: driverScore(city, driver.key),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function weakDrivers(city: ScoredCity, limit = 2) {
  return [...COMPARISON_DRIVERS]
    .map((driver) => ({
      ...driver,
      score: driverScore(city, driver.key),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

function comparisonEdges(first: ScoredCity, second: ScoredCity) {
  return COMPARISON_DRIVERS.map((driver) => {
    const firstScore = driverScore(first, driver.key);
    const secondScore = driverScore(second, driver.key);
    const delta = firstScore - secondScore;

    let winner: ComparisonWinner = "even";
    if (Math.abs(delta) >= 4) winner = delta > 0 ? "first" : "second";

    return {
      ...driver,
      firstScore,
      secondScore,
      delta,
      absoluteDelta: Math.abs(delta),
      winner,
    };
  });
}

function winnerName(winner: ComparisonWinner, first: ScoredCity, second: ScoredCity) {
  if (winner === "first") return first.city.name;
  if (winner === "second") return second.city.name;
  return "Similar";
}

function formatList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function sharedStrengths(first: ScoredCity, second: ScoredCity) {
  const firstTop = topDrivers(first, 3).map((d) => d.label);
  const secondTop = topDrivers(second, 3).map((d) => d.label);

  return firstTop.filter((item) => secondTop.includes(item));
}

function uniqueStrengths(city: ScoredCity, other: ScoredCity) {
  const cityTop = topDrivers(city, 4).map((d) => d.label);
  const otherTop = topDrivers(other, 4).map((d) => d.label);

  return cityTop.filter((item) => !otherTop.includes(item)).slice(0, 3);
}

function costContextOf(city: ScoredCity) {
  const scored = city as any;
  const cityData = scored?.city ?? scored ?? {};
  const raw = cityData?.costContext ?? scored?.costContext ?? null;

  const toNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const roundToNearest25 = (value: number) => Math.round(value / 25) * 25;

  const normalizeRange = (value: unknown): [number, number] | null => {
    if (!isUsdRange(value)) return null;

    const low = Math.min(value[0], value[1]);
    const high = Math.max(value[0], value[1]);

    return [roundToNearest25(low), roundToNearest25(high)];
  };

  const derivedHotelRange = (): [number, number] | null => {
    const fourStar = toNumber(cityData?.avg4StarPriceUsd);
    const fiveStar = toNumber(cityData?.avg5StarPriceUsd);

    if (fourStar !== null && fiveStar !== null) {
      return [
        roundToNearest25(Math.min(fourStar, fiveStar)),
        roundToNearest25(Math.max(fourStar, fiveStar)),
      ];
    }

    if (fourStar !== null) {
      return [
        roundToNearest25(fourStar * 0.85),
        roundToNearest25(fourStar * 1.35),
      ];
    }

    if (fiveStar !== null) {
      return [
        roundToNearest25(fiveStar * 0.55),
        roundToNearest25(fiveStar),
      ];
    }

    return null;
  };

  const derivedFlightRange = (airport: "nyc" | "phl"): [number, number] | null => {
    const base =
      toNumber(cityData?.flightFrom?.[airport]) ??
      toNumber(cityData?.flightFrom?.[airport.toUpperCase?.()]) ??
      toNumber(raw?.flightFrom?.[airport]) ??
      toNumber(raw?.flightFrom?.[airport.toUpperCase?.()]);

    if (base === null) return null;

    return [
      roundToNearest25(base),
      roundToNearest25(base * 1.5),
    ];
  };

  const hotelNightlyRangeUsd =
    normalizeRange(raw?.hotelNightlyRangeUsd) ??
    normalizeRange(raw?.hotelRangeUsd) ??
    normalizeRange(raw?.hotels) ??
    derivedHotelRange();

  const flightRoundTripRangeUsd = {
    nyc:
      normalizeRange(raw?.flightRoundTripRangeUsd?.nyc) ??
      normalizeRange(raw?.flightRangeUsd?.nyc) ??
      normalizeRange(raw?.flights?.nyc) ??
      derivedFlightRange("nyc"),

    phl:
      normalizeRange(raw?.flightRoundTripRangeUsd?.phl) ??
      normalizeRange(raw?.flightRangeUsd?.phl) ??
      normalizeRange(raw?.flights?.phl) ??
      derivedFlightRange("phl"),
  };

  return {
    hotelNightlyRangeUsd,
    flightRoundTripRangeUsd,
    confidence: raw?.confidence ?? "medium",
    note:
      raw?.note ??
      "Planning estimate only; actual prices vary by season, dates, airport choice, events, and booking window.",
  };
}

function isUsdRange(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function formatUsdRange(value: unknown) {
  if (!isUsdRange(value)) return "—";
  return `${formatUsd(value[0])}–${formatUsd(value[1])}`;
}

function rangeMidpoint(value: unknown) {
  if (!isUsdRange(value)) return null;
  return (value[0] + value[1]) / 2;
}

function lowerCostWinner(firstRange: unknown, secondRange: unknown, first: ScoredCity, second: ScoredCity) {
  const a = rangeMidpoint(firstRange);
  const b = rangeMidpoint(secondRange);

  if (a === null || b === null) return "Insufficient data";
  if (Math.abs(a - b) < 25) return "Similar";

  return a < b ? first.city.name : second.city.name;
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

          {first && second ? (
            <ComparisonDecisionSuite first={first} second={second} />
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/[0.10] bg-[#0a0e13] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/32">
                Decision read
              </div>
              <div className="mt-2 text-sm leading-6 text-white/48">
                Pin a second city to unlock the side-by-side decision breakdown.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-3 border-t border-white/[0.08] bg-[#05070a] p-5">
        <ComparePanelButton onClick={onClear}>Clear comparison</ComparePanelButton>
        <ComparePanelButton onClick={onClose}>Done</ComparePanelButton>
      </div>
    </div>
  );
}

function ComparisonDecisionSuite({
  first,
  second,
}: {
  first: ScoredCity;
  second: ScoredCity;
}) {
  return (
    <div className="space-y-4">
      <RecommendedPick first={first} second={second} />
      <ComparisonSummary first={first} second={second} />
      <CategoryEdgeBreakdown first={first} second={second} />
      <ChooseForCards first={first} second={second} />
      <PlanningCostComparison first={first} second={second} />
      <FinalDecisionNote first={first} second={second} />
    </div>
  );
}

function RecommendedPick({
  first,
  second,
}: {
  first: ScoredCity;
  second: ScoredCity;
}) {
  const diff = scoreOf(first) - scoreOf(second);

  const leader = diff > 0 ? first : diff < 0 ? second : null;
  const other = diff > 0 ? second : diff < 0 ? first : null;

  const overlap = sharedStrengths(first, second);
  const firstUnique = uniqueStrengths(first, second);
  const secondUnique = uniqueStrengths(second, first);

  return (
    <section className="rounded-[24px] border border-[#c8aa6e]/18 bg-[#c8aa6e]/[0.055] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8aa6e]/78">
          Recommended pick
        </div>

        <span className="rounded-full border border-[#c8aa6e]/18 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f1dfb8]/70">
          Decision read
        </span>
      </div>

      {leader && other ? (
        <>
          <div className="mt-3 text-lg font-semibold tracking-[-0.02em] text-white">
            {leader.city.name}
          </div>

          <p className="mt-2 text-sm leading-6 text-white/58">
            {leader.city.name} has the stronger visible alignment by{" "}
            <span className="font-semibold text-white/80">
              {Math.abs(diff)} point{Math.abs(diff) === 1 ? "" : "s"}
            </span>
            . Use {other.city.name} only if its specific category edges matter more for this trip.
          </p>
        </>
      ) : (
        <>
          <div className="mt-3 text-lg font-semibold tracking-[-0.02em] text-white">
            Situational match
          </div>

          <p className="mt-2 text-sm leading-6 text-white/58">
            {first.city.name} and {second.city.name} are tied on visible alignment score.{" "}
            {overlap.length >= 2 ? (
              <>Their strongest drivers overlap, so the choice should come down to the key differences below.</>
            ) : (
              <>
                Use the key differences below to decide whether{" "}
                <span className="font-semibold text-[#f1dfb8]">
                  {firstUnique.length ? formatList(firstUnique) : first.city.name}
                </span>{" "}
                or{" "}
                <span className="font-semibold text-[#f1dfb8]">
                  {secondUnique.length ? formatList(secondUnique) : second.city.name}
                </span>{" "}
                better matches the trip.
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}

function ComparisonSummary({
  first,
  second,
}: {
  first: ScoredCity;
  second: ScoredCity;
}) {
  const rows = comparisonEdges(first, second);
  const firstEdges = rows
    .filter((row) => row.winner === "first")
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
    .slice(0, 3)
    .map((row) => row.label);

  const secondEdges = rows
    .filter((row) => row.winner === "second")
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
    .slice(0, 3)
    .map((row) => row.label);

  return (
    <section className="rounded-[24px] border border-white/[0.09] bg-[#0b1017] p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/32">
        Decision summary
      </div>

      <p className="mt-3 text-sm leading-6 text-white/58">
        {firstEdges.length > 0 ? (
          <>
            <span className="font-semibold text-white/82">{first.city.name}</span> is stronger for{" "}
            <span className="font-semibold text-[#f1dfb8]">{formatList(firstEdges)}</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-white/82">{first.city.name}</span> has fewer clear category edges
          </>
        )}
        ;{" "}
        {secondEdges.length > 0 ? (
          <>
            <span className="font-semibold text-white/82">{second.city.name}</span> is stronger for{" "}
            <span className="font-semibold text-[#f1dfb8]">{formatList(secondEdges)}</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-white/82">{second.city.name}</span> has fewer clear category edges
          </>
        )}
        .
      </p>
    </section>
  );
}

function CategoryEdgeBreakdown({
  first,
  second,
}: {
  first: ScoredCity;
  second: ScoredCity;
}) {
  const rows = comparisonEdges(first, second);

  const keyDifferences = rows
    .filter((row) => row.winner !== "even")
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
    .slice(0, 5);

  const similarAreas = rows
    .filter((row) => row.winner === "even")
    .sort((a, b) => a.absoluteDelta - b.absoluteDelta)
    .slice(0, 4);

  return (
    <section className="rounded-[24px] border border-white/[0.09] bg-[#0b1017] p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/32">
        Category edge breakdown
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/70">
          Key differences
        </div>

        <div className="mt-2 space-y-2">
          {keyDifferences.length > 0 ? (
            keyDifferences.map((row) => (
              <ComparisonEdgeRow key={row.key} row={row} first={first} second={second} />
            ))
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-black/18 px-3 py-3 text-sm text-white/46">
              No category has a major edge. This is a close-fit comparison.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
          Similar areas
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {similarAreas.length > 0 ? (
            similarAreas.map((row) => (
              <span
                key={row.key}
                className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/52"
              >
                {row.label}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/52">
              Few overlapping areas
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function ComparisonEdgeRow({
  row,
  first,
  second,
}: {
  row: ReturnType<typeof comparisonEdges>[number];
  first: ScoredCity;
  second: ScoredCity;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl border border-white/[0.07] bg-black/18 px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white/78">{row.label}</div>
        <div className="mt-1 text-xs text-white/38">
          {first.city.name}: {row.firstScore} · {second.city.name}: {row.secondScore}
        </div>
      </div>

      <div
        className={[
          "self-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
          row.winner === "even"
            ? "border-white/[0.10] bg-white/[0.04] text-white/48"
            : "border-[#c8aa6e]/20 bg-[#c8aa6e]/10 text-[#f1dfb8]",
        ].join(" ")}
      >
        {winnerName(row.winner, first, second)}
      </div>
    </div>
  );
}

function ChooseForCards({
  first,
  second,
}: {
  first: ScoredCity;
  second: ScoredCity;
}) {
  return (
    <section className="grid gap-4">
      <ChooseForCard city={first} label="Choose this for" />
      <ChooseForCard city={second} label="Choose this for" />
    </section>
  );
}

function ChooseForCard({
  city,
  label,
}: {
  city: ScoredCity;
  label: string;
}) {
  const strengths = topDrivers(city, 3);
  const tradeoffs = weakDrivers(city, 2);

  return (
    <div className="rounded-[24px] border border-white/[0.09] bg-[#0b1017] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/32">
            {label}
          </div>
          <div className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white">
            {city.city.name}
          </div>
        </div>

        <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/58">
          {scoreOf(city)}/100
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/70">
          Strongest reasons
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {strengths.map((item) => (
            <CompareBadge key={item.key}>{item.label}</CompareBadge>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
          Main tradeoffs
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {tradeoffs.map((item) => (
            <CompareBadge key={item.key}>{item.label}</CompareBadge>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanningCostComparison({
  first,
  second,
}: {
  first: ScoredCity;
  second: ScoredCity;
}) {
  const firstCost = costContextOf(first);
  const secondCost = costContextOf(second);

  const rows = [
    {
      label: "Hotels",
      first: firstCost?.hotelNightlyRangeUsd,
      second: secondCost?.hotelNightlyRangeUsd,
      helper: "Estimated nightly range",
    },
    {
      label: "NYC flights",
      first: firstCost?.flightRoundTripRangeUsd?.nyc,
      second: secondCost?.flightRoundTripRangeUsd?.nyc,
      helper: "Estimated round-trip range",
    },
    {
      label: "PHL flights",
      first: firstCost?.flightRoundTripRangeUsd?.phl,
      second: secondCost?.flightRoundTripRangeUsd?.phl,
      helper: "Estimated round-trip range",
    },
  ];

  return (
    <section className="rounded-[24px] border border-[#c8aa6e]/16 bg-[#c8aa6e]/[0.045] p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8aa6e]/74">
        Planning cost comparison
      </div>

      <div className="mt-3 text-sm leading-6 text-white/52">
        Hotel and flight ranges are planning estimates, not live booking prices.
        Use them to compare relative trip fit before checking real-time availability.
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-[20px] border border-white/[0.08] bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/78">{row.label}</div>
                <div className="mt-1 text-xs text-white/36">{row.helper}</div>
              </div>

              <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/48">
                Edge: {lowerCostWinner(row.first, row.second, first, second)}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.07] bg-[#080c12] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">
                  {first.city.name}
                </div>
                <div className="mt-2 text-sm font-semibold text-white/80">
                  {formatUsdRange(row.first)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#080c12] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">
                  {second.city.name}
                </div>
                <div className="mt-2 text-sm font-semibold text-white/80">
                  {formatUsdRange(row.second)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalDecisionNote({
  first,
  second,
}: {
  first: ScoredCity;
  second: ScoredCity;
}) {
  const rows = comparisonEdges(first, second);

  const firstEdges = rows
    .filter((row) => row.winner === "first")
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
    .map((row) => row.label)
    .slice(0, 3);

  const secondEdges = rows
    .filter((row) => row.winner === "second")
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
    .map((row) => row.label)
    .slice(0, 3);

  const diff = scoreOf(first) - scoreOf(second);

  return (
    <section className="rounded-[24px] border border-white/[0.09] bg-[#0b1017] p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/32">
        Final decision note
      </div>

      <p className="mt-3 text-sm leading-6 text-white/58">
        {Math.abs(diff) >= 2 ? (
          <>
            Pick{" "}
            <span className="font-semibold text-white/82">
              {diff > 0 ? first.city.name : second.city.name}
            </span>{" "}
            if you want the stronger overall alignment score. Pick{" "}
            <span className="font-semibold text-white/82">
              {diff > 0 ? second.city.name : first.city.name}
            </span>{" "}
            only if its specific category strengths matter more for this trip.
          </>
        ) : (
          <>
            This is a close decision. Choose{" "}
            <span className="font-semibold text-white/82">{first.city.name}</span>
            {firstEdges.length ? ` for ${formatList(firstEdges)}` : ""}, or choose{" "}
            <span className="font-semibold text-white/82">{second.city.name}</span>
            {secondEdges.length ? ` for ${formatList(secondEdges)}` : ""}.
          </>
        )}
      </p>
    </section>
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
    <button
      type="button"
      onClick={onSelect}
      className="group relative w-full overflow-hidden rounded-[26px] border border-white/[0.10] bg-[#0d1219] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-[#c8aa6e]/30 hover:bg-[#10161f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/35"
      title={`Open ${city.city.name}`}
    >
      <div
        className={[
          "absolute inset-y-5 left-0 w-[3px] rounded-r-full",
          slot === 1 ? "bg-[#c8aa6e]" : "bg-[#8f9fb0]",
        ].join(" ")}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.14),transparent)]" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">
            Slot {slot}
          </div>

          <div className="mt-4 truncate text-lg font-semibold tracking-[-0.02em] text-white transition group-hover:text-[#f1dfb8]">
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

        <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/62 transition group-hover:border-[#c8aa6e]/35 group-hover:bg-[#c8aa6e]/10 group-hover:text-[#f1dfb8]">
          Open →
        </span>
      </div>
    </button>
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
      className="h-11 rounded-[16px] border border-white/10 bg-[#11161d] px-3 text-sm font-semibold text-white/78 transition hover:border-white/16 hover:bg-[#171e27] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
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
            : "border-white/[0.10] bg-white/[0.04] text-white/62",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
