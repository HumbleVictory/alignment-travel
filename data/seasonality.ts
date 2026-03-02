// data/seasonality.ts
// Month-by-month (0..100) seasonality curves per city.
// weatherComfortByMonth: higher = nicer to be there
// tourismPressureByMonth: higher = more crowded/price pressure/friction

export type Seasonality = {
  cityId: string;
  weatherComfortByMonth: number[]; // length 12
  tourismPressureByMonth: number[]; // length 12
};

function ensure12(xs: number[], fallback = 50): number[] {
  const out = Array.from({ length: 12 }, (_, i) => {
    const v = xs?.[i];
    return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback;
  });
  return out;
}

// ✅ Placeholder curves (replace later with real data pipeline outputs).
// These are intentionally NOT “global peak months”; they’re per-city arrays.
export const SEASONALITY: Record<string, Seasonality> = {
  tokyo: {
    cityId: "tokyo",
    weatherComfortByMonth: ensure12([45, 55, 70, 78, 80, 65, 55, 50, 70, 78, 65, 50]),
    tourismPressureByMonth: ensure12([55, 55, 70, 75, 70, 60, 55, 55, 65, 70, 60, 55]),
  },
  seoul: {
    cityId: "seoul",
    weatherComfortByMonth: ensure12([35, 45, 65, 75, 80, 65, 50, 45, 70, 78, 60, 40]),
    tourismPressureByMonth: ensure12([45, 45, 60, 65, 60, 55, 50, 50, 60, 65, 55, 45]),
  },
  bangkok: {
    cityId: "bangkok",
    weatherComfortByMonth: ensure12([75, 78, 65, 55, 45, 40, 45, 50, 55, 60, 70, 75]),
    tourismPressureByMonth: ensure12([70, 70, 60, 45, 35, 30, 35, 40, 50, 55, 65, 70]),
  },
  singapore: {
    cityId: "singapore",
    weatherComfortByMonth: ensure12([60, 60, 60, 55, 55, 55, 60, 60, 60, 60, 60, 60]),
    tourismPressureByMonth: ensure12([60, 60, 55, 50, 50, 50, 55, 55, 55, 60, 60, 60]),
  },
  paris: {
    cityId: "paris",
    weatherComfortByMonth: ensure12([35, 40, 55, 70, 78, 80, 78, 76, 68, 55, 40, 35]),
    tourismPressureByMonth: ensure12([45, 45, 55, 70, 80, 85, 85, 80, 70, 55, 45, 45]),
  },
  milan: {
    cityId: "milan",
    weatherComfortByMonth: ensure12([35, 40, 55, 70, 78, 75, 70, 68, 70, 60, 45, 35]),
    tourismPressureByMonth: ensure12([40, 40, 50, 65, 75, 80, 75, 70, 65, 55, 45, 40]),
  },
  lisbon: {
    cityId: "lisbon",
    weatherComfortByMonth: ensure12([45, 50, 60, 70, 78, 82, 85, 85, 78, 70, 55, 45]),
    tourismPressureByMonth: ensure12([35, 35, 40, 55, 70, 80, 85, 85, 70, 55, 40, 35]),
  },
  barcelona: {
    cityId: "barcelona",
    weatherComfortByMonth: ensure12([45, 50, 60, 70, 78, 82, 85, 85, 80, 70, 55, 45]),
    tourismPressureByMonth: ensure12([45, 45, 50, 65, 80, 85, 90, 90, 80, 65, 50, 45]),
  },
  london: {
    cityId: "london",
    weatherComfortByMonth: ensure12([30, 35, 45, 55, 65, 70, 72, 70, 60, 50, 40, 30]),
    tourismPressureByMonth: ensure12([45, 45, 50, 60, 70, 75, 75, 72, 65, 55, 50, 45]),
  },
  istanbul: {
    cityId: "istanbul",
    weatherComfortByMonth: ensure12([35, 40, 55, 70, 78, 82, 82, 80, 72, 60, 45, 35]),
    tourismPressureByMonth: ensure12([35, 35, 40, 55, 70, 80, 80, 75, 65, 50, 40, 35]),
  },
  philadelphia: {
    cityId: "philadelphia",
    weatherComfortByMonth: ensure12([30, 35, 50, 65, 75, 80, 82, 80, 72, 60, 45, 35]),
    tourismPressureByMonth: ensure12([45, 45, 50, 60, 70, 75, 75, 72, 65, 55, 50, 45]),
  },
};


