// lib/scoring.ts
// Safety-hardened scoring + independent weights (each 0–100, NOT sum-capped).
// Internally we normalize by total weight only for computing a 0..100 totalScore.

export type Tier = "S" | "A" | "B" | "C" | "D";

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
  familiarityAdj: number; // +/- points applied
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

  // ✅ new drivers (0..100)
  // weatherIndex: higher = better (already "fit")
  weatherIndex?: number;

  // crowdsIndex: higher = more crowded (we invert for scoring so lower crowds => higher score)
  crowdsIndex?: number;

  highlights?: string[];

  [k: string]: unknown;
};

export type Profile = {
  id: string;
  name: string;
  description?: string;

  // percent sliders 0..100 each (independent, not sum-capped)
  weightsPct?: Partial<Record<DriverKey, number>>;

  // Back-compat: some profiles might still use `weights`
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

  // country-level familiarity
  visitedByCountry?: Record<string, boolean>;
  tripsByCountry?: Record<string, number>;

  // budget (USD) — informational only
  budgetUsd?: number | null;
};

export type ScoredCity = {
  city: City;
  totalScore: number; // 0..100
  tier: Tier;
  components: ScoreComponents; // each 0..100
  topDrivers: TopDriver[];
  highlights: string[];
  explain: Explain;

  // Budget / cost (informational, does NOT affect ranking)
  estimatedTripCostUsd: number | null;
  costBreakdownUsd: TripCostBreakdown;
  budgetUsd: number | null;
  budgetDeltaUsd: number | null; // estimated - budget (positive = over)
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
  return { p10: quantile(s, 0.1), p90: quantile(s, 0.9) };
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

// ✅ Weather + crowds: accept 0..100
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
  norm: Record<DriverKey, number>; // sums to 1 (only for totalScore math)
} {
  const src = (profile?.weightsPct ?? profile?.weights ?? {}) as Partial<Record<DriverKey, number>>;

  // Accept either:
  // - percents (0..100)
  // - fractions (0..1)
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
// Budget / cost model (informational only)
// ------------------------

function estimateTripCostBreakdownUsd(city: City, opts: ScoreOptions): TripCostBreakdown {
  const tripDays = clamp(Math.floor(nOr(opts.tripDays, 7)), 1, 60);
  const fineNights = clamp(Math.floor(nOr(opts.fineDiningNights, 0)), 0, tripDays);
  const hotelStar = opts.hotelStarFocus === 4 ? 4 : 5;

  const flight = computeRawFlightCost(city, opts.departure);

  const nightly = hotelStar === 5 ? nOr(city.avg5StarPriceUsd, NaN) : nOr(city.avg4StarPriceUsd, NaN);
  const hotelCost = Number.isFinite(nightly) ? nightly * tripDays : null;

  const casual = nOr(city.casualMealUsd, NaN);
  const mid = nOr(city.midDinnerUsd, NaN);
  const fine = nOr(city.fineDinnerUsd, NaN);
  const coffee = nOr(city.coffeeUsd, NaN);

  const foodCostRaw =
    (Number.isFinite(casual) ? casual * tripDays : NaN) +
    (Number.isFinite(coffee) ? coffee * tripDays : NaN) +
    (Number.isFinite(mid) ? mid * (tripDays - fineNights) : NaN) +
    (Number.isFinite(fine) ? fine * fineNights : NaN);

  const foodCost = Number.isFinite(foodCostRaw) ? foodCostRaw : null;

  const flightUsd = flight == null ? null : flight;
  const hotelUsd = hotelCost;
  const foodUsd = foodCost;

  const parts = [flightUsd, hotelUsd, foodUsd].filter((x): x is number => Number.isFinite(x as any));
  const totalUsd = parts.length ? Math.max(0, sum(parts)) : null;

  return { totalUsd, flightUsd, hotelUsd, foodUsd };
}

function normalizeBudgetUsd(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return null;
  const clean = Math.max(0, n);
  return clean > 0 ? clean : null;
}

function classifyBudgetStatus(budgetUsd: number | null, estimatedUsd: number | null): BudgetStatus {
  if (budgetUsd == null || estimatedUsd == null) return "unknown";
  const delta = estimatedUsd - budgetUsd; // + over
  if (delta > 0) return "over";

  const abs = Math.abs(delta);
  const withinAbs = 100; // $100
  const withinPct = 0.05 * budgetUsd; // 5%
  const threshold = Math.max(withinAbs, withinPct);

  return abs <= threshold ? "within" : "under";
}

// ------------------------
// public API
// ------------------------

export function scoreCities(cities: City[], profile: Profile, options?: ScoreOptions): ScoredCity[] {
  const opts = options ?? {};
  const safeCities = safeArray<City>(cities).filter((c) => c && typeof c.id === "string");

  const { rawPct, norm } = normalizeWeightsFromProfile(profile);

  // Build raw vectors for normalization
  const rawFlight = safeCities.map((c) => computeRawFlightCost(c, opts.departure)).filter(isFiniteNumber);
  const rawHotel = safeCities.map((c) => computeRawHotelCost(c)).filter(isFiniteNumber);
  const rawDining = safeCities.map((c) => computeRawDiningCost(c)).filter(isFiniteNumber);
  const rawCulinary = safeCities.map((c) => computeRawCulinarySignal(c)).filter(isFiniteNumber);
  const rawShopping = safeCities.map((c) => computeRawShoppingSignal(c)).filter(isFiniteNumber);
  const rawSafetyTransit = safeCities.map((c) => computeRawSafetyTransitSignal(c)).filter(isFiniteNumber);

  // ✅ weather/crowds are already 0..100; we still robust-band them
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
      culinaryDensity: culinaryRaw == null ? 0 : robustNormalize(culinaryRaw, rb.culinaryDensity.p10, rb.culinaryDensity.p90, false),
      shopping: shoppingRaw == null ? 0 : robustNormalize(shoppingRaw, rb.shopping.p10, rb.shopping.p90, false),
      safetyTransit: safetyTransitRaw == null ? 0 : robustNormalize(safetyTransitRaw, rb.safetyTransit.p10, rb.safetyTransit.p90, false),

      // ✅ weather: higher is better
      weather: weatherRaw == null ? 0 : robustNormalize(weatherRaw, rb.weather.p10, rb.weather.p90, false),

      // ✅ crowds: higher means MORE crowded, so invert so LOW crowds scores HIGH
      crowds: crowdsRaw == null ? 0 : robustNormalize(crowdsRaw, rb.crowds.p10, rb.crowds.p90, true),
    };

    // Base total score (0..100)
    const totalScoreBase =
      (components.flight ?? 0) * norm.flight +
      (components.hotel ?? 0) * norm.hotel +
      (components.diningValue ?? 0) * norm.diningValue +
      (components.culinaryDensity ?? 0) * norm.culinaryDensity +
      (components.shopping ?? 0) * norm.shopping +
      (components.safetyTransit ?? 0) * norm.safetyTransit +
      (components.weather ?? 0) * norm.weather +
      (components.crowds ?? 0) * norm.crowds;

    // Coverage + confidence (prevents sparse data from winning Top Picks)
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
    const confidencePenalty = (1 - confidence) * 8; // max ~8 points
    if (confidencePenalty > 0.25) {
      penalties.push({
        key: "confidence",
        points: confidencePenalty,
        reason: "Limited data coverage for your weighted priorities",
      });
    }

    // Familiarity adjustment (country-level, tiny but “real”)
    const country = (city.country ?? "").trim();
    const visited = country ? !!opts.visitedByCountry?.[country] : false;
    const trips = country ? nOr(opts.tripsByCountry?.[country], 0) : 0;

    let familiarityAdj = 0;
    if (country) {
      if (visited) familiarityAdj = clamp(trips / 5, 0, 1) * 1.5; // up to +1.5
      else familiarityAdj = 0.75; // small novelty preference
    }

    const totalScore = clamp0to100(totalScoreBase - confidencePenalty + familiarityAdj);

    // Top drivers: points = score × normalized weight
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
      topDrivers.length > 0 ? topDrivers.slice(0, 3).map((d) => d.label) : safeStrList(city.highlights).slice(0, 3);

    // Budget info (informational only)
    const breakdown = estimateTripCostBreakdownUsd(city, opts);
    const estimatedTripCostUsd = breakdown.totalUsd;

    let budgetDeltaUsd: number | null = null;
    if (budgetUsd != null && estimatedTripCostUsd != null) {
      budgetDeltaUsd = estimatedTripCostUsd - budgetUsd; // + = over
    }

    const budgetStatus = classifyBudgetStatus(budgetUsd, estimatedTripCostUsd);

    return {
      city,
      totalScore,
      tier: tierFromScore(totalScore),
      components,
      topDrivers,
      highlights,
      explain: { coverage, confidence, penalties, familiarityAdj },
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