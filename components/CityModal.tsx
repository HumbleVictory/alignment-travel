// components/CityModal.tsx
"use client";

import { useMemo } from "react";
import type { ScoredCity, TopDriver, DriverKey } from "@/lib/scoring";

export type CityFeedback = "love" | "maybe" | "pass";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function driverMeta(key: DriverKey) {
  // Central place to control labels + little descriptions
  const map: Record<
    DriverKey,
    { label: string; hint?: string; tone?: "neutral" | "emerald" | "blue" | "rose" }
  > = {
    flight: { label: "Flight value", hint: "Lower flight cost → higher score" },
    hotel: { label: "Hotel yield", hint: "Lower nightly cost → higher score" },
    diningValue: { label: "Dining value", hint: "Lower food costs → higher score" },
    culinaryDensity: { label: "Culinary density", hint: "More culinary signal → higher score" },
    shopping: { label: "Shopping arbitrage", hint: "Better shopping value → higher score" },
    safetyTransit: { label: "Safety + transit", hint: "Higher safety/transit → higher score" },

    // ✅ new drivers
    weather: { label: "Weather fit", hint: "Higher weather index → higher score" },
    crowds: { label: "Low crowds", hint: "Inverted: lower crowds index → higher score" },
  };

  return map[key] ?? { label: key };
}

function MiniBar({
  value,
  tone = "neutral",
}: {
  value: number; // 0..100
  tone?: "neutral" | "emerald" | "blue" | "rose";
}) {
  const pct = clamp(value, 0, 100);

  const track = "h-2 w-full rounded-full bg-white/10";
  const fillBase = "h-2 rounded-full";
  const fillTone =
    tone === "emerald"
      ? "bg-emerald-400/80"
      : tone === "blue"
      ? "bg-sky-400/80"
      : tone === "rose"
      ? "bg-rose-400/80"
      : "bg-white/70";

  return (
    <div className={track}>
      <div className={cx(fillBase, fillTone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DriverRow({ d, city }: { d: TopDriver; city: ScoredCity["city"] }) {
  const meta = driverMeta(d.key);

  // Optional: show raw city indices for weather/crowds to build trust
  const rawHint =
    d.key === "weather" && typeof (city as any).weatherIndex === "number"
      ? `City weather index: ${(city as any).weatherIndex}`
      : d.key === "crowds" && typeof (city as any).crowdsIndex === "number"
      ? `City crowds index: ${(city as any).crowdsIndex} (higher = more crowded)`
      : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white/90">{meta.label}</div>
          <div className="mt-0.5 text-xs text-white/55">
            {meta.hint}
            {rawHint ? <span className="block mt-1 text-white/40">{rawHint}</span> : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-white">{d.score}</div>
          <div className="text-[11px] text-white/45">weight {Math.round(d.weight * 100)}%</div>
        </div>
      </div>

      <div className="mt-2">
        <MiniBar value={d.score} tone={d.key === "crowds" ? "blue" : d.key === "weather" ? "emerald" : "neutral"} />
      </div>
    </div>
  );
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
  isPinned = false,
  onTogglePin,
}: {
  selected: ScoredCity;
  onClose: () => void;

  country?: string;
  visited?: boolean;
  trips?: number;
  onSetVisited?: (v: boolean) => void;
  onSetTrips?: (n: number) => void;

  feedback?: CityFeedback;
  onSetFeedback?: (v: CityFeedback) => void;

  shiftLeftPx?: number;
  isCompareOpen?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}) {
  const city = selected.city;

  const topDrivers = useMemo(() => {
    // show top 5 by contribution
    const list = (selected.topDrivers ?? []).slice(0, 5);
    return list;
  }, [selected.topDrivers]);

  return (
  <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-white/10 bg-[#070b12] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_24px_80px_rgba(0,0,0,0.55)]"
        style={{ transform: `translateX(-${shiftLeftPx}px)` }}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
            <div className="min-w-0">
              <div className="text-xs font-medium tracking-wide text-white/50">DESTINATION</div>
              <div className="mt-1 text-xl font-semibold text-white truncate">
                {city.name} <span className="text-white/50">·</span>{" "}
                <span className="text-white/70">{city.country}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-white/75">
                  Tier {selected.tier}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-white/75">
                  Alignment {Math.round(selected.totalScore)}
                </span>

                {typeof (selected as any).budgetStatus === "string" ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-white/75">
                    Budget {(selected as any).budgetStatus}
                  </span>
                ) : null}
              </div>

              {isCompareOpen ? (
                <div className="mt-2 text-xs text-white/40">
                  Tip: pin up to 2 cities to compare.
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {onTogglePin ? (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className={cx(
                    "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    isPinned
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:border-emerald-400/40"
                      : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white/90"
                  )}
                >
                  {isPinned ? "Pinned" : "Pin"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:text-white/90"
              >
                Close
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-5">
            {/* Top drivers */}
            <section>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/90">Top drivers</div>
                  <div className="mt-1 text-xs text-white/45">
                    These are the biggest contributors to this city’s Alignment Score.
                  </div>
                </div>
              </div>

              {/* ✅ Crowds inversion note */}
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
                <span className="font-semibold text-white/75">Note:</span> “Low crowds” is scored by{" "}
                <span className="font-semibold text-white/70">inverting</span> the city’s crowds index —{" "}
                lower crowds index means a higher “Low crowds” score.
              </div>

              <div className="mt-3 grid gap-3">
                {topDrivers.map((d) => (
                  <DriverRow key={d.key} d={d} city={city} />
                ))}
              </div>
            </section>

            {/* Personalization (optional) */}
            <section className="mt-8">
              <div className="text-sm font-semibold text-white/90">Personalization</div>
              <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={!!visited}
                      onChange={(e) => onSetVisited?.(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-black/30"
                    />
                    Been to {country ?? "this country"} before
                  </label>

                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <span>Trips:</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={typeof trips === "number" ? trips : 0}
                      onChange={(e) => onSetTrips?.(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                      className="w-20 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25"
                    />
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {(["love", "maybe", "pass"] as CityFeedback[]).map((v) => {
                    const active = feedback === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onSetFeedback?.(v)}
                        className={cx(
                          "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                          active
                            ? "border-white/25 bg-white/[0.06] text-white"
                            : "border-white/10 bg-black/20 text-white/60 hover:border-white/20 hover:text-white/85"
                        )}
                      >
                        {v === "love" ? "Love" : v === "maybe" ? "Maybe" : "Pass"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Raw details (optional quick debug) */}
    <section className="mt-8">
  <div className="text-sm font-semibold text-white/90">Details</div>
  <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/55">
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-white/45">Weather index</div>
        <div className="mt-1 text-white/80">
          {typeof (city as any).weatherIndex === "number" ? (city as any).weatherIndex : "—"}
        </div>
        <div className="mt-1 text-white/40">
          Higher = more favorable overall climate conditions.
        </div>
      </div>

      <div>
        <div className="text-white/45">Crowds index</div>
        <div className="mt-1 text-white/80">
          {typeof (city as any).crowdsIndex === "number" ? (city as any).crowdsIndex : "—"}
        </div>
        <div className="mt-1 text-white/40">
          Higher = more crowded (lower is quieter).
        </div>
      </div>
    </div>
  </div>
</section>
          </div>

          <footer className="border-t border-white/10 p-5 text-xs text-white/40">
            Alignment Travel · modal
          </footer>
        </div>
      </div>
    </div>
  );
}