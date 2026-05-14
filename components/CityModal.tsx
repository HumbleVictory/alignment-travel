// components/CityModal.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { ScoredCity } from "@/lib/scoring";
import type { CityPremiumInsight } from "@/data/cities";
import { joinStyleLabels, type TripStyleMatch } from "@/lib/tripStyles";

export type CityFeedback = "love" | "maybe" | "pass";

type ShortlistStatus = "shortlist" | "maybe" | "not_this_trip";

type DriverKey =
  | "flight"
  | "hotel"
  | "diningValue"
  | "culinaryDensity"
  | "shopping"
  | "safetyTransit"
  | "weather"
  | "crowds";

type Layer = "verdict" | "drivers" | "impact";
type PersonalizationStep = 1 | 2 | 3;
export type PlanningIntent = "track" | "prepare_options" | "compare_hotels";
export type PremiumInterestSource = "destination_console" | "decision_review";
export type PremiumInterestType =
  | "premium_planning"
  | "hotel_comparison"
  | "booking_intelligence"
  | "hotel_fit"
  | "flight_convenience"
  | "neighborhood_guidance"
  | "shortlist_review"
  | "advisor_handoff"
  | "premium_report";
export type PremiumInterestRequest = {
  email?: string;
  cityId?: string;
  cityName?: string;
  source: PremiumInterestSource;
  interestType: PremiumInterestType;
  selectedReportModules?: string[];
};

const PREMIUM_INTEREST_OPTIONS: Array<{
  id: PremiumInterestType;
  label: string;
  description: string;
}> = [
  {
    id: "hotel_fit",
    label: "Hotel fit",
    description: "Quality, location, and value signals.",
  },
  {
    id: "flight_convenience",
    label: "Flight convenience",
    description: "Routing, timing, and travel effort.",
  },
  {
    id: "neighborhood_guidance",
    label: "Neighborhood guidance",
    description: "Stay-area fit for your trip style.",
  },
  {
    id: "shortlist_review",
    label: "Final shortlist review",
    description: "Tradeoffs across saved destinations.",
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

const PREMIUM_PLANNING_PILLARS: Array<{
  title: string;
  body: string;
}> = [
  {
    title: "Hotel Fit Intelligence",
    body: "Compare hotel quality, neighborhood fit, and value signals before moving to live booking sites.",
  },
  {
    title: "Flight Convenience Review",
    body: "Review routing complexity, timing risk, and realistic travel effort before committing.",
  },
  {
    title: "Neighborhood Guidance",
    body: "Identify stay areas that fit your trip style, comfort level, and budget expectations.",
  },
  {
    title: "Final Shortlist Review",
    body: "Turn saved destinations into a cleaner final decision with tradeoff summaries and planning risk notes.",
  },
];

const PREMIUM_REPORT_MODULES: Array<{
  id: string;
  title: string;
  body: string;
}> = [
  {
    id: "executive_verdict",
    title: "Executive destination verdict",
    body: "A concise advisor-style verdict on whether this destination deserves to stay in your final shortlist.",
  },
  {
    id: "hotel_zone_guidance",
    title: "Hotel zone guidance",
    body: "Future reports could identify stay areas that better match your travel style, budget expectations, and comfort level.",
  },
  {
    id: "flight_timing_risk",
    title: "Flight convenience and timing risk",
    body: "Review likely routing complexity, layover burden, and timing risk before committing to a destination.",
  },
  {
    id: "value_planning_risk",
    title: "Value and planning risk",
    body: "Understand whether the destination is attractive because of strong fit, strong value, or both.",
  },
  {
    id: "shortlist_comparison",
    title: "Final shortlist comparison",
    body: "Compare saved cities with clearer tradeoffs around fit, cost, convenience, and confidence.",
  },
  {
    id: "advisor_readiness",
    title: "Advisor handoff readiness",
    body: "Future versions may help package your decision context for a curated advisor or concierge handoff.",
  },
];

type CityCostContext = {
  hotelNightlyRangeUsd: [number, number];
  flightRoundTripRangeUsd: {
    nyc: [number, number];
    phl: [number, number];
  };
  confidence: "low" | "medium" | "high";
  note: string;
};

type PinnedComparisonLens = {
  peerName: string;
  scoreLine: string;
  selectedEdges: string[];
  peerEdges: string[];
  decisionLine: string;
};

const DRIVER_ORDER: DriverKey[] = [
  "flight",
  "hotel",
  "diningValue",
  "culinaryDensity",
  "shopping",
  "safetyTransit",
  "weather",
  "crowds",
];

const DRIVER_LABEL: Record<DriverKey, string> = {
  flight: "Flights",
  hotel: "Hotels",
  diningValue: "Dining value",
  culinaryDensity: "Culinary density",
  shopping: "Shopping",
  safetyTransit: "Safety + transit",
  weather: "Weather fit",
  crowds: "Low crowds",
};

const DRIVER_HELP: Record<DriverKey, string> = {
  flight: "Lower cost → higher score.",
  hotel: "Lower nightly → higher score.",
  diningValue: "Better value → higher score.",
  culinaryDensity: "More food depth → higher score.",
  shopping: "Better value + selection → higher score.",
  safetyTransit: "Higher index → higher score.",
  weather: "Higher index → higher score.",
  crowds: "Inverted: less crowded → higher score.",
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function nOr(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function fmt1(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function displayScoreOf(selected: ScoredCity) {
  return Math.round(
    Number((selected as any)?.displayScore ?? (selected as any)?.totalScore ?? (selected as any)?.score ?? 0)
  );
}

function displayTierOf(selected: ScoredCity): ScoredCity["tier"] {
  return (((selected as any)?.displayTier ?? selected?.tier ?? "C") as ScoredCity["tier"]);
}

function planningIntentLabel(intent: PlanningIntent) {
  if (intent === "track") return "Tracking for planning review";
  if (intent === "prepare_options") return "Booking options marked for later";
  return "Hotel comparison saved for later";
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

function interestTypeFromPlanningIntent(intent: PlanningIntent | null): PremiumInterestType {
  if (intent === "compare_hotels") return "hotel_fit";
  if (intent === "prepare_options") return "flight_convenience";
  if (intent === "track") return "shortlist_review";
  return "shortlist_review";
}

function selectablePremiumInterestType(type: PremiumInterestType): PremiumInterestType {
  if (PREMIUM_INTEREST_OPTIONS.some((option) => option.id === type)) return type;
  if (type === "hotel_comparison") return "hotel_fit";
  if (type === "booking_intelligence") return "flight_convenience";
  return "shortlist_review";
}

function normalizeWeightsPct(
  raw: Partial<Record<DriverKey, number>>
): Record<DriverKey, number> {
  const safe: Record<DriverKey, number> = {
    flight: Math.max(0, nOr(raw.flight, 0)),
    hotel: Math.max(0, nOr(raw.hotel, 0)),
    diningValue: Math.max(0, nOr(raw.diningValue, 0)),
    culinaryDensity: Math.max(0, nOr(raw.culinaryDensity, 0)),
    shopping: Math.max(0, nOr(raw.shopping, 0)),
    safetyTransit: Math.max(0, nOr(raw.safetyTransit, 0)),
    weather: Math.max(0, nOr(raw.weather, 0)),
    crowds: Math.max(0, nOr(raw.crowds, 0)),
  };

  const sum =
    safe.flight +
    safe.hotel +
    safe.diningValue +
    safe.culinaryDensity +
    safe.shopping +
    safe.safetyTransit +
    safe.weather +
    safe.crowds;

  if (sum <= 0) {
    const eq = 100 / DRIVER_ORDER.length;

    return {
      flight: eq,
      hotel: eq,
      diningValue: eq,
      culinaryDensity: eq,
      shopping: eq,
      safetyTransit: eq,
      weather: eq,
      crowds: eq,
    };
  }

  return {
    flight: (safe.flight / sum) * 100,
    hotel: (safe.hotel / sum) * 100,
    diningValue: (safe.diningValue / sum) * 100,
    culinaryDensity: (safe.culinaryDensity / sum) * 100,
    shopping: (safe.shopping / sum) * 100,
    safetyTransit: (safe.safetyTransit / sum) * 100,
    weather: (safe.weather / sum) * 100,
    crowds: (safe.crowds / sum) * 100,
  };
}

function getComponents(it: any): Record<DriverKey, number> {
  const c = (it?.components ?? {}) as Partial<Record<DriverKey, number>>;

  return {
    flight: clamp(nOr(c.flight, 0), 0, 100),
    hotel: clamp(nOr(c.hotel, 0), 0, 100),
    diningValue: clamp(nOr(c.diningValue, 0), 0, 100),
    culinaryDensity: clamp(nOr(c.culinaryDensity, 0), 0, 100),
    shopping: clamp(nOr(c.shopping, 0), 0, 100),
    safetyTransit: clamp(nOr(c.safetyTransit, 0), 0, 100),
    weather: clamp(nOr(c.weather, 0), 0, 100),
    crowds: clamp(nOr(c.crowds, 0), 0, 100),
  };
}

function tierCopy(tier: ScoredCity["tier"]) {
  if (tier === "S") {
    return {
      headline: "Elite fit.",
      sub: "Minimal tradeoffs across your priorities.",
    };
  }

  if (tier === "A") {
    return {
      headline: "Strong fit.",
      sub: "A few tradeoffs, but the core match is strong.",
    };
  }

  if (tier === "B") {
    return {
      headline: "Solid fit.",
      sub: "Works well with clear tradeoffs.",
    };
  }

  if (tier === "C") {
    return {
      headline: "Mixed fit.",
      sub: "Viable if your constraints are flexible.",
    };
  }

  return {
    headline: "Weak fit.",
    sub: "Likely misaligned with your current priorities.",
  };
}


function shortlistLabel(status: ShortlistStatus) {
  if (status === "shortlist") return "Shortlist";
  if (status === "maybe") return "Maybe";
  return "Not this trip";
}

function isPremiumInsight(value: unknown): value is CityPremiumInsight {
  if (!value || typeof value !== "object") return false;

  const v = value as Partial<CityPremiumInsight>;

  return (
    typeof v.decisionSummary === "string" &&
    Array.isArray(v.whyItRankedHere) &&
    Array.isArray(v.whyItFits) &&
    Array.isArray(v.watchouts) &&
    Array.isArray(v.bestFor) &&
    Array.isArray(v.notIdealFor)
  );
}

function isUsdRange(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function isCostContext(value: unknown): value is CityCostContext {
  if (!value || typeof value !== "object") return false;

  const v = value as Partial<CityCostContext>;
  const flights = v.flightRoundTripRangeUsd as CityCostContext["flightRoundTripRangeUsd"] | undefined;

  return (
    isUsdRange(v.hotelNightlyRangeUsd) &&
    !!flights &&
    isUsdRange(flights.nyc) &&
    isUsdRange(flights.phl) &&
    (v.confidence === "low" || v.confidence === "medium" || v.confidence === "high") &&
    typeof v.note === "string"
  );
}

function deriveRange(center: number, lowMultiplier: number, highMultiplier: number, step: number): [number, number] {
  const safeCenter = Math.max(step, center);
  const low = Math.max(step, Math.round((safeCenter * lowMultiplier) / step) * step);
  const high = Math.max(low + step, Math.round((safeCenter * highMultiplier) / step) * step);

  return [low, high];
}

function getCostContext(selected: ScoredCity): CityCostContext | null {
  const fromCity = selected?.city?.costContext;

  if (isCostContext(fromCity)) {
    return fromCity;
  }

  const city = selected?.city as any;
  const avg4 = nOr(city?.avg4StarPriceUsd, NaN);
  const avg5 = nOr(city?.avg5StarPriceUsd, NaN);
  const nyc = nOr(city?.flightFrom?.nyc, NaN);
  const phl = nOr(city?.flightFrom?.phl, NaN);

  if (!Number.isFinite(avg4) || !Number.isFinite(avg5) || !Number.isFinite(nyc) || !Number.isFinite(phl)) {
    return null;
  }

  const blendedHotelNightly = avg4 * 0.55 + avg5 * 0.45;

  return {
    hotelNightlyRangeUsd: deriveRange(blendedHotelNightly, 0.72, 1.18, 10),
    flightRoundTripRangeUsd: {
      nyc: deriveRange(nyc, 0.82, 1.24, 25),
      phl: deriveRange(phl, 0.82, 1.24, 25),
    },
    confidence: "medium",
    note: "Planning estimate based on destination cost signals. Use this as a budget range, not a live quote; season, dates, airport choice, and booking window can move prices materially.",
  };
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsdRange(range: [number, number]) {
  return `${formatUsd(range[0])}–${formatUsd(range[1])}`;
}


function cityIdOf(item: ScoredCity | null | undefined) {
  const id = item?.city?.id;
  return typeof id === "string" ? id : "";
}

function cityNameOf(item: ScoredCity | null | undefined) {
  const name = item?.city?.name;
  return typeof name === "string" && name.length ? name : "Destination";
}

function readableList(items: string[]) {
  const safe = items.filter(Boolean);

  if (safe.length === 0) return "";
  if (safe.length === 1) return safe[0];
  if (safe.length === 2) return `${safe[0]} and ${safe[1]}`;

  return `${safe.slice(0, -1).join(", ")}, and ${safe[safe.length - 1]}`;
}

function lowercaseFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function getPinnedComparisonLens(
  selected: ScoredCity,
  comparisonCities?: ScoredCity[]
): PinnedComparisonLens | null {
  const selectedId = cityIdOf(selected);
  const pinned = Array.isArray(comparisonCities)
    ? comparisonCities.filter(Boolean).slice(0, 2)
    : [];

  if (!selectedId || pinned.length < 2) return null;

  const selectedIsPinned = pinned.some((city) => cityIdOf(city) === selectedId);
  if (!selectedIsPinned) return null;

  const peer = pinned.find((city) => cityIdOf(city) !== selectedId);
  if (!peer) return null;

  const selectedName = cityNameOf(selected);
  const peerName = cityNameOf(peer);
  const selectedScore = displayScoreOf(selected);
  const peerScore = displayScoreOf(peer);
  const scoreDiff = selectedScore - peerScore;

  const selectedComponents = getComponents(selected);
  const peerComponents = getComponents(peer);

  const deltas = DRIVER_ORDER.map((key) => ({
    key,
    delta: selectedComponents[key] - peerComponents[key],
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const selectedEdges = deltas
    .filter((row) => row.delta >= 6)
    .map((row) => DRIVER_LABEL[row.key])
    .slice(0, 3);

  const peerEdges = deltas
    .filter((row) => row.delta <= -6)
    .map((row) => DRIVER_LABEL[row.key])
    .slice(0, 3);

  const scoreLine =
    scoreDiff === 0
      ? `${selectedName} and ${peerName} are tied on visible alignment score.`
      : scoreDiff > 0
        ? `${selectedName} leads ${peerName} by ${scoreDiff} alignment point${scoreDiff === 1 ? "" : "s"}.`
        : `${peerName} leads ${selectedName} by ${Math.abs(scoreDiff)} alignment point${Math.abs(scoreDiff) === 1 ? "" : "s"}.`;

  const selectedEdgeText = selectedEdges.length
    ? lowercaseFirst(readableList(selectedEdges))
    : "overall balance";

  const peerEdgeText = peerEdges.length
    ? lowercaseFirst(readableList(peerEdges))
    : "a similar driver mix";

  const decisionLine =
    selectedEdges.length || peerEdges.length
      ? `Use ${selectedName} when ${selectedEdgeText} matters more; use ${peerName} when ${peerEdgeText} is the bigger priority.`
      : `The two pinned cities are close by driver profile, so the better choice comes down to score confidence, budget comfort, and personal preference.`;

  return {
    peerName,
    scoreLine,
    selectedEdges: selectedEdges.length ? selectedEdges : ["Balanced profile"],
    peerEdges: peerEdges.length ? peerEdges : ["Balanced profile"],
    decisionLine,
  };
}

function getPremiumInsight(selected: ScoredCity): CityPremiumInsight {
  const fromCity = selected?.city?.premiumInsight;

  if (isPremiumInsight(fromCity)) {
    return fromCity;
  }

  const cityName = selected?.city?.name ?? "This destination";
  const country = selected?.city?.country ?? "";
  const topDrivers = Array.isArray(selected?.topDrivers) ? selected.topDrivers.slice(0, 3) : [];
  const primary = topDrivers[0]?.label ?? "the strongest weighted priorities";
  const secondary = topDrivers[1]?.label ?? "the supporting trip factors";
  const budgetStatus = String((selected as any)?.budgetStatus ?? "unknown");

  return {
    decisionSummary: `${cityName}${country ? `, ${country}` : ""} is recommended because its strongest measurable signals line up with the priorities that matter most in this search.`,
    whyItRankedHere: [
      `${primary} is doing the most work in the current alignment score.`,
      `${secondary} gives the recommendation more support instead of making it feel like a one-dimensional match.`,
    ],
    whyItFits: [
      "The destination fits when the traveler wants the score to reflect practical tradeoffs, not just popularity.",
      budgetStatus === "under"
        ? "It also has a favorable budget signal, which makes the recommendation easier to trust for this setup."
        : "It works best when the traveler accepts the destination’s cost and comfort tradeoffs.",
    ],
    watchouts: [
      dominantConstraintLine(
        DRIVER_ORDER.map((k) => {
          const component = (selected.components ?? {})[k] ?? 0;
          const driver = selected.topDrivers?.find((d) => d.key === k);

          return {
            k,
            w: nOr(driver?.weightRaw, 0),
            s: nOr(component, 0),
            pts: nOr(driver?.points, 0),
          };
        })
      ),
      "Use the driver tab to confirm the match if one priority matters much more than the others.",
    ],
    bestFor: topDrivers.map((d) => d.label).filter(Boolean).slice(0, 3),
    notIdealFor: ["Ignoring tradeoffs", "One-size-fits-all planning"],
    comparisonNote: `${cityName} should win the comparison when ${primary.toLowerCase()} matters more than the destination’s weaker constraints.`,
  };
}

function useMounted() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return matches;
}

export function CityModal({
  selected,
  onClose,
  country,
  visited,
  trips,
  onSetVisited,
  onSetTrips,
  feedback,
  onSetFeedback,
  shiftLeftPx = 0,
  isCompareOpen = false,
  comparisonCities = [],
  isPinned = false,
  onTogglePin,
  shortlistStatus = null,
  onSetShortlistStatus,
  planningIntent,
  onSetPlanningIntent,
  zIndex,
  onSubmitPremiumInterest,
  tripStyleMatch,
}: {
  selected: ScoredCity;
  onClose: () => void;

  country?: string;
  visited?: boolean;
  trips?: number;
  onSetVisited: (v: boolean) => void;
  onSetTrips: (n: number) => void;

  feedback?: CityFeedback;
  onSetFeedback: (v: CityFeedback) => void;

  shiftLeftPx?: number;
  isCompareOpen?: boolean;
  comparisonCities?: ScoredCity[];

  isPinned?: boolean;
  onTogglePin?: () => void;

  shortlistStatus?: ShortlistStatus | null;
  onSetShortlistStatus?: (status: ShortlistStatus | null) => void;

  planningIntent?: PlanningIntent | null;
  onSetPlanningIntent?: (intent: PlanningIntent) => void;

  zIndex?: number;
  onSubmitPremiumInterest?: (request: PremiumInterestRequest) => void;
  tripStyleMatch?: TripStyleMatch | null;
}) {
  const mounted = useMounted();
  const isRail = useMediaQuery("(min-width: 720px)");

  const [layer, setLayer] = React.useState<Layer>("verdict");
  const [localPlanningIntent, setLocalPlanningIntent] = React.useState<PlanningIntent | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const scrollportRef = React.useRef<HTMLDivElement | null>(null);

  const cityId = selected?.city?.id ?? "destination";
  const isPlanningIntentControlled = typeof onSetPlanningIntent === "function";

  React.useEffect(() => {
    setLayer("verdict");
  }, [cityId]);

  React.useEffect(() => {
    if (!isPlanningIntentControlled) setLocalPlanningIntent(null);
  }, [cityId, isPlanningIntentControlled]);

  React.useLayoutEffect(() => {
    const scrollport = scrollportRef.current;
    if (!scrollport) return;

    scrollport.scrollTop = 0;

    const frame = requestAnimationFrame(() => {
      scrollport.scrollTop = 0;
    });

    return () => cancelAnimationFrame(frame);
  }, [cityId, layer, mounted]);

  React.useEffect(() => {
    if (!mounted) return;

    const html = document.documentElement;
    const body = document.body;

    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [mounted]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [cityId]);

  const handleWheelCapture = React.useCallback((event: React.WheelEvent) => {
    const scrollport = scrollportRef.current;
    const panel = panelRef.current;

    if (!scrollport || !panel) return;
    if (!(event.target instanceof Node)) return;
    if (!panel.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();

    const multiplier =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollport.clientHeight : 1;

    scrollport.scrollTop += event.deltaY * multiplier;
    scrollport.scrollLeft += event.deltaX * multiplier;
  }, []);

  const handleSetPlanningIntent = React.useCallback(
    (intent: PlanningIntent) => {
      if (onSetPlanningIntent) {
        onSetPlanningIntent(intent);
        return;
      }

      setLocalPlanningIntent(intent);
    },
    [onSetPlanningIntent]
  );

  const components = React.useMemo(() => getComponents(selected as any), [selected]);

  const weightsPct = React.useMemo(
    () =>
      normalizeWeightsPct(
        ((selected as any)?.weightsPct ?? {}) as Partial<Record<DriverKey, number>>
      ),
    [selected]
  );

  const score = displayScoreOf(selected);
  const cityName = selected?.city?.name ?? "Destination";
  const cityCountry = selected?.city?.country ?? country ?? "";
  const tier = displayTierOf(selected);
  const budgetStatus = String((selected as any)?.budgetStatus ?? "unknown");
  const activePlanningIntent = isPlanningIntentControlled ? planningIntent ?? null : localPlanningIntent;
  const premiumInsight = React.useMemo(() => getPremiumInsight(selected), [selected]);
  const costContext = React.useMemo(() => getCostContext(selected), [selected]);
  const comparisonLens = React.useMemo(
    () => getPinnedComparisonLens(selected, comparisonCities),
    [selected, comparisonCities]
  );

  const ranked = React.useMemo(() => {
    return DRIVER_ORDER.map((k) => {
      const w = weightsPct[k];
      const s = components[k];
      const pts = (w / 100) * s;

      return { k, w, s, pts };
    }).sort((a, b) => b.pts - a.pts);
  }, [weightsPct, components]);

  const top3 = ranked.slice(0, 3);
  const copy = tierCopy(tier);
  const rightOffset = isCompareOpen ? Math.max(24, shiftLeftPx + 24) : 24;

  if (!mounted) return null;

  const modal = (
    <div
      data-city-modal-root="true"
      className="fixed inset-0 z-[1300] overflow-hidden pointer-events-auto"
      style={typeof zIndex === "number" ? { zIndex } : undefined}
      onPointerDown={(e) => {
        e.stopPropagation();

        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="pointer-events-none fixed inset-y-0 right-0 w-[min(900px,100vw)] bg-[linear-gradient(to_left,rgba(2,3,5,0.94),rgba(2,3,5,0.58),transparent)]" />

      <aside
        ref={panelRef}
        key={cityId}
        role="dialog"
        aria-modal="true"
        aria-label={`${cityName} destination details`}
        tabIndex={-1}
        data-city-modal-panel="true"
        onWheelCapture={handleWheelCapture}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={cn(
          "pointer-events-auto fixed isolate overflow-hidden border border-white/[0.10] outline-none",
          "shadow-[0_34px_110px_rgba(0,0,0,0.86)] ring-1 ring-white/[0.045]",
          "before:pointer-events-none before:absolute before:inset-0 before:z-[-1] before:bg-[radial-gradient(circle_at_18%_0%,rgba(200,170,110,0.08),transparent_34%),linear-gradient(180deg,#070a0f_0%,#05070b_46%,#06080c_100%)]",
          isRail ? "rounded-[32px]" : "rounded-[28px]"
        )}
        style={
          isRail
            ? {
                top: 92,
                bottom: 20,
                right: rightOffset,
                width: 560,
                maxWidth: "calc(100vw - 48px)",
                backgroundColor: "#05070b",
              }
            : {
                top: 84,
                right: 12,
                bottom: 12,
                left: 12,
                backgroundColor: "#05070b",
              }
        }
      >
        <div
          ref={scrollportRef}
          data-city-modal-scrollport="true"
          style={{
            position: "absolute",
            inset: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            scrollBehavior: "auto",
            scrollbarGutter: "stable",
            backgroundColor: "#05070b",
          }}
        >
          <div className="h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.22),rgba(200,170,110,0.62),transparent)]" />

          <header className="border-b border-white/[0.08] bg-[#070a0f]">
            <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c8aa6e] shadow-[0_0_16px_rgba(200,170,110,0.62)]" />
                    <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#c8aa6e]/78">
                      Destination console
                    </div>
                  </div>

                  <div className="mt-4 truncate text-[34px] font-semibold leading-none tracking-[-0.065em] text-white">
                    {cityName}
                  </div>

                  {cityCountry ? (
                    <div className="mt-2 truncate text-sm font-medium text-white/52">
                      {cityCountry}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {onTogglePin ? (
                    <PanelButton
                      type="button"
                      onClick={onTogglePin}
                      active={isPinned}
                      title={isPinned ? "Remove from comparison" : "Pin to comparison"}
                    >
                      {isPinned ? "Pinned" : "Pin"}
                    </PanelButton>
                  ) : null}

                  <PanelButton type="button" onClick={onClose} title="Close details">
                    Close
                  </PanelButton>
                </div>
              </div>

              {onSetShortlistStatus ? (
                <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-black/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8aa6e]/70">
                        Trip decision board
                      </div>
                      <div className="mt-1 text-xs leading-5 text-white/46">
                        {shortlistStatus
                          ? `${cityName} is marked as ${shortlistLabel(shortlistStatus).toLowerCase()}.`
                          : "Save this destination to your broader decision set."}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <PanelButton
                        type="button"
                        active={shortlistStatus === "shortlist"}
                        onClick={() => onSetShortlistStatus(shortlistStatus === "shortlist" ? null : "shortlist")}
                        title="Save to shortlist"
                      >
                        Save
                      </PanelButton>

                      <PanelButton
                        type="button"
                        active={shortlistStatus === "maybe"}
                        onClick={() => onSetShortlistStatus(shortlistStatus === "maybe" ? null : "maybe")}
                        title="Mark as maybe"
                        className={shortlistStatus === "maybe" ? "border-[#c8aa6e]/30 bg-[#c8aa6e]/12 text-[#f1dfb8]" : undefined}
                      >
                        Maybe
                      </PanelButton>

                      <PanelButton
                        type="button"
                        active={shortlistStatus === "not_this_trip"}
                        onClick={() => onSetShortlistStatus(shortlistStatus === "not_this_trip" ? null : "not_this_trip")}
                        title="Mark not this trip"
                        className={shortlistStatus === "not_this_trip" ? "border-white/18 bg-white/[0.08] text-white/78" : undefined}
                      >
                        Not this trip
                      </PanelButton>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_156px]">
                <HeroMetricCard label="Verdict">
                  <div className="mt-2 text-base font-semibold leading-6 text-white/92">
                    {copy.headline}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-white/56">{copy.sub}</div>
                </HeroMetricCard>

                <HeroMetricCard label={tripStyleMatch ? "Recommendation score" : "Alignment score"}>
                  <div className="mt-2 text-[38px] font-semibold leading-none tracking-[-0.07em] text-white">
                    {Math.round(score)}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">
                    {tripStyleMatch ? "Style-adjusted" : "/100"}
                  </div>
                </HeroMetricCard>
              </div>
            </div>

            <div className="border-t border-white/[0.06] bg-[#05070b] px-5 py-3 sm:px-6">
              <div className="grid grid-cols-3 rounded-[18px] border border-white/[0.08] bg-[#0b1017] p-1">
                <LayerTab active={layer === "verdict"} onClick={() => setLayer("verdict")}>
                  Verdict
                </LayerTab>
                <LayerTab active={layer === "drivers"} onClick={() => setLayer("drivers")}>
                  Drivers
                </LayerTab>
                <LayerTab active={layer === "impact"} onClick={() => setLayer("impact")}>
                  Impact
                </LayerTab>
              </div>
            </div>
          </header>

          <main className="bg-[#05070b]">
            <div className="space-y-5 p-5 sm:p-6">
              {layer === "verdict" ? (
                <VerdictLayer
                  cityKey={cityId}
                  cityName={cityName}
                  ranked={ranked}
                  top3={top3}
                  score={score}
                  components={components}
                  cityCountry={cityCountry}
                  tier={tier}
                  budgetStatus={budgetStatus}
                  confidence={confidenceLabel(selected)}
                  budget={budgetLabel(selected)}
                  premiumInsight={premiumInsight}
                  costContext={costContext}
                  comparisonLens={comparisonLens}
                  planningIntent={activePlanningIntent}
                  onSetPlanningIntent={handleSetPlanningIntent}
                  onSubmitPremiumInterest={onSubmitPremiumInterest}
                  tripStyleMatch={tripStyleMatch ?? null}
                  visited={visited}
                  trips={trips}
                  feedback={feedback}
                  onSetVisited={onSetVisited}
                  onSetTrips={onSetTrips}
                  onSetFeedback={onSetFeedback}
                />
              ) : null}

              {layer === "drivers" ? <DriversLayer ranked={ranked} /> : null}

              {layer === "impact" ? <ImpactLayer ranked={ranked} /> : null}
            </div>
          </main>

          <footer className="border-t border-white/[0.08] bg-[#05070a] px-5 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[11px] font-medium text-white/36">
                Model-driven destination fit
              </div>
              <div className="h-px min-w-16 flex-1 bg-[linear-gradient(to_right,rgba(200,170,110,0.32),transparent)]" />
            </div>
          </footer>
        </div>
      </aside>
    </div>
  );

  return createPortal(modal, document.body);
}

function VerdictLayer({
  cityKey,
  cityName,
  ranked,
  top3,
  score,
  components,
  cityCountry,
  tier,
  budgetStatus,
  confidence,
  budget,
  premiumInsight,
  costContext,
  comparisonLens,
  planningIntent,
  onSetPlanningIntent,
  onSubmitPremiumInterest,
  tripStyleMatch,
  visited,
  trips,
  feedback,
  onSetVisited,
  onSetTrips,
  onSetFeedback,
}: {
  cityKey: string | number;
  cityName: string;
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
  top3: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
  score: number;
  components: Record<DriverKey, number>;
  cityCountry: string;
  tier: ScoredCity["tier"];
  budgetStatus: string;
  confidence: string;
  budget: string;
  premiumInsight: CityPremiumInsight;
  costContext: CityCostContext | null;
  comparisonLens: PinnedComparisonLens | null;
  planningIntent: PlanningIntent | null;
  onSetPlanningIntent: (intent: PlanningIntent) => void;
  onSubmitPremiumInterest?: (request: PremiumInterestRequest) => void;
  tripStyleMatch: TripStyleMatch | null;
  visited?: boolean;
  trips?: number;
  feedback?: CityFeedback;
  onSetVisited: (v: boolean) => void;
  onSetTrips: (n: number) => void;
  onSetFeedback: (v: CityFeedback) => void;
}) {
  return (
    <>
      <SurfaceCard>
        <SectionKicker>Fast read</SectionKicker>

        <div className="mt-3 text-sm leading-6 text-white/72">
          <span className="font-semibold text-white/92">
            {DRIVER_LABEL[top3[0]?.k ?? "safetyTransit"]}
          </span>{" "}
          leads the fit
          {top3[1] ? `, while ${DRIVER_LABEL[top3[1].k]} reinforces it.` : "."}
        </div>

        <div className="mt-3 rounded-2xl border border-white/[0.07] bg-[#080c12] px-3 py-2 text-xs leading-5 text-white/48">
          {dominantConstraintLine(ranked)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
          <span className="font-semibold uppercase tracking-[0.18em] text-white/34">
            Descriptors
          </span>
          <span className="text-white/22">·</span>
          <span className="font-semibold text-white/70">Tier {tier}</span>
          <span className="text-white/22">·</span>
          <span className="font-semibold text-white/70">{confidence}</span>
          <span className="text-white/22">·</span>
          <span className="font-semibold text-emerald-100">{budget}</span>
        </div>
      </SurfaceCard>

      <DecisionReport
        insight={premiumInsight}
        costContext={costContext}
        comparisonLens={comparisonLens}
        cityId={String(cityKey)}
        cityName={cityName}
        score={score}
        tier={tier}
        budgetStatus={budgetStatus}
        planningIntent={planningIntent}
        onSetPlanningIntent={onSetPlanningIntent}
        onSubmitPremiumInterest={onSubmitPremiumInterest}
        tripStyleMatch={tripStyleMatch}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard>
          <SectionKicker>Alignment score</SectionKicker>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="text-[42px] font-semibold leading-none tracking-[-0.07em] text-white">
              {Math.round(score)}
            </div>

            <div className="mb-1 rounded-full border border-white/[0.08] bg-[#080c12] px-2.5 py-1 text-[11px] font-semibold text-white/48">
              /100
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-[#c8aa6e]"
              style={{ width: `${clamp(score, 0, 100)}%` }}
            />
          </div>

          <div className="mt-3 text-xs leading-5 text-white/48">
            Alignment Score is a relative fit signal, not a trip guarantee. Use it to
            compare destinations against your stated preferences, budget, travel style,
            and personalization signals.
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionKicker>Top contributors</SectionKicker>

          <div className="mt-3 space-y-2">
            {top3.map((r) => (
              <ContributorMini key={r.k} row={r} />
            ))}
          </div>
        </SurfaceCard>
      </div>

      <PersonalizationWizard
        key={String(cityKey)}
        cityName={cityName}
        cityCountry={cityCountry}
        visited={visited}
        trips={trips}
        feedback={feedback}
        onSetVisited={onSetVisited}
        onSetTrips={onSetTrips}
        onSetFeedback={onSetFeedback}
      />

      <SurfaceCard>
        <SectionKicker>Travel conditions</SectionKicker>

        <div className="mt-3 divide-y divide-white/[0.06]">
          <DetailRow
            label="Weather"
            value={Math.round(components.weather)}
            help="Higher = more favorable overall climate conditions."
          />
          <DetailRow
            label="Crowds"
            value={Math.round(components.crowds)}
            help="Higher = less crowded and easier to navigate."
          />
        </div>
      </SurfaceCard>
    </>
  );
}


function DecisionReport({
  insight,
  costContext,
  comparisonLens,
  cityId,
  cityName,
  score,
  tier,
  budgetStatus,
  planningIntent,
  onSetPlanningIntent,
  onSubmitPremiumInterest,
  tripStyleMatch,
}: {
  insight: CityPremiumInsight;
  costContext: CityCostContext | null;
  comparisonLens: PinnedComparisonLens | null;
  cityId: string;
  cityName: string;
  score: number;
  tier: ScoredCity["tier"];
  budgetStatus: string;
  planningIntent: PlanningIntent | null;
  onSetPlanningIntent: (intent: PlanningIntent) => void;
  onSubmitPremiumInterest?: (request: PremiumInterestRequest) => void;
  tripStyleMatch: TripStyleMatch | null;
}) {
  return (
    <SurfaceCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionKicker>Destination decision report</SectionKicker>
          <div className="mt-3 text-base font-semibold leading-7 text-white/92">
            {insight.decisionSummary}
          </div>
        </div>

        <div className="hidden shrink-0 rounded-full border border-[#c8aa6e]/20 bg-[#c8aa6e]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f1dfb8]/80 sm:inline-flex">
          Premium read
        </div>
      </div>

      {costContext ? <CostPlanningCard costContext={costContext} /> : null}

      {tripStyleMatch ? (
        <TripStyleFitCard cityName={cityName} match={tripStyleMatch} />
      ) : null}

      <PlanningIntelligenceCard
        cityId={cityId}
        cityName={cityName}
        score={score}
        tier={tier}
        budgetStatus={budgetStatus}
        comparisonLens={comparisonLens}
        planningIntent={planningIntent}
        onSetPlanningIntent={onSetPlanningIntent}
        onSubmitPremiumInterest={onSubmitPremiumInterest}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <InsightList title="Why it ranked here" items={insight.whyItRankedHere} />
        <InsightList title="Why it fits you" items={insight.whyItFits} />
      </div>

      <div className="mt-3">
        <InsightList title="Watchouts / tradeoffs" items={insight.watchouts} tone="caution" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InsightChipGrid title="Best for" items={insight.bestFor} />
        <InsightChipGrid title="Not ideal for" items={insight.notIdealFor} muted />
      </div>

      {comparisonLens ? (
        <ComparisonLensCard lens={comparisonLens} cityName={cityName} />
      ) : null}

      <div className="mt-4 text-[11px] leading-5 text-white/36">
        This report explains why {cityName} appears where it does without changing the underlying score.
      </div>
    </SurfaceCard>
  );
}

function TripStyleFitCard({
  cityName,
  match,
}: {
  cityName: string;
  match: TripStyleMatch;
}) {
  const matched = joinStyleLabels(match.matchedLabels, "your selected style");
  const selected = joinStyleLabels(match.selectedLabels, "your selected style");
  const body =
    match.strength === "strong"
      ? `${cityName} strongly matches your selected trip style through ${matched}, and that fit influenced its recommendation rank.`
      : match.strength === "partial"
        ? `${cityName} partially matches ${selected}. It has clear strengths in ${matched}, but the fit is not complete.`
        : `${cityName} is a lower trip-style match for ${selected}. The selected trip style tempers its recommendation rank.`;
  const rankingLine =
    match.influence === "boosted"
      ? "Your selected trip style gives this destination a recommendation boost after base alignment."
      : match.influence === "reduced"
        ? "Your selected trip style reduces this destination's recommendation score after base alignment."
        : "Your selected trip style is reviewed separately from the base alignment score.";

  return (
    <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-[#080c12] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionKicker>Trip style fit</SectionKicker>
          <div className="mt-2 text-base font-semibold leading-7 text-white/90">
            {match.label} match
          </div>
          <div className="mt-1 text-sm leading-6 text-white/56">{body}</div>
        </div>

        <div className="w-fit rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
          {match.matchCount}/{match.selectedCount} styles
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-white/[0.07] bg-black/16 px-4 py-3 text-xs leading-5 text-white/38">
        {rankingLine}
      </div>
    </div>
  );
}


function ComparisonLensCard({
  lens,
  cityName,
}: {
  lens: PinnedComparisonLens;
  cityName: string;
}) {
  return (
    <div className="mt-4 rounded-[22px] border border-[#c8aa6e]/16 bg-[linear-gradient(180deg,rgba(200,170,110,0.07),rgba(255,255,255,0.02))] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f1dfb8]/64">
            Comparison lens
          </div>
          <div className="mt-2 text-sm leading-6 text-white/68">
            {lens.scoreLine}
          </div>
        </div>

        <div className="w-fit rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/44">
          Vs. {lens.peerName}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ComparisonEdgeBox title={`${cityName} edge`} items={lens.selectedEdges} />
        <ComparisonEdgeBox title={`${lens.peerName} edge`} items={lens.peerEdges} muted />
      </div>

      <div className="mt-3 rounded-[18px] border border-white/[0.07] bg-[#080c12]/82 px-4 py-3 text-sm leading-6 text-white/58">
        {lens.decisionLine}
      </div>
    </div>
  );
}

function ComparisonEdgeBox({
  title,
  items,
  muted = false,
}: {
  title: string;
  items: string[];
  muted?: boolean;
}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 3) : [];

  return (
    <div className="rounded-[20px] border border-white/[0.08] bg-[#080c12]/92 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
        {title}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {safeItems.map((item) => (
          <span
            key={`${title}-${item}`}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              muted
                ? "border-white/[0.08] bg-white/[0.035] text-white/50"
                : "border-[#c8aa6e]/18 bg-[#c8aa6e]/10 text-[#f1dfb8]/84"
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function CostPlanningCard({
  costContext,
}: {
  costContext: CityCostContext;
}) {
  const confidenceLabel =
    costContext.confidence === "high"
      ? "High confidence"
      : costContext.confidence === "medium"
        ? "Medium confidence"
        : "Directional estimate";

  return (
    <div className="mt-5 rounded-[24px] border border-[#c8aa6e]/16 bg-[linear-gradient(180deg,rgba(200,170,110,0.085),rgba(255,255,255,0.025))] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f1dfb8]/66">
            Planning cost range
          </div>
          <div className="mt-2 text-sm leading-6 text-white/62">
            Hotel and flight ranges are planning estimates, not live booking prices.
            Use them to compare relative trip fit before checking real-time availability.
          </div>
        </div>

        <div className="w-fit rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
          {confidenceLabel}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-white/[0.08] bg-[#080c12]/92 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
            Hotels
          </div>
          <div className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white/92">
            {formatUsdRange(costContext.hotelNightlyRangeUsd)}
          </div>
          <div className="mt-1 text-xs leading-5 text-white/42">
            Estimated nightly range
          </div>
        </div>

        <div className="rounded-[20px] border border-white/[0.08] bg-[#080c12]/92 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
            Flights
          </div>
          <div className="mt-2 space-y-1.5 text-sm font-semibold text-white/78">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/44">NYC</span>
              <span>{formatUsdRange(costContext.flightRoundTripRangeUsd.nyc)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/44">PHL</span>
              <span>{formatUsdRange(costContext.flightRoundTripRangeUsd.phl)}</span>
            </div>
          </div>
          <div className="mt-2 text-xs leading-5 text-white/42">
            Estimated round-trip range
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs leading-5 text-white/42">
        {costContext.note} Current rankings are based on alignment logic, not paid
        placement.
      </div>
    </div>
  );
}

function derivePlanningReadiness({
  score,
  tier,
  budgetStatus,
  comparisonLens,
}: {
  score: number;
  tier: ScoredCity["tier"];
  budgetStatus: string;
  comparisonLens: PinnedComparisonLens | null;
}) {
  const roundedScore = Math.round(score);

  if (comparisonLens) {
    return {
      status: "Compare before booking",
      summary: `${comparisonLens.peerName} is pinned against this destination, so the next useful move is a controlled side-by-side read.`,
      nextStep: `Review against ${comparisonLens.peerName}`,
    };
  }

  if (budgetStatus === "over" || tier === "D" || roundedScore < 74) {
    return {
      status: "Hold for later",
      summary: "The destination may still be interesting, but the current fit signal is not strong enough to rush into booking research.",
      nextStep: "Keep in shortlist",
    };
  }

  if (tier === "S" || roundedScore >= 92) {
    return {
      status: "Ready to shortlist",
      summary: "The alignment signal is strong enough to move from evaluation into quiet tracking and option prep.",
      nextStep: "Track this destination",
    };
  }

  if (tier === "A" || roundedScore >= 84) {
    return {
      status: "Worth tracking",
      summary: "The destination has enough alignment strength to watch, especially if timing or budget improves.",
      nextStep: "Prepare booking options",
    };
  }

  return {
    status: "Compare before booking",
    summary: "The fit is credible, but it should be tested against another city before it becomes the lead choice.",
    nextStep: "Compare before committing",
  };
}

function PlanningIntelligenceCard({
  cityId,
  cityName,
  score,
  tier,
  budgetStatus,
  comparisonLens,
  planningIntent,
  onSetPlanningIntent,
  onSubmitPremiumInterest,
}: {
  cityId: string;
  cityName: string;
  score: number;
  tier: ScoredCity["tier"];
  budgetStatus: string;
  comparisonLens: PinnedComparisonLens | null;
  planningIntent: PlanningIntent | null;
  onSetPlanningIntent: (intent: PlanningIntent) => void;
  onSubmitPremiumInterest?: (request: PremiumInterestRequest) => void;
}) {
  const readiness = derivePlanningReadiness({
    score,
    tier,
    budgetStatus,
    comparisonLens,
  });

  return (
    <div className="mt-4 rounded-[24px] border border-white/[0.09] bg-[#080c12] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionKicker>Planning intelligence</SectionKicker>
          <div className="mt-2 text-base font-semibold leading-7 text-white/90">
            {readiness.status}
          </div>
          <div className="mt-1 text-sm leading-6 text-white/56">
            {readiness.summary}
          </div>
        </div>

        <div className="w-fit rounded-full border border-[#c8aa6e]/18 bg-[#c8aa6e]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f1dfb8]/74">
          {readiness.nextStep}
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-white/[0.08] bg-[#0d1219] p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
          Trust note
        </div>
        <div className="mt-2 text-sm leading-6 text-white/56">
          Hotel and flight ranges are planning estimates, not live booking prices. Use
          them to compare relative trip fit before checking real-time availability.
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-white/[0.07] bg-black/16 p-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
            Recommended next step
          </div>
          <div className="mt-1 text-sm font-semibold text-white/78">
            {readiness.nextStep}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PanelButton
            type="button"
            active={planningIntent === "track"}
            onClick={() => onSetPlanningIntent("track")}
          >
            Track this destination
          </PanelButton>
          <PanelButton
            type="button"
            active={planningIntent === "prepare_options"}
            onClick={() => onSetPlanningIntent("prepare_options")}
          >
            Prepare booking options
          </PanelButton>
          <PanelButton
            type="button"
            active={planningIntent === "compare_hotels"}
            onClick={() => onSetPlanningIntent("compare_hotels")}
          >
            Compare hotels later
          </PanelButton>
        </div>
      </div>

      {planningIntent ? (
        <div className="mt-4 rounded-[18px] border border-emerald-400/18 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50/88">
          <span className="font-semibold">Planning intent saved.</span>{" "}
          {planningIntentLabel(planningIntent)} for {cityName}. This does not change
          your alignment score.
        </div>
      ) : null}

      <div className="mt-4 border-t border-white/[0.06] pt-4 text-xs leading-5 text-white/38">
        Planning actions organize your decision process; they do not affect ranking.
        This does not change your alignment score.{" "}
        Premium booking intelligence could eventually compare hotel quality, flight
        convenience, neighborhood fit, and timing risk without changing your alignment
        score.
      </div>

      <PremiumPlanningPreview />

      {onSubmitPremiumInterest ? (
        <PremiumReportPreview
          cityId={cityId}
          cityName={cityName}
          source="destination_console"
          onSubmitPremiumInterest={onSubmitPremiumInterest}
        />
      ) : null}

      {onSubmitPremiumInterest ? (
        <PremiumInterestCaptureCard
          cityId={cityId}
          cityName={cityName}
          source="destination_console"
          interestType={interestTypeFromPlanningIntent(planningIntent)}
          onSubmitPremiumInterest={onSubmitPremiumInterest}
        />
      ) : null}
    </div>
  );
}

function PremiumPlanningPreview() {
  return (
    <div className="mt-4 rounded-[20px] border border-white/[0.08] bg-black/18 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/72">
        Premium planning preview
      </div>

      <div className="mt-2 text-sm leading-6 text-white/58">
        Premium planning access is not live yet. These future tools would support
        destination decisions before booking, without changing your alignment score.
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {PREMIUM_PLANNING_PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="rounded-[16px] border border-white/[0.07] bg-[#080c12]/82 p-3"
          >
            <div className="text-xs font-semibold text-white/78">{pillar.title}</div>
            <div className="mt-1 text-[11px] leading-5 text-white/42">{pillar.body}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-[16px] border border-[#c8aa6e]/12 bg-[#c8aa6e]/[0.045] px-3 py-2 text-[11px] leading-5 text-[#f1dfb8]/58">
        Future versions may explore a curated advisor handoff for users who want help
        after choosing a destination.
      </div>
    </div>
  );
}

function PremiumReportPreview({
  cityId,
  cityName,
  source,
  onSubmitPremiumInterest,
}: {
  cityId?: string;
  cityName?: string;
  source: PremiumInterestSource;
  onSubmitPremiumInterest: (request: PremiumInterestRequest) => void;
}) {
  const [submitted, setSubmitted] = React.useState(false);
  const selectedReportModules = PREMIUM_REPORT_MODULES.map((module) => module.id);

  return (
    <div className="mt-4 rounded-[20px] border border-white/[0.08] bg-[#0b1017] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/72">
            Premium report preview
          </div>
          <div className="mt-2 text-sm leading-6 text-white/58">
            Preview only - premium reports are not live yet. A deeper report could
            help you decide whether {cityName} deserves to stay in your final set.
          </div>
        </div>

        <div className="w-fit rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
          Future report
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {PREMIUM_REPORT_MODULES.map((module) => (
          <div
            key={module.id}
            className="rounded-[16px] border border-white/[0.07] bg-black/18 p-3"
          >
            <div className="text-xs font-semibold text-white/78">{module.title}</div>
            <div className="mt-1 text-[11px] leading-5 text-white/42">{module.body}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11px] leading-5 text-white/36">
          This does not change your alignment score or ranking. No live booking prices
          are shown here.
        </div>

        <PanelButton
          type="button"
          active={submitted}
          className="w-full justify-center px-4 sm:w-auto"
          onClick={() => {
            onSubmitPremiumInterest({
              cityId,
              cityName,
              source,
              interestType: "premium_report",
              selectedReportModules,
            });
            setSubmitted(true);
          }}
        >
          {submitted ? "Report interest saved" : "Save report interest"}
        </PanelButton>
      </div>

      {submitted ? (
        <div className="mt-3 rounded-[16px] border border-emerald-400/16 bg-emerald-400/[0.08] px-3 py-2 text-xs leading-5 text-emerald-50/82">
          Premium report interest saved. Reports are not live yet, but this
          destination is marked for future premium review.
        </div>
      ) : null}
    </div>
  );
}

function PremiumInterestCaptureCard({
  cityId,
  cityName,
  source,
  interestType,
  onSubmitPremiumInterest,
}: {
  cityId?: string;
  cityName?: string;
  source: PremiumInterestSource;
  interestType: PremiumInterestType;
  onSubmitPremiumInterest: (request: PremiumInterestRequest) => void;
}) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [selectedInterestType, setSelectedInterestType] = React.useState<PremiumInterestType>(
    selectablePremiumInterestType(interestType)
  );

  React.useEffect(() => {
    setSelectedInterestType(selectablePremiumInterestType(interestType));
  }, [interestType]);

  return (
    <form
      noValidate
      className="mt-4 rounded-[20px] border border-[#c8aa6e]/14 bg-[#c8aa6e]/[0.045] p-4"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const cleanEmail = email.trim();

        if (!isValidEmail(cleanEmail)) {
          setError("Enter a valid email to request access.");
          setSubmitted(false);
          return;
        }

        onSubmitPremiumInterest({
          email: cleanEmail,
          cityId,
          cityName,
          source,
          interestType: selectedInterestType,
        });

        setError("");
        setSubmitted(true);
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e]/74">
        Premium planning access
      </div>

      <div className="mt-2 text-sm leading-6 text-white/58">
        Want deeper booking intelligence later? Request access to future planning
        tools for hotel quality, flight convenience, neighborhood fit, and timing
        risk without changing your alignment score. This helps us understand which
        premium planning tools would be most useful.
      </div>

      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
          Most useful area
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PREMIUM_INTEREST_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.description}
              onClick={() => {
                setSelectedInterestType(option.id);
                setSubmitted(false);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8aa6e]/25",
                selectedInterestType === option.id
                  ? "border-[#c8aa6e]/30 bg-[#c8aa6e]/[0.12] text-[#f1dfb8]"
                  : "border-white/[0.09] bg-white/[0.035] text-white/50 hover:border-white/[0.16] hover:text-white/72"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
          className="h-10 min-w-0 flex-1 rounded-[14px] border border-white/[0.10] bg-[#080c12] px-3 text-sm font-medium text-white/82 outline-none transition placeholder:text-white/28 focus:border-[#c8aa6e]/42"
        />

        <PanelButton type="submit" className="h-10 px-4">
          Request access
        </PanelButton>
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

function InsightList({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "caution";
}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];

  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[#080c12] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
        {title}
      </div>

      <div className="mt-3 space-y-2.5">
        {safeItems.map((item, index) => (
          <div key={`${title}-${index}`} className="flex gap-3 text-sm leading-6 text-white/62">
            <span
              className={cn(
                "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                tone === "caution" ? "bg-amber-200/70" : "bg-[#c8aa6e]/82"
              )}
            />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightChipGrid({
  title,
  items,
  muted = false,
}: {
  title: string;
  items: string[];
  muted?: boolean;
}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 8) : [];

  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[#080c12] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
        {title}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {safeItems.map((item) => (
          <span
            key={`${title}-${item}`}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              muted
                ? "border-white/[0.08] bg-white/[0.035] text-white/50"
                : "border-[#c8aa6e]/18 bg-[#c8aa6e]/10 text-[#f1dfb8]/84"
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function PersonalizationWizard({
  cityName,
  cityCountry,
  visited,
  trips,
  feedback,
  onSetVisited,
  onSetTrips,
  onSetFeedback,
}: {
  cityName: string;
  cityCountry: string;
  visited?: boolean;
  trips?: number;
  feedback?: CityFeedback;
  onSetVisited: (v: boolean) => void;
  onSetTrips: (n: number) => void;
  onSetFeedback: (v: CityFeedback) => void;
}) {
  const normalizedTrips = clamp(nOr(trips, 0), 0, 99);

  const initialStep: PersonalizationStep = feedback
    ? 3
    : normalizedTrips > 0 || visited
      ? 2
      : 1;

  const [step, setStep] = React.useState<PersonalizationStep>(initialStep);
  const [draftTrips, setDraftTrips] = React.useState<string>(String(normalizedTrips));
  const [localFeedback, setLocalFeedback] = React.useState<CityFeedback | undefined>(feedback);

  React.useEffect(() => {
    const nextTrips = clamp(nOr(trips, 0), 0, 99);
    setDraftTrips(String(nextTrips));
    setLocalFeedback(feedback);

    if (feedback) {
      setStep(3);
    } else if (nextTrips > 0 || visited) {
      setStep(2);
    } else {
      setStep(1);
    }
  }, [cityName, trips, visited, feedback]);

  const commitsTrips = React.useCallback(() => {
    const parsed = clamp(parseInt(draftTrips || "0", 10) || 0, 0, 99);
    onSetTrips(parsed);
    onSetVisited(parsed > 0);
    return parsed;
  }, [draftTrips, onSetTrips, onSetVisited]);

  const handleContinueFromTrips = React.useCallback(() => {
    commitsTrips();
    setStep(2);
  }, [commitsTrips]);

  const handleSelectFeedback = React.useCallback(
    (value: CityFeedback) => {
      commitsTrips();
      setLocalFeedback(value);
      onSetFeedback(value);
      setStep(3);
    },
    [commitsTrips, onSetFeedback]
  );

  const stepLabel =
    step === 1 ? "Step 1 of 3" : step === 2 ? "Step 2 of 3" : "Step 3 of 3";

  const displayFeedback = localFeedback
    ? localFeedback === "love"
      ? "Love"
      : localFeedback === "maybe"
        ? "Maybe"
        : "Pass"
    : null;

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-3">
        <SectionKicker>Personalization</SectionKicker>
        <div className="rounded-full border border-white/[0.08] bg-[#080c12] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38">
          {stepLabel}
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-4">
          <div className="text-base font-semibold text-white/92">
            How many times have you been to {cityName} before?
          </div>

          <div className="mt-1 text-sm leading-6 text-white/56">
            Tell us your prior familiarity so we can refine future recommendations
            without replacing your original setup preferences.
          </div>

          <div className="mt-4 rounded-[22px] border border-white/[0.10] bg-[#080c12] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium text-white/72">
                Previous visits
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  value={draftTrips}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setDraftTrips(raw === "" ? "" : String(clamp(parseInt(raw, 10), 0, 99)));
                  }}
                  className="h-11 w-24 rounded-[14px] border border-white/[0.10] bg-[#11161d] px-3 text-base font-semibold text-white/90 outline-none transition focus:border-[#c8aa6e]/45"
                />
                <span className="text-sm text-white/44">times</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <PanelButton type="button" onClick={handleContinueFromTrips}>
              Continue
            </PanelButton>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4">
          <div className="text-base font-semibold text-white/92">
            How did you like it?
          </div>

          <div className="mt-1 text-sm leading-6 text-white/56">
            We’ll use your sentiment as a light personalization signal alongside your
            original preferences.
          </div>

          <div className="mt-4 rounded-[22px] border border-white/[0.10] bg-[#080c12] p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5">
              <span className="font-semibold uppercase tracking-[0.16em] text-white/34">
                Recorded
              </span>
              <span className="text-white/22">·</span>
              <span className="font-semibold text-white/76">
                {clamp(parseInt(draftTrips || "0", 10) || 0, 0, 99)} visits
              </span>
              {cityCountry ? (
                <>
                  <span className="text-white/22">·</span>
                  <span className="font-semibold text-white/58">{cityCountry}</span>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <MiniChoice
                active={localFeedback === "love"}
                onClick={() => handleSelectFeedback("love")}
              >
                Love
              </MiniChoice>
              <MiniChoice
                active={localFeedback === "maybe"}
                onClick={() => handleSelectFeedback("maybe")}
              >
                Maybe
              </MiniChoice>
              <MiniChoice
                active={localFeedback === "pass"}
                onClick={() => handleSelectFeedback("pass")}
              >
                Pass
              </MiniChoice>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <PanelButton
              type="button"
              onClick={() => {
                setStep(1);
              }}
            >
              Back
            </PanelButton>

            <div className="text-xs text-white/38">Choose one to continue</div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4">
          <div className="text-base font-semibold text-white/92">
            Personalization saved
          </div>

          <div className="mt-1 text-sm leading-6 text-white/56">
            Personalization helps refine future recommendations without replacing your
            original setup preferences.
          </div>

          <div className="mt-4 rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 p-4">
            <div className="text-sm font-medium text-emerald-100">
              Your preference profile has been updated.
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs leading-5">
              <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 font-semibold text-white/84">
                {clamp(parseInt(draftTrips || "0", 10) || 0, 0, 99)} visits
              </span>

              {displayFeedback ? (
                <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 font-semibold text-white/84">
                  {displayFeedback}
                </span>
              ) : null}

              <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 font-semibold text-white/70">
                Saved for scoring
              </span>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <PanelButton
              type="button"
              onClick={() => {
                setStep(1);
              }}
            >
              Edit answers
            </PanelButton>
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function DriversLayer({
  ranked,
}: {
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
}) {
  return (
    <>
      <SurfaceCard>
        <SectionKicker>Driver model</SectionKicker>

        <div className="mt-2 text-sm leading-6 text-white/62">
          Weights × destination scores create the final alignment number.
        </div>
      </SurfaceCard>

      <div className="space-y-3">
        {ranked.map((r) => (
          <SurfaceCard key={r.k} compact>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90">
                  {DRIVER_LABEL[r.k]}
                </div>
                <div className="mt-1 text-xs leading-5 text-white/48">
                  {DRIVER_HELP[r.k]}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/32">
                  Driver
                </div>
                <div className="mt-1 text-sm font-semibold text-white/82">
                  {Math.round(r.s)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[#c8aa6e]"
                  style={{ width: `${clamp(r.s, 0, 100)}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-white/46">
                <span>
                  Weight{" "}
                  <span className="font-semibold text-white/78">
                    {Math.round(r.w)}%
                  </span>
                </span>
                <span>
                  Contribution{" "}
                  <span className="font-semibold text-emerald-100">{fmt1(r.pts)}</span>{" "}
                  pts
                </span>
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </>
  );
}

function ImpactLayer({
  ranked,
}: {
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
}) {
  const levers = ranked
    .map((r) => {
      const lever = (r.w / 100) * (100 - r.s);
      return { ...r, lever };
    })
    .sort((a, b) => b.lever - a.lever)
    .slice(0, 5);

  return (
    <>
      <SurfaceCard>
        <SectionKicker>Score levers</SectionKicker>

        <div className="mt-2 text-sm leading-6 text-white/62">
          Highest weight + lowest score reveals what would move this match most.
        </div>
      </SurfaceCard>

      <div className="space-y-3">
        {levers.map((r) => {
          const plus10 = (r.w / 100) * 10;

          return (
            <SurfaceCard key={r.k} compact>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    {DRIVER_LABEL[r.k]}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/48">
                    Current {Math.round(r.s)}/100 · Weight {Math.round(r.w)}%
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">
                    Lever
                  </div>
                  <div className="mt-1 text-sm font-semibold text-emerald-100">
                    {fmt1(r.lever)}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#080c12] p-3 text-xs leading-5 text-white/56">
                If this driver improved by{" "}
                <span className="font-semibold text-white/82">+10</span>, the total
                would move about{" "}
                <span className="font-semibold text-emerald-100">
                  +{fmt1(plus10)}
                </span>{" "}
                points.
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      <SurfaceCard>
        <SectionKicker>Interpretation</SectionKicker>

        <div className="mt-2 text-sm leading-6 text-white/62">
          High lever does not mean “bad.” It means that area is the strongest opportunity
          to improve the match score.
        </div>
      </SurfaceCard>
    </>
  );
}

function SurfaceCard({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0d1219] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]",
        compact ? "p-4" : "p-5"
      )}
      style={{ backgroundColor: "#0d1219" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.14),rgba(200,170,110,0.18),transparent)]" />
      {children}
    </div>
  );
}

function HeroMetricCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0b1017] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
      style={{ backgroundColor: "#0b1017" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(200,170,110,0.28),transparent)]" />
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
        {label}
      </div>
      {children}
    </div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/34">
      {children}
    </div>
  );
}

function PanelButton({
  active = false,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      {...props}
      onPointerDown={(e) => {
        e.stopPropagation();
        props.onPointerDown?.(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.(e);
      }}
      className={cn(
        "h-9 rounded-[14px] border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "border-emerald-400/24 bg-emerald-400/12 text-emerald-100 hover:border-emerald-400/38"
          : "border-white/[0.10] bg-[#11161d] text-white/74 hover:border-white/[0.18] hover:bg-[#171e27] hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

function LayerTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "h-9 rounded-[14px] text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "border border-[#c8aa6e]/30 bg-[#c8aa6e]/12 text-[#f1dfb8] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "border border-transparent text-white/52 hover:bg-white/[0.04] hover:text-white/82"
      )}
    >
      {children}
    </button>
  );
}

function MiniChoice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-events-auto relative z-10 h-10 rounded-[14px] border px-4 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "border-[#c8aa6e]/70 bg-[#c8aa6e]/18 text-[#f8e7bf] shadow-[0_0_0_1px_rgba(200,170,110,0.18),0_10px_24px_rgba(200,170,110,0.08)]"
          : "border-white/[0.10] bg-[#11161d] text-white/66 hover:border-white/[0.18] hover:bg-[#171e27] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function ContributorMini({
  row,
}: {
  row: { k: DriverKey; w: number; s: number; pts: number };
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#080c12] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-white/84">{DRIVER_LABEL[row.k]}</div>
        <div className="text-[11px] text-white/44">{Math.round(row.s)}/100</div>
      </div>

      <div className="mt-1 text-[11px] leading-5 text-white/46">
        Adds <span className="font-semibold text-emerald-100">{fmt1(row.pts)}</span> pts
      </div>
    </div>
  );
}

function DetailRow({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-white/74">{label}</div>
        <div className="text-sm font-semibold text-white/88">{value}</div>
      </div>

      <div className="mt-1 text-xs leading-5 text-white/46">{help}</div>
    </div>
  );
}

function confidenceLabel(selected: ScoredCity) {
  const c = (selected as any)?.explain?.confidence ?? (selected as any)?.confidence;

  if (typeof c === "number") {
    if (c >= 0.8) return "High confidence";
    if (c >= 0.55) return "Medium confidence";
    return "Low confidence";
  }

  return "High confidence";
}

function budgetLabel(selected: ScoredCity) {
  const st = ((selected as any)?.budgetStatus ?? "unknown") as string;

  if (st === "under") return "Budget under";
  if (st === "within") return "Within budget";
  if (st === "over") return "Over budget";

  return "Budget unknown";
}

function dominantConstraintLine(
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>
) {
  const weightedWeakness = [...ranked]
    .filter((r) => r.w >= 18)
    .sort((a, b) => a.s - b.s)[0];

  if (weightedWeakness && weightedWeakness.s <= 45) {
    return `Primary constraint: ${DRIVER_LABEL[weightedWeakness.k]} is important to your profile but weaker here.`;
  }

  return "No dominant constraint detected.";
}
