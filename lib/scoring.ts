// lib/scoring.ts
// Safety-hardened scoring + independent weights (each 0–100, NOT sum-capped).
// Internally we normalize by total weight only for computing a 0..100 totalScore.

export type Tier = "S" | "A" | "B" | "C" | "D";
export type PersonalFeedback = "love" | "maybe" | "pass";

export type GroupDynamicTravelStyle =
  | "solo"
  | "partner"
  | "friends"
  | "family"
  | "family_with_kids"
  | "multigenerational"
  | "other";

export type GroupDynamicState = {
  travelStyle: GroupDynamicTravelStyle;
  adults: number;
  kids: number;
  babies: number;
  elders: number;
  mobilityNeeds: boolean;
  disabilityNeeds: boolean;
  strollerNeeds: boolean;
  comfortSensitive: boolean;
};

export type DriverKey =
  | "flight"
  | "hotel"
  | "diningValue"
  | "culinaryDensity"
  | "shopping"
  | "safetyTransit"
  | "weather"
  | "crowds";

export type ScoreComponents = Partial<Record<DriverKey, number>>;

export type TopDriver = {
  key: DriverKey;
  label: string;
  points: number; // normalized contribution (comparable across drivers)
  score: number; // 0..100
  weight: number; // 0..1 (normalized for interpretation)
  weightRaw: number; // raw 0..100 slider value
};

export type ExplainPenalty = { key: string; points: number; reason: string };

export type Explain = {
  coverage: Record<DriverKey, 0 | 1>;
  confidence: number; // 0..1
  penalties: ExplainPenalty[];

  // Personalization
  familiarityAdj: number; // visit-history adjustment
  feedbackAdj: number; // love/maybe/pass adjustment
  personalizationAdj: number; // capped final personalization adjustment

  // Trip context
  groupDynamicAdj: number; // bounded trip-party adjustment
};

export type City = {
  id: string;
  name: string;
  country: string;
  region?: string;
  currency?: string;

  // hotel
  avg4StarPriceUsd?: number;
  avg5StarPriceUsd?: number;
  avg4StarReview?: number; // 0..10
  avg5StarReview?: number; // 0..10
  fourStarCount?: number;
  fiveStarCount?: number;

  // dining (USD)
  casualMealUsd?: number;
  midDinnerUsd?: number;
  fineDinnerUsd?: number;
  coffeeUsd?: number;

  // culinary
  michelinStars?: number;
  bibGourmand?: number;
  top100Presence?: number;
  cafeCultureIndex?: number; // 0..100

  // shopping
  luxuryIndexVsUS?: number; // 0..100 (higher = better value)
  contemporaryIndexVsUS?: number; // 0..100
  vatRefundPct?: number; // percent

  // safety + transit
  safetyIndex?: number; // 0..100
  transitIndex?: number; // 0..100

  // flights (USD)
  flightFrom?: {
    nyc?: number;
    phl?: number;
    [k: string]: unknown;
  };

  // weatherIndex: higher = better.
  weatherIndex?: number;

  // crowdsIndex: higher = more crowded. We invert for scoring so lower crowds score higher.
  crowdsIndex?: number;

  highlights?: string[];

  [k: string]: unknown;
};

export type Profile = {
  id: string;
  name: string;
  description?: string;

  // percent sliders 0..100 each, independent and not sum-capped.
  weightsPct?: Partial<Record<DriverKey, number>>;

  // Back-compat: some profiles might still use `weights`.
  weights?: Partial<Record<DriverKey, number>>;

  [k: string]: unknown;
};

export type BudgetStatus = "under" | "within" | "over" | "unknown";

export type TripCostBreakdown = {
  totalUsd: number | null;
  flightUsd: number | null;
  hotelUsd: number | null;
  foodUsd: number | null;
};

export type ScoreOptions = {
  departure?: "nyc" | "phl";
  tripDays?: number;
  fineDiningNights?: number;
  hotelStarFocus?: 4 | 5;

  // city-level personalization
  visitedByCity?: Record<string, boolean>;
  tripsByCity?: Record<string, number>;
  feedbackByCity?: Record<string, PersonalFeedback | undefined>;

  // Back-compat country-level familiarity
  visitedByCountry?: Record<string, boolean>;
  tripsByCountry?: Record<string, number>;

  // budget (USD) — informational only
  budgetUsd?: number | null;

  // group dynamic / trip party context
  groupDynamic?: GroupDynamicState | null;
};

export type ScoredCity = {
  city: City;
  totalScore: number; // 0..100
  tier: Tier;
  components: ScoreComponents; // each 0..100
  topDrivers: TopDriver[];
  highlights: string[];
  explain: Explain;

  // Budget / cost. Informational, but the group dynamic can affect the estimate.
  estimatedTripCostUsd: number | null;
  costBreakdownUsd: TripCostBreakdown;
  budgetUsd: number | null;
  budgetDeltaUsd: number | null; // estimated - budget; positive = over
  budgetStatus: BudgetStatus;
};

// ------------------------
// helpers
// ------------------------

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function nOr(n: unknown, fallback = 0): number {
  return isFiniteNumber(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function clamp0to100(n: number): number {
  return clamp(n, 0, 100);
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function safeStrList(v: unknown): string[] {
  return safeArray<unknown>(v).filter((x): x is string => typeof x === "string");
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function avg(nums: number[]): number {
  const xs = nums.filter((x) => Number.isFinite(x));
  return xs.length ? sum(xs) / xs.length : 0;
}

function quantile(sortedAsc: number[], q: number): number {
  const s = sortedAsc;
  if (!s.length) return 0;

  const qq = clamp(q, 0, 1);
  const pos = (s.length - 1) * qq;
  const base = Math.floor(pos);
  const rest = pos - base;

  const a = s[base] ?? s[s.length - 1]!;
  const b = s[base + 1] ?? a;

  return a + (b - a) * rest;
}

function robustBand(xs: number[]) {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return {
    p10: quantile(s, 0.1),
    p90: quantile(s, 0.9),
  };
}

function robustNormalize(value: number, p10: number, p90: number, invert = false): number {
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90)) return 0;
  if (p90 - p10 < 1e-9) return 50;

  const w = clamp(value, p10, p90);
  const t = (w - p10) / (p90 - p10);
  const u = invert ? 1 - t : t;

  return clamp0to100(u * 100);
}

function tierFromScore(totalScore: number): Tier {
  const s = clamp0to100(totalScore);

  if (s >= 85) return "S";
  if (s >= 75) return "A";
  if (s >= 65) return "B";
  if (s >= 55) return "C";

  return "D";
}

const DRIVER_LABELS: Record<DriverKey, string> = {
  flight: "Flight value",
  hotel: "Hotel yield",
  diningValue: "Dining value",
  culinaryDensity: "Culinary density",
  shopping: "Shopping arbitrage",
  safetyTransit: "Safety + transit",
  weather: "Weather fit",
  crowds: "Low crowds",
};

// ------------------------
// raw extractors
// ------------------------

function computeRawFlightCost(city: City, departure?: "nyc" | "phl"): number | null {
  if (departure) {
    const from = nOr((city.flightFrom as any)?.[departure], NaN);
    if (Number.isFinite(from)) return from;
  }

  const nyc = nOr(city.flightFrom?.nyc, NaN);
  const phl = nOr(city.flightFrom?.phl, NaN);
  const vals = [nyc, phl].filter((x) => Number.isFinite(x));

  return vals.length ? avg(vals) : null;
}

function computeRawHotelCost(city: City): number | null {
  const p4 = nOr(city.avg4StarPriceUsd, NaN);
  const p5 = nOr(city.avg5StarPriceUsd, NaN);
  const vals = [p4, p5].filter((x) => Number.isFinite(x));

  return vals.length ? avg(vals) : null;
}

function computeRawDiningCost(city: City): number | null {
  const casual = nOr(city.casualMealUsd, NaN);
  const mid = nOr(city.midDinnerUsd, NaN);
  const fine = nOr(city.fineDinnerUsd, NaN);
  const coffee = nOr(city.coffeeUsd, NaN);
  const vals = [casual, mid, fine, coffee].filter((x) => Number.isFinite(x));

  return vals.length ? avg(vals) : null;
}

function computeRawCulinarySignal(city: City): number | null {
  const stars = nOr(city.michelinStars, 0);
  const bib = nOr(city.bibGourmand, 0);
  const top100 = nOr(city.top100Presence, 0);
  const cafe = nOr(city.cafeCultureIndex, 0);

  const signal = stars * 8 + bib * 3 + top100 * 5 + cafe * 0.5;

  return Number.isFinite(signal) ? signal : null;
}

function computeRawShoppingSignal(city: City): number | null {
  const lux = nOr(city.luxuryIndexVsUS, NaN);
  const cont = nOr(city.contemporaryIndexVsUS, NaN);
  const vat = nOr(city.vatRefundPct, NaN);

  const any = [lux, cont, vat].some((x) => Number.isFinite(x));
  if (!any) return null;

  const signal =
    (Number.isFinite(lux) ? lux : 0) * 0.45 +
    (Number.isFinite(cont) ? cont : 0) * 0.45 +
    (Number.isFinite(vat) ? vat : 0) * 1.5;

  return Number.isFinite(signal) ? signal : null;
}

function computeRawSafetyTransitSignal(city: City): number | null {
  const safety = nOr(city.safetyIndex, NaN);
  const transit = nOr(city.transitIndex, NaN);
  const vals = [safety, transit].filter((x) => Number.isFinite(x));

  return vals.length ? avg(vals) : null;
}

function computeRawWeatherIndex(city: City): number | null {
  const v = nOr(city.weatherIndex, NaN);
  return Number.isFinite(v) ? clamp0to100(v) : null;
}

function computeRawCrowdsIndex(city: City): number | null {
  const v = nOr(city.crowdsIndex, NaN);
  return Number.isFinite(v) ? clamp0to100(v) : null;
}

// ------------------------
// weights: independent sliders
// ------------------------

const DRIVER_KEYS: DriverKey[] = [
  "flight",
  "hotel",
  "diningValue",
  "culinaryDensity",
  "shopping",
  "safetyTransit",
  "weather",
  "crowds",
];

function normalizeWeightsFromProfile(profile: Profile): {
  rawPct: Record<DriverKey, number>; // 0..100 each
  norm: Record<DriverKey, number>; // sums to 1
} {
  const src = (profile?.weightsPct ?? profile?.weights ?? {}) as Partial<Record<DriverKey, number>>;

  // Accept either percents 0..100 or fractions 0..1.
  const rawPct: Record<DriverKey, number> = DRIVER_KEYS.reduce((acc, k) => {
    const v = nOr(src[k], 0);
    const pct = v > 1.5 ? v : v * 100;
    acc[k] = clamp(pct, 0, 100);
    return acc;
  }, {} as Record<DriverKey, number>);

  const totalPct = sum(Object.values(rawPct));

  const norm: Record<DriverKey, number> = DRIVER_KEYS.reduce((acc, k) => {
    acc[k] = totalPct > 0 ? rawPct[k] / totalPct : 1 / DRIVER_KEYS.length;
    return acc;
  }, {} as Record<DriverKey, number>);

  return { rawPct, norm };
}

// ------------------------
// Budget / cost model
// ------------------------

function normalizeGroupDynamic(raw: unknown): GroupDynamicState {
  const r = (raw ?? {}) as Partial<GroupDynamicState> & Record<string, unknown>;

  const travelStyle =
    r.travelStyle === "partner" ||
    r.travelStyle === "friends" ||
    r.travelStyle === "family" ||
    r.travelStyle === "family_with_kids" ||
    r.travelStyle === "multigenerational" ||
    r.travelStyle === "other"
      ? r.travelStyle
      : "solo";

  const solo = travelStyle === "solo";

  return {
    travelStyle,
    adults: solo ? 1 : clamp(Math.floor(nOr(r.adults, 2)), 1, 30),
    kids: solo ? 0 : clamp(Math.floor(nOr(r.kids, 0)), 0, 30),
    babies: solo ? 0 : clamp(Math.floor(nOr(r.babies, 0)), 0, 10),
    elders: solo ? 0 : clamp(Math.floor(nOr(r.elders, 0)), 0, 20),
    mobilityNeeds: !!r.mobilityNeeds,
    disabilityNeeds: !!r.disabilityNeeds,
    strollerNeeds: !!r.strollerNeeds,
    comfortSensitive: !!r.comfortSensitive,
  };
}

function getGroupPartyMath(raw: unknown) {
  const group = normalizeGroupDynamic(raw);

  const travelers = Math.max(1, group.adults + group.kids + group.babies + group.elders);

  // Babies/toddlers often do not create a full extra fare/meal/room need,
  // but they strongly increase comfort and logistics sensitivity.
  const flightEquivalent = Math.max(1, group.adults + group.elders + group.kids + group.babies * 0.25);
  const foodEquivalent = Math.max(1, group.adults + group.elders + group.kids * 0.65 + group.babies * 0.15);
  const roomEquivalent = Math.max(1, Math.ceil((group.adults + group.elders + group.kids * 0.75) / 2));

  return {
    group,
    travelers,
    flightEquivalent,
    foodEquivalent,
    roomEquivalent,
  };
}

function estimateTripCostBreakdownUsd(city: City, opts: ScoreOptions): TripCostBreakdown {
  const tripDays = clamp(Math.floor(nOr(opts.tripDays, 7)), 1, 60);
  const fineNights = clamp(Math.floor(nOr(opts.fineDiningNights, 0)), 0, tripDays);
  const hotelStar = opts.hotelStarFocus === 4 ? 4 : 5;
  const groupMath = getGroupPartyMath(opts.groupDynamic);

  const flight = computeRawFlightCost(city, opts.departure);

  const nightly = hotelStar === 5 ? nOr(city.avg5StarPriceUsd, NaN) : nOr(city.avg4StarPriceUsd, NaN);
  const hotelCost = Number.isFinite(nightly) ? nightly * tripDays * groupMath.roomEquivalent : null;

  const casual = nOr(city.casualMealUsd, NaN);
  const mid = nOr(city.midDinnerUsd, NaN);
  const fine = nOr(city.fineDinnerUsd, NaN);
  const coffee = nOr(city.coffeeUsd, NaN);

  const foodCostRaw =
    (Number.isFinite(casual) ? casual * tripDays * groupMath.foodEquivalent : NaN) +
    (Number.isFinite(coffee) ? coffee * tripDays * groupMath.foodEquivalent : NaN) +
    (Number.isFinite(mid) ? mid * (tripDays - fineNights) * groupMath.foodEquivalent : NaN) +
    (Number.isFinite(fine) ? fine * fineNights * groupMath.foodEquivalent : NaN);

  const foodCost = Number.isFinite(foodCostRaw) ? foodCostRaw : null;

  const flightUsd = flight == null ? null : flight * groupMath.flightEquivalent;
  const hotelUsd = hotelCost;
  const foodUsd = foodCost;

  const parts = [flightUsd, hotelUsd, foodUsd].filter((x): x is number => Number.isFinite(x as any));
  const totalUsd = parts.length ? Math.max(0, sum(parts)) : null;

  return {
    totalUsd,
    flightUsd,
    hotelUsd,
    foodUsd,
  };
}

function normalizeBudgetUsd(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return null;

  const clean = Math.max(0, n);
  return clean > 0 ? clean : null;
}

function classifyBudgetStatus(budgetUsd: number | null, estimatedUsd: number | null): BudgetStatus {
  if (budgetUsd == null || estimatedUsd == null) return "unknown";

  const delta = estimatedUsd - budgetUsd;
  if (delta > 0) return "over";

  const abs = Math.abs(delta);
  const withinAbs = 100;
  const withinPct = 0.05 * budgetUsd;
  const threshold = Math.max(withinAbs, withinPct);

  return abs <= threshold ? "within" : "under";
}

function computeGroupDynamicAdjustment(components: ScoreComponents, raw: unknown): number {
  const { group, travelers } = getGroupPartyMath(raw);

  const hasGroupSignal =
    group.travelStyle !== "solo" ||
    travelers > 1 ||
    group.kids > 0 ||
    group.babies > 0 ||
    group.elders > 0 ||
    group.mobilityNeeds ||
    group.disabilityNeeds ||
    group.strollerNeeds ||
    group.comfortSensitive;

  if (!hasGroupSignal) return 0;

  const safetyTransit = clamp0to100(nOr(components.safetyTransit, 50));
  const hotel = clamp0to100(nOr(components.hotel, 50));
  const weather = clamp0to100(nOr(components.weather, 50));
  const crowds = clamp0to100(nOr(components.crowds, 50));

  const flight = clamp0to100(nOr(components.flight, 50));
  const diningValue = clamp0to100(nOr(components.diningValue, 50));

  const comfortNeedRaw =
    (group.travelStyle === "family" ? 0.6 : 0) +
    (group.travelStyle === "family_with_kids" ? 1.1 : 0) +
    (group.travelStyle === "multigenerational" ? 1.25 : 0) +
    Math.min(group.kids * 0.3, 1.2) +
    Math.min(group.babies * 0.7, 1.4) +
    Math.min(group.elders * 0.7, 1.5) +
    (group.mobilityNeeds ? 1.4 : 0) +
    (group.disabilityNeeds ? 1.6 : 0) +
    (group.strollerNeeds ? 0.9 : 0) +
    (group.comfortSensitive ? 0.9 : 0);

  const groupCostPressureRaw =
    travelers >= 5 ? 1.25 : travelers >= 3 ? 0.8 : group.travelStyle === "friends" ? 0.35 : 0;

  const comfortNeed = clamp(comfortNeedRaw / 5.25, 0, 1);
  const groupCostPressure = clamp(groupCostPressureRaw, 0, 1.25);

  // Ease fit rewards destinations that are safer, easier to move through,
  // less exhausting, less crowded, and more comfortable for this exact party.
  const easeFit = avg([safetyTransit, hotel, weather, crowds]);

  // Cost fit matters more when the same trip budget stretches across more people.
  const groupCostFit = avg([flight, hotel, diningValue]);

  const comfortAdj = clamp(((easeFit - 58) / 10) * comfortNeed, -5.5, 4);
  const costAdj = clamp(((groupCostFit - 58) / 14) * groupCostPressure, -3, 2.25);

  return clamp(comfortAdj + costAdj, -7, 4);
}

// ------------------------
// public API
// ------------------------

export function scoreCities(cities: City[], profile: Profile, options?: ScoreOptions): ScoredCity[] {
  const opts = options ?? {};
  const safeCities = safeArray<City>(cities).filter((c) => c && typeof c.id === "string");

  const { rawPct, norm } = normalizeWeightsFromProfile(profile);

  // Build raw vectors for normalization.
  const rawFlight = safeCities.map((c) => computeRawFlightCost(c, opts.departure)).filter(isFiniteNumber);
  const rawHotel = safeCities.map((c) => computeRawHotelCost(c)).filter(isFiniteNumber);
  const rawDining = safeCities.map((c) => computeRawDiningCost(c)).filter(isFiniteNumber);
  const rawCulinary = safeCities.map((c) => computeRawCulinarySignal(c)).filter(isFiniteNumber);
  const rawShopping = safeCities.map((c) => computeRawShoppingSignal(c)).filter(isFiniteNumber);
  const rawSafetyTransit = safeCities.map((c) => computeRawSafetyTransitSignal(c)).filter(isFiniteNumber);
  const rawWeather = safeCities.map((c) => computeRawWeatherIndex(c)).filter(isFiniteNumber);
  const rawCrowds = safeCities.map((c) => computeRawCrowdsIndex(c)).filter(isFiniteNumber);

  const rb = {
    flight: robustBand(rawFlight),
    hotel: robustBand(rawHotel),
    diningValue: robustBand(rawDining),
    culinaryDensity: robustBand(rawCulinary),
    shopping: robustBand(rawShopping),
    safetyTransit: robustBand(rawSafetyTransit),
    weather: robustBand(rawWeather),
    crowds: robustBand(rawCrowds),
  };

  const budgetUsd = normalizeBudgetUsd(opts.budgetUsd);

  const scored: ScoredCity[] = safeCities.map((city) => {
    const flightRaw = computeRawFlightCost(city, opts.departure);
    const hotelRaw = computeRawHotelCost(city);
    const diningRaw = computeRawDiningCost(city);
    const culinaryRaw = computeRawCulinarySignal(city);
    const shoppingRaw = computeRawShoppingSignal(city);
    const safetyTransitRaw = computeRawSafetyTransitSignal(city);
    const weatherRaw = computeRawWeatherIndex(city);
    const crowdsRaw = computeRawCrowdsIndex(city);

    const components: ScoreComponents = {
      flight: flightRaw == null ? 0 : robustNormalize(flightRaw, rb.flight.p10, rb.flight.p90, true),
      hotel: hotelRaw == null ? 0 : robustNormalize(hotelRaw, rb.hotel.p10, rb.hotel.p90, true),
      diningValue: diningRaw == null ? 0 : robustNormalize(diningRaw, rb.diningValue.p10, rb.diningValue.p90, true),
      culinaryDensity:
        culinaryRaw == null ? 0 : robustNormalize(culinaryRaw, rb.culinaryDensity.p10, rb.culinaryDensity.p90, false),
      shopping: shoppingRaw == null ? 0 : robustNormalize(shoppingRaw, rb.shopping.p10, rb.shopping.p90, false),
      safetyTransit:
        safetyTransitRaw == null
          ? 0
          : robustNormalize(safetyTransitRaw, rb.safetyTransit.p10, rb.safetyTransit.p90, false),
      weather: weatherRaw == null ? 0 : robustNormalize(weatherRaw, rb.weather.p10, rb.weather.p90, false),
      crowds: crowdsRaw == null ? 0 : robustNormalize(crowdsRaw, rb.crowds.p10, rb.crowds.p90, true),
    };

    const totalScoreBase =
      (components.flight ?? 0) * norm.flight +
      (components.hotel ?? 0) * norm.hotel +
      (components.diningValue ?? 0) * norm.diningValue +
      (components.culinaryDensity ?? 0) * norm.culinaryDensity +
      (components.shopping ?? 0) * norm.shopping +
      (components.safetyTransit ?? 0) * norm.safetyTransit +
      (components.weather ?? 0) * norm.weather +
      (components.crowds ?? 0) * norm.crowds;

    const coverage: Record<DriverKey, 0 | 1> = {
      flight: flightRaw == null ? 0 : 1,
      hotel: hotelRaw == null ? 0 : 1,
      diningValue: diningRaw == null ? 0 : 1,
      culinaryDensity: culinaryRaw == null ? 0 : 1,
      shopping: shoppingRaw == null ? 0 : 1,
      safetyTransit: safetyTransitRaw == null ? 0 : 1,
      weather: weatherRaw == null ? 0 : 1,
      crowds: crowdsRaw == null ? 0 : 1,
    };

    const missingWeight =
      (coverage.flight ? 0 : norm.flight) +
      (coverage.hotel ? 0 : norm.hotel) +
      (coverage.diningValue ? 0 : norm.diningValue) +
      (coverage.culinaryDensity ? 0 : norm.culinaryDensity) +
      (coverage.shopping ? 0 : norm.shopping) +
      (coverage.safetyTransit ? 0 : norm.safetyTransit) +
      (coverage.weather ? 0 : norm.weather) +
      (coverage.crowds ? 0 : norm.crowds);

    const hotelInventory = nOr(city.fourStarCount, 0) + nOr(city.fiveStarCount, 0);
    const inventoryBoost = clamp(hotelInventory / 200, 0, 1);

    let confidence = 1 - clamp(missingWeight, 0, 1);
    confidence = clamp(0.85 * confidence + 0.15 * inventoryBoost, 0, 1);

    const penalties: ExplainPenalty[] = [];

    const confidencePenalty = (1 - confidence) * 8;
    if (confidencePenalty > 0.25) {
      penalties.push({
        key: "confidence",
        points: confidencePenalty,
        reason: "Limited data coverage for your weighted priorities",
      });
    }

    // Personalization adjustment.
    // Bounded so it influences ranking without overpowering base fundamentals.
    const cityId = city.id;
    const country = (city.country ?? "").trim();

    const visitedByCity = cityId ? !!opts.visitedByCity?.[cityId] : false;
    const visitedByCountry = country ? !!opts.visitedByCountry?.[country] : false;
    const visited = visitedByCity || visitedByCountry;

    const tripsByCity = cityId ? nOr(opts.tripsByCity?.[cityId], 0) : 0;
    const tripsByCountry = country ? nOr(opts.tripsByCountry?.[country], 0) : 0;
    const trips = clamp(Math.max(tripsByCity, tripsByCountry), 0, 99);

    const feedback = cityId ? opts.feedbackByCity?.[cityId] : undefined;

    let familiarityAdj = 0;
    if (trips >= 4) familiarityAdj = 3;
    else if (trips >= 2) familiarityAdj = 2;
    else if (trips >= 1) familiarityAdj = 1;
    else if (visited) familiarityAdj = 0.5;

    let feedbackAdj = 0;
    if (feedback === "love") feedbackAdj = 6;
    else if (feedback === "maybe") feedbackAdj = 2;
    else if (feedback === "pass") feedbackAdj = -10;

    const personalizationAdj = clamp(familiarityAdj + feedbackAdj, -12, 8);

    const groupDynamicAdj = computeGroupDynamicAdjustment(components, opts.groupDynamic);

    if (groupDynamicAdj < -0.25) {
      penalties.push({
        key: "groupDynamic",
        points: Math.abs(groupDynamicAdj),
        reason: "Group dynamic increases need for comfort, accessibility, or low-friction travel",
      });
    }

    const totalScore = clamp0to100(totalScoreBase - confidencePenalty + personalizationAdj + groupDynamicAdj);

    const topDrivers: TopDriver[] = DRIVER_KEYS.map((k) => {
      const score = clamp0to100(nOr(components[k], 0));
      const weightNorm = clamp(nOr(norm[k], 0), 0, 1);
      const points = score * weightNorm;

      return {
        key: k,
        label: DRIVER_LABELS[k] ?? k,
        points,
        score: Math.round(score),
        weight: weightNorm,
        weightRaw: rawPct[k],
      };
    }).sort((a, b) => b.points - a.points);

    const highlights =
      topDrivers.length > 0
        ? topDrivers.slice(0, 3).map((d) => d.label)
        : safeStrList(city.highlights).slice(0, 3);

    const breakdown = estimateTripCostBreakdownUsd(city, opts);
    const estimatedTripCostUsd = breakdown.totalUsd;

    let budgetDeltaUsd: number | null = null;
    if (budgetUsd != null && estimatedTripCostUsd != null) {
      budgetDeltaUsd = estimatedTripCostUsd - budgetUsd;
    }

    const budgetStatus = classifyBudgetStatus(budgetUsd, estimatedTripCostUsd);

    return {
      city,
      totalScore,
      tier: tierFromScore(totalScore),
      components,
      topDrivers,
      highlights,
      explain: {
        coverage,
        confidence,
        penalties,
        familiarityAdj,
        feedbackAdj,
        personalizationAdj,
        groupDynamicAdj,
      },
      estimatedTripCostUsd,
      costBreakdownUsd: breakdown,
      budgetUsd,
      budgetDeltaUsd,
      budgetStatus,
    };
  });

  scored.sort((a, b) => {
    const ds = b.totalScore - a.totalScore;
    if (Math.abs(ds) > 1e-9) return ds;

    return (a.city.name ?? "").localeCompare(b.city.name ?? "");
  });

  return scored;
}