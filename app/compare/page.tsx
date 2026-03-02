// app/compare/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CITIES } from "@/data/cities";
import { PROFILES } from "@/data/profiles";
import type { Profile } from "@/lib/scoring";
import type { ProfileId } from "@/data/profiles";
import { scoreCities } from "@/lib/scoring";
import type { ScoredCity } from "@/lib/scoring";
import { CityModal, CityFeedback } from "@/components/CityModal";
import { RankedSection } from "@/components/RankedSection";
import { CompareDrawer } from "@/components/CompareDrawer";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const REGIONS: Array<"East Asia" | "Southeast Asia" | "Western Europe" | "North America" | "Africa"> = [
  "East Asia",
  "Southeast Asia",
  "Western Europe",
  "North America",
  "Africa",
];

const DEFAULT_REGION_FILTERS: Record<(typeof REGIONS)[number], boolean> = {
  "East Asia": true,
  "Southeast Asia": true,
  "Western Europe": true,
  "North America": true,
  "Africa": true,
};

type SortKey =
  | "overall"
  | "flight"
  | "hotel"
  | "diningValue"
  | "culinaryDensity"
  | "shopping"
  | "safetyTransit"
  | "weather"
  | "crowds";

type WeightKey =
  | "flight"
  | "hotel"
  | "diningValue"
  | "culinaryDensity"
  | "shopping"
  | "safetyTransit"
  | "weather"
  | "crowds";

type RawWeights = Record<WeightKey, number>;

const DEFAULT_CUSTOM_RAW: RawWeights = {
  flight: 15,
  hotel: 20,
  diningValue: 18,
  culinaryDensity: 20,
  shopping: 10,
  safetyTransit: 17,
  weather: 12,
  crowds: 12,
};

const LS_KEY = "compare_prefs_v3";

type VisitedByCountry = Record<string, boolean>;
type TripsByCountry = Record<string, number>;

type ProfileWithWeightsPct = Profile & {
  weightsPct?: Partial<Record<WeightKey, number>>;
};

export default function ComparePage() {
  // ✅ FIX: valid ProfileId
  const [profileId, setProfileId] = useState<ProfileId>("balanced");
  const [departure, setDeparture] = useState<"nyc" | "phl">("nyc"); // UI only for now

  const [month, setMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [tripDays, setTripDays] = useState<number>(7);
  const [fineDiningNights, setFineDiningNights] = useState<number>(2);
  const [hotelStarFocus, setHotelStarFocus] = useState<4 | 5>(5);

  // Budget (informational only)
  const [budgetUsd, setBudgetUsd] = useState<number | "">("");

  const [selected, setSelected] = useState<ScoredCity | null>(null);

  // Filters
  const [regionFilters, setRegionFilters] = useState<Record<(typeof REGIONS)[number], boolean>>(
    DEFAULT_REGION_FILTERS
  );
  const [minSafety, setMinSafety] = useState<number>(0);

  // Custom weights
  const [customRaw, setCustomRaw] = useState<RawWeights>(DEFAULT_CUSTOM_RAW);

  // Familiarity tracking
  const [visitedByCountry, setVisitedByCountry] = useState<VisitedByCountry>({});
  const [tripsByCountry, setTripsByCountry] = useState<TripsByCountry>({});

  // Feedback (local only)
  const [feedbackByCityId, setFeedbackByCityId] = useState<Record<string, CityFeedback>>({});

  // Sort + compare pins
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]); // up to 2 ids

  // Drawer open state
  const [compareOpen, setCompareOpen] = useState<boolean>(false);

  // -------------------- localStorage load --------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<{
        profileId: ProfileId;
        departure: "nyc" | "phl";
        month: string;
        tripDays: number;
        fineDiningNights: number;
        hotelStarFocus: 4 | 5;
        budgetUsd: number | null;
        regionFilters: Record<(typeof REGIONS)[number], boolean>;
        minSafety: number;
        customRaw: RawWeights;
        sortKey: SortKey;
        pinnedIds: string[];
        visitedByCountry: VisitedByCountry;
        tripsByCountry: TripsByCountry;
        feedbackByCityId: Record<string, CityFeedback>;
      }>;

      if (parsed.profileId) setProfileId(parsed.profileId);
      if (parsed.departure) setDeparture(parsed.departure);
      if (parsed.month) setMonth(parsed.month);
      if (typeof parsed.tripDays === "number") setTripDays(parsed.tripDays);
      if (typeof parsed.fineDiningNights === "number") setFineDiningNights(parsed.fineDiningNights);
      if (parsed.hotelStarFocus === 4 || parsed.hotelStarFocus === 5) setHotelStarFocus(parsed.hotelStarFocus);
      if (typeof parsed.budgetUsd === "number") setBudgetUsd(parsed.budgetUsd);
      if (parsed.regionFilters) setRegionFilters(parsed.regionFilters);
      if (typeof parsed.minSafety === "number") setMinSafety(parsed.minSafety);
      if (parsed.customRaw) setCustomRaw(sanitizeRawWeights(parsed.customRaw));
      if (parsed.sortKey) setSortKey(parsed.sortKey);
      if (Array.isArray(parsed.pinnedIds)) setPinnedIds(parsed.pinnedIds.slice(0, 2));
      if (parsed.visitedByCountry && typeof parsed.visitedByCountry === "object") setVisitedByCountry(parsed.visitedByCountry);
      if (parsed.tripsByCountry && typeof parsed.tripsByCountry === "object") setTripsByCountry(sanitizeTripsMap(parsed.tripsByCountry));
      if (parsed.feedbackByCityId && typeof parsed.feedbackByCityId === "object") setFeedbackByCityId(parsed.feedbackByCityId);
    } catch {
      // ignore
    }
  }, []);

  // -------------------- localStorage save --------------------
  useEffect(() => {
    try {
      const payload = {
        profileId,
        departure,
        month,
        tripDays,
        fineDiningNights,
        hotelStarFocus,
        budgetUsd: typeof budgetUsd === "number" ? budgetUsd : null,
        regionFilters,
        minSafety,
        customRaw,
        sortKey,
        pinnedIds,
        visitedByCountry,
        tripsByCountry,
        feedbackByCityId,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [
    profileId,
    departure,
    month,
    tripDays,
    fineDiningNights,
    hotelStarFocus,
    budgetUsd,
    regionFilters,
    minSafety,
    customRaw,
    sortKey,
    pinnedIds,
    visitedByCountry,
    tripsByCountry,
    feedbackByCityId,
  ]);

  const baseProfile = PROFILES.find((p) => p.id === profileId)!;
  const isCustom = profileId === "custom";

  const effectiveProfile: ProfileWithWeightsPct = useMemo(() => {
    if (!isCustom) return baseProfile as ProfileWithWeightsPct;

    const norm = normalizeWeights(customRaw);
    return {
      id: "custom",
      name: "Custom",
      description: "Tune the priorities yourself.",
      wFlight: norm.flight,
      wHotel: norm.hotel,
      wDiningValue: norm.diningValue,
      wCulinaryDensity: norm.culinaryDensity,
      wShopping: norm.shopping,
      wSafetyTransit: norm.safetyTransit,
      wWeather: norm.weather,
      wCrowds: norm.crowds,
      weightsPct: customRaw,
    };
  }, [isCustom, baseProfile, customRaw]);

  const activeRegionLabels = REGIONS.filter((r) => regionFilters[r]);
  const anyRegionOff = REGIONS.some((r) => !regionFilters[r]);
  const filtersActive = anyRegionOff || minSafety > 0;

  const filteredCities = useMemo(() => {
    return CITIES.filter((c: any) => {
      const regionOk = (regionFilters as any)[c.region] ?? false;
      const safetyOk = (c.safetyIndex ?? 0) >= minSafety;
      return regionOk && safetyOk;
    });
  }, [regionFilters, minSafety]);

  const scoredBase = useMemo(() => {
    return scoreCities(filteredCities as any, effectiveProfile as Profile, {
      departure,
      tripDays,
      fineDiningNights,
      hotelStarFocus,
      visitedByCountry,
      tripsByCountry,
      budgetUsd: typeof budgetUsd === "number" ? budgetUsd : null,
    });
  }, [
    filteredCities,
    effectiveProfile,
    departure,
    tripDays,
    fineDiningNights,
    hotelStarFocus,
    visitedByCountry,
    tripsByCountry,
    budgetUsd,
  ]);

  const scored = useMemo(() => {
    const copy = scoredBase.slice();
    if (sortKey === "overall") return copy;

    return copy.sort((a, b) => {
      const av = (a as any).components?.[sortKey] ?? 0;
      const bv = (b as any).components?.[sortKey] ?? 0;
      return bv - av;
    });
  }, [scoredBase, sortKey]);

  // If selected city gets filtered out, close modal
  useEffect(() => {
    if (!selected) return;
    const stillThere = scored.some(
      (s: any) => (s.city?.id ?? s.id) === ((selected as any).city?.id ?? (selected as any).id)
    );
    if (!stillThere) setSelected(null);
  }, [scored, selected]);

  const activeCount = filteredCities.length;

  const topPicks = scored.slice(0, 3);
  const strongOptions = scored.slice(3, 7);
  const moreOptions = scored.slice(7);
  const empty = scored.length === 0;

  const pinned = useMemo(() => {
    const map = new Map(scoredBase.map((s: any) => [(s.city?.id ?? s.id) as string, s]));
    return pinnedIds.map((id) => map.get(id)).filter(Boolean) as ScoredCity[];
  }, [pinnedIds, scoredBase]);

  function togglePin(it: any) {
    const id = (it.city?.id ?? it.id) as string;

    setPinnedIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        const next = prev.filter((x) => x !== id);
        if (next.length === 0) setCompareOpen(false);
        return next;
      }

      if (prev.length < 2) {
        const next = [...prev, id];
        if (next.length === 2) setCompareOpen(true);
        return next;
      }

      setCompareOpen(true);
      return [prev[1], id];
    });
  }

  function resetFilters() {
    setRegionFilters(DEFAULT_REGION_FILTERS);
    setMinSafety(0);
  }

  function resetCustomWeights() {
    setCustomRaw(DEFAULT_CUSTOM_RAW);
  }

  function maxAllCustomWeights() {
    setCustomRaw({
      flight: 100,
      hotel: 100,
      diningValue: 100,
      culinaryDensity: 100,
      shopping: 100,
      safetyTransit: 100,
      weather: 100,
      crowds: 100,
    });
  }

  function setVisited(country: string, visited: boolean) {
    const key = (country ?? "").trim();
    if (!key) return;
    setVisitedByCountry((prev) => ({ ...prev, [key]: visited }));
    if (!visited) setTripsByCountry((prev) => ({ ...prev, [key]: 0 }));
  }

  function setTrips(country: string, trips: number) {
    const key = (country ?? "").trim();
    if (!key) return;
    const t = clampInt(trips, 0, 999);
    setTripsByCountry((prev) => ({ ...prev, [key]: t }));
    if (t > 0) setVisitedByCountry((prev) => ({ ...prev, [key]: true }));
  }

  const summaryParts = [
    `${effectiveProfile.name}`,
    departure === "nyc" ? "NYC" : "PHL",
    `${tripDays}d`,
    `${fineDiningNights} fine`,
    `${hotelStarFocus}★ focus`,
  ];

  if (typeof budgetUsd === "number") summaryParts.push(`Budget $${Math.round(budgetUsd)}`);
  if (minSafety > 0) summaryParts.push(`Safety ≥ ${minSafety}`);
  if (activeRegionLabels.length !== REGIONS.length) summaryParts.push(activeRegionLabels.join(", "));

  const weightBarsPct: RawWeights = useMemo(() => {
    if (isCustom) return customRaw;

    const w = (effectiveProfile.weightsPct ?? {}) as Partial<Record<WeightKey, number>>;
    return {
      flight: clamp0to100(nOr(w.flight, 0)),
      hotel: clamp0to100(nOr(w.hotel, 0)),
      diningValue: clamp0to100(nOr(w.diningValue, 0)),
      culinaryDensity: clamp0to100(nOr(w.culinaryDensity, 0)),
      shopping: clamp0to100(nOr(w.shopping, 0)),
      safetyTransit: clamp0to100(nOr(w.safetyTransit, 0)),
      weather: clamp0to100(nOr(w.weather, 0)),
      crowds: clamp0to100(nOr(w.crowds, 0)),
    };
  }, [isCustom, customRaw, effectiveProfile]);

  const normalizedForScoring = useMemo(() => normalizeToShares(weightBarsPct), [weightBarsPct]);

  const selectedCountry = (selected?.city?.country ?? "").trim();
  const selectedVisited = selectedCountry ? visitedByCountry[selectedCountry] : undefined;
  const selectedTrips = selectedCountry ? tripsByCountry[selectedCountry] : undefined;

  const selectedId = (selected?.city?.id ?? "") as string;
  const selectedFeedback = selectedId ? feedbackByCityId[selectedId] : undefined;

  const chipBase = "ui-chip text-xs font-semibold";
  const chipInk = "text-neutral-800 dark:text-neutral-100";

  // ✅ Shift logic:
  const shouldShiftModal = compareOpen && pinnedIds.length > 0;
  const modalShiftLeftPx = shouldShiftModal ? 210 : 0;

  return (
    <main className="bg-parchment mx-auto max-w-6xl px-4 py-8">
      {/* Sticky summary bar */}
      <div className="sticky top-0 z-40 -mx-4 mb-6 paper-muted px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`${chipBase} ${chipInk}`}
              title="Prototype results using curated estimates (not live API data yet)."
            >
              Prototype data
            </span>

            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {summaryParts.join(" · ")}
            </div>

            <div className="text-xs text-neutral-600 dark:text-neutral-300">
              · Showing{" "}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {activeCount}
              </span>{" "}
              {activeCount === 1 ? "city" : "cities"}
            </div>

            <a
              href="/methodology"
              className="ml-1 ui-link text-xs font-semibold text-neutral-800 dark:text-neutral-100"
              title="Read the model thesis"
            >
              Model thesis
            </a>

            <span
              className={`${chipBase} ui-btn-accent`}
              title="Pin up to 2 cities to compare"
            >
              Pinned {pinnedIds.length}/2
            </span>

            {pinnedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="ui-btn rounded-full px-3 py-1 text-xs font-semibold text-neutral-800 dark:text-neutral-100"
              >
                Open compare
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="ui-btn rounded-full px-3 py-1 text-xs font-medium text-neutral-800 dark:text-neutral-100"
              >
                Reset filters
              </button>
            )}

            {pinnedIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPinnedIds([]);
                  setCompareOpen(false);
                }}
                className="ui-btn ui-btn-accent rounded-full px-3 py-1 text-xs font-medium"
              >
                Clear compare ({pinnedIds.length}/2)
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Sort
              </span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="ui-input rounded-xl px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
              >
                <option value="overall">Overall alignment</option>
                <option value="flight">Flight affordability</option>
                <option value="hotel">Hotel affordability</option>
                <option value="diningValue">Dining affordability</option>
                <option value="culinaryDensity">Culinary density</option>
                <option value="shopping">Shopping savings</option>
                <option value="safetyTransit">Safety & transit</option>
                <option value="weather">Weather fit</option>
                <option value="crowds">Low crowds</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="text-xs font-semibold tracking-widest text-emerald-700">
          DECISION FRAMEWORK
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          <span className="text-neutral-600 dark:text-neutral-300">Align</span>{" "}
          <span className="text-emerald-700 underline decoration-emerald-200 underline-offset-4 dark:text-emerald-400 dark:decoration-emerald-900/40">
            Cities
          </span>{" "}
          <span className="text-neutral-600 dark:text-neutral-300">to your priorities</span>
        </h1>

        <p className="text-neutral-700 dark:text-neutral-200">
          Adjust what matters. See how rankings shift — with transparent tradeoffs.
        </p>

        {pinned.length > 0 && (
          <div className="text-xs text-neutral-700 dark:text-neutral-200">
            Comparing:{" "}
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {pinned.map((p: any) => p.city?.name ?? p.name).join(" vs ")}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-6 grid gap-3 paper p-4 md:grid-cols-6">
        {/* Profile */}
        <div className="space-y-1 md:col-span-2">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
            Profile
          </div>

          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value as ProfileId)}
            className="ui-input w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          >
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="text-xs text-neutral-600 dark:text-neutral-300">
            {effectiveProfile.description}
          </div>

          {isCustom && (
            <div className="mt-3 paper-muted p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Custom priorities
                </div>
                <div
                  className="text-xs text-neutral-600 dark:text-neutral-300"
                  title="We normalize internally for scoring."
                >
                  Sum:{" "}
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {sumRaw(customRaw)}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <WeightSlider label="Flight value" value={customRaw.flight} onChange={(v) => setCustomRaw((p) => ({ ...p, flight: v }))} />
                <WeightSlider label="Hotel yield" value={customRaw.hotel} onChange={(v) => setCustomRaw((p) => ({ ...p, hotel: v }))} />
                <WeightSlider label="Dining value" value={customRaw.diningValue} onChange={(v) => setCustomRaw((p) => ({ ...p, diningValue: v }))} />
                <WeightSlider label="Culinary density" value={customRaw.culinaryDensity} onChange={(v) => setCustomRaw((p) => ({ ...p, culinaryDensity: v }))} />
                <WeightSlider label="Shopping arbitrage" value={customRaw.shopping} onChange={(v) => setCustomRaw((p) => ({ ...p, shopping: v }))} />
                <WeightSlider label="Safety & transit" value={customRaw.safetyTransit} onChange={(v) => setCustomRaw((p) => ({ ...p, safetyTransit: v }))} />
                <WeightSlider label="Weather fit" value={customRaw.weather} onChange={(v) => setCustomRaw((p) => ({ ...p, weather: v }))} />
                <WeightSlider label="Low crowds" value={customRaw.crowds} onChange={(v) => setCustomRaw((p) => ({ ...p, crowds: v }))} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetCustomWeights}
                  className="ui-btn rounded-full px-3 py-1 text-xs font-medium text-neutral-800 dark:text-neutral-100"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={maxAllCustomWeights}
                  className="ui-btn ui-btn-accent rounded-full px-3 py-1 text-xs font-medium"
                  title="Max all sliders (we still normalize internally)"
                >
                  Max all
                </button>
              </div>

              <div className="mt-3 text-xs text-neutral-700 dark:text-neutral-200">
                Effective (normalized):{" "}
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {fmtPct((effectiveProfile as any).wFlight)} flight · {fmtPct((effectiveProfile as any).wHotel)} hotel ·{" "}
                  {fmtPct((effectiveProfile as any).wDiningValue)} dining · {fmtPct((effectiveProfile as any).wCulinaryDensity)} culinary ·{" "}
                  {fmtPct((effectiveProfile as any).wShopping)} shopping · {fmtPct((effectiveProfile as any).wSafetyTransit)} safety ·{" "}
                  {fmtPct((effectiveProfile as any).wWeather)} weather · {fmtPct((effectiveProfile as any).wCrowds)} crowds
                </span>
              </div>
            </div>
          )}

          {/* Weight breakdown */}
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
              Priority breakdown
            </div>
            <WeightBarsPct weightsPct={weightBarsPct} />
            <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
              Raw priority weights (0–100 each). Scoring normalizes internally. Normalized:{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {fmtPct(normalizedForScoring.flight)} flight · {fmtPct(normalizedForScoring.hotel)} hotel ·{" "}
                {fmtPct(normalizedForScoring.diningValue)} dining · {fmtPct(normalizedForScoring.culinaryDensity)} culinary ·{" "}
                {fmtPct(normalizedForScoring.shopping)} shopping · {fmtPct(normalizedForScoring.safetyTransit)} safety ·{" "}
                {fmtPct(normalizedForScoring.weather)} weather · {fmtPct(normalizedForScoring.crowds)} crowds
              </span>
            </div>
          </div>
        </div>

        {/* Departure */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Departure</div>
          <select
            value={departure}
            onChange={(e) => setDeparture(e.target.value as "nyc" | "phl")}
            className="ui-input w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          >
            <option value="nyc">New York City (NYC)</option>
            <option value="phl">Philadelphia (PHL)</option>
          </select>
          <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
            Wired into flight cost + estimated trip cost.
          </div>
        </div>

        {/* Month */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Month</div>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ui-input w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
            UI placeholder for now (seasonality hooks come next).
          </div>
        </div>

        {/* Trip length */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Trip length (days)</div>
          <input
            type="number"
            min={3}
            max={21}
            value={tripDays}
            onChange={(e) => setTripDays(parseInt(e.target.value || "7", 10))}
            className="ui-input w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </div>

        {/* Fine dining nights */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Fine dining nights</div>
          <input
            type="number"
            min={0}
            max={tripDays}
            value={fineDiningNights}
            onChange={(e) => setFineDiningNights(parseInt(e.target.value || "0", 10))}
            className="ui-input w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </div>

        {/* Hotel focus */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Hotel focus</div>
          <select
            value={hotelStarFocus}
            onChange={(e) => setHotelStarFocus(parseInt(e.target.value, 10) as 4 | 5)}
            className="ui-input w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          >
            <option value={4}>Prioritize 4★ value</option>
            <option value={5}>Prioritize 5★ value</option>
          </select>
        </div>

        {/* Total budget */}
        <div className="space-y-1 md:col-span-2">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Total budget (USD)</div>
          <input
            type="number"
            min={0}
            placeholder="e.g. 2500"
            value={budgetUsd}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") return setBudgetUsd("");
              const n = parseFloat(v);
              setBudgetUsd(Number.isFinite(n) ? Math.max(0, n) : "");
            }}
            className="ui-input w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
          <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
            Used only for <span className="font-medium text-neutral-900 dark:text-neutral-100">Overbudget / Underbudget</span> labels (no score penalty).
          </div>
        </div>

        {/* Region filters */}
        <div className="space-y-1 md:col-span-2">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Regions</div>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => {
              const on = regionFilters[r];

              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegionFilters((prev) => ({ ...prev, [r]: !prev[r] }))}
                  className={[
                    "ui-btn rounded-full px-3 py-1 text-sm font-semibold",
                    on ? "ui-btn-accent" : "text-neutral-800 dark:text-neutral-100",
                  ].join(" ")}
                >
                  {r}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Active:</span>

            {activeRegionLabels.length === REGIONS.length ? (
              <span className={`${chipBase} ${chipInk}`}>All regions</span>
            ) : (
              activeRegionLabels.map((r) => (
                <span key={r} className={`${chipBase} ui-btn-accent`}>
                  {r}
                </span>
              ))
            )}

            {minSafety > 0 && (
              <span className={`${chipBase} ui-btn-accent`}>Safety ≥ {minSafety}</span>
            )}
          </div>
        </div>

        {/* Minimum safety */}
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-200">
            <span>Minimum safety</span>
            <span className="font-semibold text-emerald-800 dark:text-emerald-400">{minSafety}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={minSafety}
            onChange={(e) => setMinSafety(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-600"
          />
          <div className="text-xs text-neutral-600 dark:text-neutral-300">
            Showing{" "}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{activeCount}</span>{" "}
            {activeCount === 1 ? "city" : "cities"}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 space-y-10">
        {empty ? (
          <div className="paper-muted rounded-2xl p-6 text-sm text-neutral-700 dark:text-neutral-200">
            No cities match your filters. Try lowering “Minimum safety” or re-enabling regions.
          </div>
        ) : (
          <>
            <RankedSection
              kicker="HIGHEST ALIGNMENT"
              title="Top alignment"
              subtitle="Best fits for your current priorities and filters."
              items={topPicks}
              onSelect={setSelected}
              pinnedIds={pinnedIds}
              onTogglePin={togglePin}
            />

            {strongOptions.length > 0 && (
              <RankedSection
                kicker="MEANINGFUL TRADEOFFS"
                title="Strong alternatives"
                subtitle="Close contenders with different strengths."
                items={strongOptions}
                onSelect={setSelected}
                pinnedIds={pinnedIds}
                onTogglePin={togglePin}
              />
            )}

            {moreOptions.length > 0 && (
              <RankedSection
                kicker="OTHER FITS"
                title="More options"
                subtitle="Worth considering depending on what you prioritize next."
                items={moreOptions}
                onSelect={setSelected}
                pinnedIds={pinnedIds}
                onTogglePin={togglePin}
              />
            )}
          </>
        )}
      </div>

      {selected ? (
  <CityModal
    selected={selected}
    onClose={() => setSelected(null)}
    country={selectedCountry}
    visited={selectedVisited}
    trips={selectedTrips}
    onSetVisited={(v) => {
      if (!selectedCountry) return;
      setVisited(selectedCountry, v);
    }}
    onSetTrips={(n) => {
      if (!selectedCountry) return;
      setTrips(selectedCountry, n);
    }}
    feedback={selectedId ? selectedFeedback : undefined}
    onSetFeedback={(next) => {
      if (!selectedId) return;
      setFeedbackByCityId((prev) => ({ ...prev, [selectedId]: next }));
    }}
    shiftLeftPx={modalShiftLeftPx}
    isCompareOpen={compareOpen}
  />
) : null}

      <CompareDrawer
        pinned={pinned}
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        onClear={() => {
          setPinnedIds([]);
          setCompareOpen(false);
        }}
        onSwap={() => {
          if (pinnedIds.length === 2) setPinnedIds([pinnedIds[1], pinnedIds[0]]);
        }}
        onSelect={(c) => setSelected(c)}
      />
    </main>
  );
}

/* -------------------- weight UI -------------------- */

function WeightBarsPct({ weightsPct }: { weightsPct: RawWeights }) {
  const rows: Array<{ label: string; value: number }> = [
    { label: "Flight value", value: weightsPct.flight },
    { label: "Hotel yield", value: weightsPct.hotel },
    { label: "Dining value", value: weightsPct.diningValue },
    { label: "Culinary density", value: weightsPct.culinaryDensity },
    { label: "Shopping arbitrage", value: weightsPct.shopping },
    { label: "Safety & transit", value: weightsPct.safetyTransit },
    { label: "Weather fit", value: weightsPct.weather },
    { label: "Low crowds", value: weightsPct.crowds },
  ].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <WeightBarPct key={r.label} label={r.label} value={r.value} />
      ))}
    </div>
  );
}

function WeightBarPct({ label, value }: { label: string; value: number }) {
  const pct = Math.round(clamp0to100(value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-200">
        <span>{label}</span>
        <span className="font-semibold text-emerald-800 dark:text-emerald-400">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900/40">
        <div className="h-1.5 bg-emerald-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-200">
        <span className="font-medium">{label}</span>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{Math.round(v)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={v}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="mt-1 w-full accent-emerald-600"
      />
    </div>
  );
}

/* -------------------- helpers -------------------- */

function nOr(n: unknown, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clamp0to100(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function clampInt(n: unknown, lo: number, hi: number) {
  const x = typeof n === "number" ? n : parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

function sumRaw(w: RawWeights) {
  return (
    w.flight +
    w.hotel +
    w.diningValue +
    w.culinaryDensity +
    w.shopping +
    w.safetyTransit +
    w.weather +
    w.crowds
  );
}

function sanitizeRawWeights(raw: RawWeights): RawWeights {
  return {
    flight: clamp0to100(nOr(raw.flight, 0)),
    hotel: clamp0to100(nOr(raw.hotel, 0)),
    diningValue: clamp0to100(nOr(raw.diningValue, 0)),
    culinaryDensity: clamp0to100(nOr(raw.culinaryDensity, 0)),
    shopping: clamp0to100(nOr(raw.shopping, 0)),
    safetyTransit: clamp0to100(nOr(raw.safetyTransit, 0)),
    weather: clamp0to100(nOr(raw.weather, 0)),
    crowds: clamp0to100(nOr(raw.crowds, 0)),
  };
}

function sanitizeTripsMap(raw: TripsByCountry): TripsByCountry {
  const out: TripsByCountry = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const key = (k ?? "").trim();
    if (!key) continue;
    out[key] = clampInt(v, 0, 999);
  }
  return out;
}

function normalizeWeights(raw: RawWeights): Record<WeightKey, number> {
  const total = sumRaw(raw);
  if (!total) {
    const eq = 1 / 8;
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
    flight: raw.flight / total,
    hotel: raw.hotel / total,
    diningValue: raw.diningValue / total,
    culinaryDensity: raw.culinaryDensity / total,
    shopping: raw.shopping / total,
    safetyTransit: raw.safetyTransit / total,
    weather: raw.weather / total,
    crowds: raw.crowds / total,
  };
}

function normalizeToShares(rawPct: RawWeights): Record<WeightKey, number> {
  const total = sumRaw(rawPct);
  if (!total) {
    const eq = 1 / 8;
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
    flight: rawPct.flight / total,
    hotel: rawPct.hotel / total,
    diningValue: rawPct.diningValue / total,
    culinaryDensity: rawPct.culinaryDensity / total,
    shopping: rawPct.shopping / total,
    safetyTransit: rawPct.safetyTransit / total,
    weather: rawPct.weather / total,
    crowds: rawPct.crowds / total,
  };
}

function fmtPct(w: number) {
  return `${Math.round(w * 100)}%`;
}