export type TripStyleId =
  | "city_break"
  | "beach_warm_weather"
  | "food_culture"
  | "luxury_shopping"
  | "nightlife_celebration"
  | "outdoors_nature"
  | "family_friendly"
  | "romantic_slow_pace"
  | "easy_escape";

export type TripStyleMatchStrength = "strong" | "partial" | "low";
export type TripStyleRankingInfluence = "boosted" | "reduced" | "neutral";

export type TripStyleMatch = {
  strength: TripStyleMatchStrength;
  label: string;
  matchedIds: TripStyleId[];
  matchedLabels: string[];
  selectedLabels: string[];
  matchCount: number;
  selectedCount: number;
  adjustment: number;
  influence: TripStyleRankingInfluence;
  missingDecisiveIds: TripStyleId[];
  missingDecisiveLabels: string[];
};

export const TRIP_STYLE_OPTIONS: Array<{
  id: TripStyleId;
  label: string;
  description: string;
}> = [
  {
    id: "city_break",
    label: "City break",
    description: "Restaurants, neighborhoods, museums, hotels, and a compact urban stay.",
  },
  {
    id: "beach_warm_weather",
    label: "Beach / warm weather",
    description: "Sun, water, outdoor dining, resort energy, or a warmer reset.",
  },
  {
    id: "food_culture",
    label: "Food & culture",
    description: "Dining, markets, architecture, history, galleries, and local identity.",
  },
  {
    id: "luxury_shopping",
    label: "Luxury / shopping",
    description: "Polished hotels, retail, design, spa time, and premium neighborhoods.",
  },
  {
    id: "nightlife_celebration",
    label: "Nightlife / celebration",
    description: "Bars, music, late dinners, social energy, and occasion travel.",
  },
  {
    id: "outdoors_nature",
    label: "Outdoors / nature",
    description: "Scenery, trails, mountains, coastlines, parks, and active days.",
  },
  {
    id: "family_friendly",
    label: "Family-friendly",
    description: "Easy logistics, broad appeal, activities, safety, and flexible pacing.",
  },
  {
    id: "romantic_slow_pace",
    label: "Romantic / slower pace",
    description: "Boutique stays, walkable days, atmosphere, views, and softer rhythm.",
  },
  {
    id: "easy_escape",
    label: "Easy / low-friction escape",
    description: "Simple routing, familiar planning, manageable movement, and quick wins.",
  },
];

const TRIP_STYLE_LABEL_BY_ID: Record<TripStyleId, string> = TRIP_STYLE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.label;
    return acc;
  },
  {} as Record<TripStyleId, string>
);

const TRIP_STYLE_IDS = new Set<TripStyleId>(TRIP_STYLE_OPTIONS.map((option) => option.id));
const DECISIVE_TRIP_STYLE_IDS = new Set<TripStyleId>([
  "beach_warm_weather",
  "outdoors_nature",
  "family_friendly",
  "nightlife_celebration",
  "romantic_slow_pace",
]);

export function isTripStyleId(value: unknown): value is TripStyleId {
  return typeof value === "string" && TRIP_STYLE_IDS.has(value as TripStyleId);
}

export function sanitizeTripStyles(value: unknown): TripStyleId[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<TripStyleId>();
  const out: TripStyleId[] = [];

  for (const item of value) {
    if (!isTripStyleId(item)) continue;
    if (seen.has(item)) continue;

    seen.add(item);
    out.push(item);
  }

  return out;
}

export function tripStyleLabel(id: TripStyleId) {
  return TRIP_STYLE_LABEL_BY_ID[id] ?? id;
}

export function tripStyleLabels(ids: TripStyleId[]) {
  return ids.map((id) => tripStyleLabel(id));
}

function calculateTripStyleAdjustment({
  selected,
  matchedIds,
  strength,
}: {
  selected: TripStyleId[];
  matchedIds: TripStyleId[];
  strength: TripStyleMatchStrength;
}) {
  const decisiveSelected = selected.filter((style) => DECISIVE_TRIP_STYLE_IDS.has(style));
  const matched = new Set(matchedIds);
  const matchedDecisive = decisiveSelected.filter((style) => matched.has(style));
  const missingDecisiveIds = decisiveSelected.filter((style) => !matched.has(style));

  let adjustment = 0;

  if (strength === "strong") {
    adjustment = decisiveSelected.length > 0 ? 10 : 8;
  } else if (strength === "partial") {
    if (missingDecisiveIds.length > 0) {
      adjustment = matchedDecisive.length > 0 ? -3 : -7;
    } else {
      adjustment = decisiveSelected.length > 0 ? 4 : 3;
    }
  } else {
    adjustment = decisiveSelected.length > 0 ? -14 : -8;
  }

  return {
    adjustment,
    influence:
      adjustment > 0 ? "boosted" : adjustment < 0 ? "reduced" : "neutral",
    missingDecisiveIds,
    missingDecisiveLabels: tripStyleLabels(missingDecisiveIds),
  } satisfies {
    adjustment: number;
    influence: TripStyleRankingInfluence;
    missingDecisiveIds: TripStyleId[];
    missingDecisiveLabels: string[];
  };
}

export function calculateTripStyleMatch(
  selectedStyles: unknown,
  cityStyles: unknown
): TripStyleMatch | null {
  const selected = sanitizeTripStyles(selectedStyles);
  if (!selected.length) return null;

  const supported = new Set(sanitizeTripStyles(cityStyles));
  const matchedIds = selected.filter((style) => supported.has(style));
  const ratio = matchedIds.length / selected.length;

  const strength: TripStyleMatchStrength =
    matchedIds.length === 0
      ? "low"
      : matchedIds.length === selected.length || (matchedIds.length >= 2 && ratio >= 0.67)
        ? "strong"
        : "partial";
  const adjustment = calculateTripStyleAdjustment({
    selected,
    matchedIds,
    strength,
  });

  return {
    strength,
    label:
      strength === "strong"
        ? "Strong"
        : strength === "partial"
          ? "Partial"
          : "Low",
    matchedIds,
    matchedLabels: tripStyleLabels(matchedIds),
    selectedLabels: tripStyleLabels(selected),
    matchCount: matchedIds.length,
    selectedCount: selected.length,
    ...adjustment,
  };
}

export function joinStyleLabels(labels: string[], fallback = "selected style") {
  const clean = labels.filter(Boolean);
  if (!clean.length) return fallback;
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;

  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}
