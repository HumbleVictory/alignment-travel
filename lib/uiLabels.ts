// lib/uiLabels.ts
export type DriverKey =
  | "flight"
  | "hotel"
  | "diningValue"
  | "culinaryDensity"
  | "shopping"
  | "safetyTransit";

export const DRIVER_LABEL_UI: Record<DriverKey, string> = {
  flight: "Flight affordability",
  hotel: "Hotel affordability",
  diningValue: "Dining affordability",
  culinaryDensity: "Culinary density",
  shopping: "Shopping savings",
  safetyTransit: "Safety & transit",
};

export const DRIVER_LABEL_SHORT: Record<DriverKey, string> = {
  flight: "Flights",
  hotel: "Hotels",
  diningValue: "Dining",
  culinaryDensity: "Culinary",
  shopping: "Shopping",
  safetyTransit: "Safety + transit",
};
