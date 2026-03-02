// data/profiles.ts
import type { DriverKey, Profile } from "@/lib/scoring";

export type ProfileId = "balanced" | "comfort" | "foodie" | "value" | "custom";

function w(pairs: Partial<Record<DriverKey, number>>): Partial<Record<DriverKey, number>> {
  return pairs;
}

export const PROFILES: Profile[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "A well-rounded baseline across cost, experience, and practicality.",
    weightsPct: w({
      flight: 12,
      hotel: 14,
      diningValue: 14,
      culinaryDensity: 12,
      shopping: 10,
      safetyTransit: 14,
      weather: 12,
      crowds: 12,
    }),
  },
  {
    id: "comfort",
    name: "Comfort + Ease",
    description: "Prioritizes safety, transit, hotels, and smoother weather.",
    weightsPct: w({
      flight: 8,
      hotel: 18,
      diningValue: 10,
      culinaryDensity: 8,
      shopping: 6,
      safetyTransit: 22,
      weather: 16,
      crowds: 12,
    }),
  },
  {
    id: "foodie",
    name: "Food & Culture",
    description: "Optimizes for food quality + density, with decent weather and manageable crowds.",
    weightsPct: w({
      flight: 8,
      hotel: 10,
      diningValue: 18,
      culinaryDensity: 20,
      shopping: 6,
      safetyTransit: 12,
      weather: 14,
      crowds: 12,
    }),
  },
  {
    id: "value",
    name: "High Value",
    description: "Optimizes for cost efficiency + shopping value, still cares about crowds/weather.",
    weightsPct: w({
      flight: 16,
      hotel: 16,
      diningValue: 14,
      culinaryDensity: 8,
      shopping: 18,
      safetyTransit: 10,
      weather: 10,
      crowds: 8,
    }),
  },
  {
    id: "custom",
    name: "Custom",
    description: "Custom priorities mapped into decision drivers.",
    weightsPct: w({
      flight: 12,
      hotel: 12,
      diningValue: 12,
      culinaryDensity: 12,
      shopping: 12,
      safetyTransit: 12,
      weather: 14,
      crowds: 14,
    }),
  },
];