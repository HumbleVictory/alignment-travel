// lib/clientSetup.ts
export type SetupProfileId = string;

export type SetupWeights = {
  cost: number;
  comfort: number;
  food: number;
  nightlife: number;
  safety: number;
  shopping: number;

  // ✅ NEW
  weather: number;
  crowds: number;
};

export type SetupState = {
  profileId: SetupProfileId;
  month: string;
  budgetUsd: number;
  weights: SetupWeights;
};

const LS_KEY = "alignmentTravel:setup:v3";

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function nOr(n: unknown, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export const DEFAULT_SETUP: SetupState = {
  profileId: "balanced",
  month: "January",
  budgetUsd: 2500,
  weights: {
    cost: 50,
    comfort: 50,
    food: 50,
    nightlife: 50,
    safety: 50,
    shopping: 50,

    // ✅ NEW defaults
    weather: 50,
    crowds: 50,
  },
};

function sanitizeWeights(raw: any): SetupWeights {
  return {
    cost: clamp(nOr(raw?.cost, DEFAULT_SETUP.weights.cost), 0, 100),
    comfort: clamp(nOr(raw?.comfort, DEFAULT_SETUP.weights.comfort), 0, 100),
    food: clamp(nOr(raw?.food, DEFAULT_SETUP.weights.food), 0, 100),
    nightlife: clamp(nOr(raw?.nightlife, DEFAULT_SETUP.weights.nightlife), 0, 100),
    safety: clamp(nOr(raw?.safety, DEFAULT_SETUP.weights.safety), 0, 100),
    shopping: clamp(nOr(raw?.shopping, DEFAULT_SETUP.weights.shopping), 0, 100),

    // ✅ NEW
    weather: clamp(nOr(raw?.weather, DEFAULT_SETUP.weights.weather), 0, 100),
    crowds: clamp(nOr(raw?.crowds, DEFAULT_SETUP.weights.crowds), 0, 100),
  };
}

function sanitizeSetup(raw: any): SetupState {
  const profileId = typeof raw?.profileId === "string" ? raw.profileId : DEFAULT_SETUP.profileId;
  const month = typeof raw?.month === "string" ? raw.month : DEFAULT_SETUP.month;
  const budgetUsd = clamp(nOr(raw?.budgetUsd, DEFAULT_SETUP.budgetUsd), 0, 1_000_000);

  return {
    profileId,
    month,
    budgetUsd,
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

export function resetSetup() {
  saveSetup(DEFAULT_SETUP);
}