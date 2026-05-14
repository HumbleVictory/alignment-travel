// lib/clientSetup.ts
import { sanitizeTripStyles, type TripStyleId } from "@/lib/tripStyles";

export type SetupProfileId = string;
export type SetupTravelScope = "domestic_us" | "international" | "both";
export type SetupTripStyle = TripStyleId;

export type SetupWeights = {
  cost: number;
  comfort: number;
  food: number;
  culture: number;
  nightlife: number;
  safety: number;
  shopping: number;
  weather: number;
  crowds: number;
};

export type GroupDynamicTravelStyle =
  | "solo"
  | "partner"
  | "friends"
  | "family"
  | "family_with_kids"
  | "multigenerational"
  | "other";

export type SetupGroupDynamic = {
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

export type SetupState = {
  profileId: SetupProfileId;
  month: string;
  budgetUsd: number;
  travelScope: SetupTravelScope;
  tripStyles: SetupTripStyle[];

  // Primary trip length field.
  days: number;

  // Back-compat alias because parts of the app already read/write tripDays.
  tripDays: number;

  groupDynamic: SetupGroupDynamic;

  weights: SetupWeights;
};

const LS_KEY = "alignmentTravel:setup:v4";

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function nOr(n: unknown, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export const DEFAULT_GROUP_DYNAMIC: SetupGroupDynamic = {
  travelStyle: "solo",
  adults: 1,
  kids: 0,
  babies: 0,
  elders: 0,
  mobilityNeeds: false,
  disabilityNeeds: false,
  strollerNeeds: false,
  comfortSensitive: false,
};

export const DEFAULT_SETUP: SetupState = {
  profileId: "balanced",
  month: "January",
  budgetUsd: 2500,
  travelScope: "both",
  tripStyles: [],
  days: 5,
  tripDays: 5,
  groupDynamic: DEFAULT_GROUP_DYNAMIC,
  weights: {
    cost: 50,
    comfort: 50,
    food: 50,
    culture: 50,
    nightlife: 50,
    safety: 50,
    shopping: 50,
    weather: 50,
    crowds: 50,
  },
};

function sanitizeWeights(raw: any): SetupWeights {
  return {
    cost: clamp(nOr(raw?.cost, DEFAULT_SETUP.weights.cost), 0, 100),
    comfort: clamp(nOr(raw?.comfort, DEFAULT_SETUP.weights.comfort), 0, 100),
    food: clamp(nOr(raw?.food, DEFAULT_SETUP.weights.food), 0, 100),
    culture: clamp(nOr(raw?.culture, DEFAULT_SETUP.weights.culture), 0, 100),
    nightlife: clamp(nOr(raw?.nightlife, DEFAULT_SETUP.weights.nightlife), 0, 100),
    safety: clamp(nOr(raw?.safety, DEFAULT_SETUP.weights.safety), 0, 100),
    shopping: clamp(nOr(raw?.shopping, DEFAULT_SETUP.weights.shopping), 0, 100),
    weather: clamp(nOr(raw?.weather, DEFAULT_SETUP.weights.weather), 0, 100),
    crowds: clamp(nOr(raw?.crowds, DEFAULT_SETUP.weights.crowds), 0, 100),
  };
}

function sanitizeTravelStyle(raw: unknown): GroupDynamicTravelStyle {
  if (
    raw === "partner" ||
    raw === "friends" ||
    raw === "family" ||
    raw === "family_with_kids" ||
    raw === "multigenerational" ||
    raw === "other"
  ) {
    return raw;
  }

  return "solo";
}

function sanitizeTravelScope(raw: unknown): SetupTravelScope {
  if (raw === "domestic_us" || raw === "international" || raw === "both") return raw;
  return DEFAULT_SETUP.travelScope;
}

function sanitizeGroupDynamic(raw: any): SetupGroupDynamic {
  const travelStyle = sanitizeTravelStyle(raw?.travelStyle);
  const solo = travelStyle === "solo";

  return {
    travelStyle,
    adults: solo ? 1 : clamp(Math.floor(nOr(raw?.adults, 2)), 1, 30),
    kids: solo ? 0 : clamp(Math.floor(nOr(raw?.kids, 0)), 0, 30),
    babies: solo ? 0 : clamp(Math.floor(nOr(raw?.babies, 0)), 0, 10),
    elders: solo ? 0 : clamp(Math.floor(nOr(raw?.elders, 0)), 0, 20),
    mobilityNeeds: !!raw?.mobilityNeeds,
    disabilityNeeds: !!raw?.disabilityNeeds,
    strollerNeeds: !!raw?.strollerNeeds,
    comfortSensitive: !!raw?.comfortSensitive,
  };
}

function sanitizeSetup(raw: any): SetupState {
  const profileId = typeof raw?.profileId === "string" ? raw.profileId : DEFAULT_SETUP.profileId;
  const month = typeof raw?.month === "string" ? raw.month : DEFAULT_SETUP.month;
  const budgetUsd = clamp(nOr(raw?.budgetUsd, DEFAULT_SETUP.budgetUsd), 0, 1_000_000);
  const travelScope = sanitizeTravelScope(raw?.travelScope);
  const tripStyles = sanitizeTripStyles(raw?.tripStyles);

  // Tolerate older saved states that may have either days or tripDays.
  const days = clamp(nOr(raw?.days, nOr(raw?.tripDays, DEFAULT_SETUP.days)), 1, 60);

  return {
    profileId,
    month,
    budgetUsd,
    travelScope,
    tripStyles,
    days,
    tripDays: days,
    groupDynamic: sanitizeGroupDynamic(raw?.groupDynamic),
    weights: sanitizeWeights(raw?.weights),
  };
}

export function loadSetup(): SetupState {
  if (typeof window === "undefined") return DEFAULT_SETUP;

  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SETUP;
    return sanitizeSetup(JSON.parse(raw));
  } catch {
    return DEFAULT_SETUP;
  }
}

export function saveSetup(next: SetupState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(sanitizeSetup(next)));
  } catch {
    // ignore
  }
}

export function patchSetup(patch: Partial<SetupState>) {
  const curr = loadSetup();

  saveSetup({
    ...curr,
    ...patch,
    weights: patch.weights ?? curr.weights,
    groupDynamic: patch.groupDynamic ?? curr.groupDynamic,
  });
}

export function resetSetup() {
  saveSetup(DEFAULT_SETUP);
}
