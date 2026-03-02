// components/CompareDrawer.tsx
"use client";

import * as React from "react";
import type { ScoredCity } from "@/lib/scoring";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { overlayVariants, drawerRightVariants, drawerBottomVariants } from "@/lib/motion";

type DriverKey =
  | "flight"
  | "hotel"
  | "diningValue"
  | "culinaryDensity"
  | "shopping"
  | "safetyTransit"
  | "weather"
  | "crowds";

const DRIVER_ORDER: DriverKey[] = [
  "flight",
  "hotel",
  "diningValue",
  "culinaryDensity",
  "shopping",
  "safetyTransit",
  "weather",
  "crowds",
];

const DRIVER_LABEL: Record<DriverKey, string> = {
  flight: "Flights",
  hotel: "Hotels",
  diningValue: "Dining value",
  culinaryDensity: "Culinary density",
  shopping: "Shopping",
  safetyTransit: "Safety & transit",
  weather: "Weather fit",
  crowds: "Low crowds",
};

type RawWeights = Record<DriverKey, number>;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function nOr(n: unknown, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
function normalizeWeightsPct(raw: RawWeights): RawWeights {
  const safe: RawWeights = {
    flight: Math.max(0, nOr(raw.flight, 0)),
    hotel: Math.max(0, nOr(raw.hotel, 0)),
    diningValue: Math.max(0, nOr(raw.diningValue, 0)),
    culinaryDensity: Math.max(0, nOr(raw.culinaryDensity, 0)),
    shopping: Math.max(0, nOr(raw.shopping, 0)),
    safetyTransit: Math.max(0, nOr(raw.safetyTransit, 0)),
    weather: Math.max(0, nOr(raw.weather, 0)),
    crowds: Math.max(0, nOr(raw.crowds, 0)),
  };

  const sum =
    safe.flight +
    safe.hotel +
    safe.diningValue +
    safe.culinaryDensity +
    safe.shopping +
    safe.safetyTransit +
    safe.weather +
    safe.crowds;

  if (sum <= 0) {
    const eq = 100 / DRIVER_ORDER.length;
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
    flight: (safe.flight / sum) * 100,
    hotel: (safe.hotel / sum) * 100,
    diningValue: (safe.diningValue / sum) * 100,
    culinaryDensity: (safe.culinaryDensity / sum) * 100,
    shopping: (safe.shopping / sum) * 100,
    safetyTransit: (safe.safetyTransit / sum) * 100,
    weather: (safe.weather / sum) * 100,
    crowds: (safe.crowds / sum) * 100,
  };
}
function contributionPoints(weightPct: number, score: number) {
  return (weightPct / 100) * score;
}
function fmt1(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}
function getId(it: any): string {
  return (it?.city?.id ?? it?.id ?? "") as string;
}
function getName(it: any): string {
  return (it?.city?.name ?? it?.name ?? "") as string;
}
function getComponents(it: any): Record<DriverKey, number> {
  const c = (it?.components ?? {}) as Partial<Record<DriverKey, number>>;
  return {
    flight: clamp(nOr(c.flight, 0), 0, 100),
    hotel: clamp(nOr(c.hotel, 0), 0, 100),
    diningValue: clamp(nOr(c.diningValue, 0), 0, 100),
    culinaryDensity: clamp(nOr(c.culinaryDensity, 0), 0, 100),
    shopping: clamp(nOr(c.shopping, 0), 0, 100),
    safetyTransit: clamp(nOr(c.safetyTransit, 0), 0, 100),
    weather: clamp(nOr(c.weather, 0), 0, 100),
    crowds: clamp(nOr(c.crowds, 0), 0, 100),
  };
}
function getWeightsPct(it: any): RawWeights {
  const w = (it?.weightsPct ?? {}) as Partial<Record<DriverKey, number>>;
  const base: RawWeights = {
    flight: clamp(nOr(w.flight, 0), 0, 100),
    hotel: clamp(nOr(w.hotel, 0), 0, 100),
    diningValue: clamp(nOr(w.diningValue, 0), 0, 100),
    culinaryDensity: clamp(nOr(w.culinaryDensity, 0), 0, 100),
    shopping: clamp(nOr(w.shopping, 0), 0, 100),
    safetyTransit: clamp(nOr(w.safetyTransit, 0), 0, 100),
    weather: clamp(nOr(w.weather, 0), 0, 100),
    crowds: clamp(nOr(w.crowds, 0), 0, 100),
  };
  return normalizeWeightsPct(base);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isMobile;
}

function usd(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? `$${Math.round(n)}` : "—";
}
function pct(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? `${Math.round(n)}%` : "—";
}
function int(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? `${Math.round(n)}` : "—";
}

function driverBasisLine(it: any, k: DriverKey): string {
  const c = it?.city ?? {};
  switch (k) {
    case "flight": {
      const nyc = c?.flightFrom?.nyc;
      const phl = c?.flightFrom?.phl;
      const parts: string[] = [];
      if (Number.isFinite(nyc)) parts.push(`NYC ${usd(nyc)}`);
      if (Number.isFinite(phl)) parts.push(`PHL ${usd(phl)}`);
      return parts.length
        ? `Based on: roundtrip flight estimate · ${parts.join(" · ")}`
        : "Based on: roundtrip flight estimate";
    }
    case "hotel":
      return `Based on: avg nightly price · 4★ ${usd(c?.avg4StarPriceUsd)} · 5★ ${usd(c?.avg5StarPriceUsd)}`;
    case "diningValue":
      return `Based on: meal prices · casual ${usd(c?.casualMealUsd)} · mid ${usd(c?.midDinnerUsd)} · fine ${usd(c?.fineDinnerUsd)}`;
    case "culinaryDensity":
      return `Based on: Michelin ${int(c?.michelinStars)} · Bib ${int(c?.bibGourmand)} · café ${int(c?.cafeCultureIndex)}/100`;
    case "shopping":
      return `Based on: luxury ${int(c?.luxuryIndexVsUS)}/100 · VAT ${pct(c?.vatRefundPct)}`;
    case "safetyTransit":
      return `Based on: safety ${int(c?.safetyIndex)}/100 · transit ${int(c?.transitIndex)}/100`;
    case "weather":
      return `Based on: weather index ${int(c?.weatherIndex)}/100 (prototype signal)`;
    case "crowds":
      return `Based on: crowds index ${int(c?.crowdsIndex)}/100 (lower crowds score higher)`;
    default:
      return "Based on: dataset signals";
  }
}

type TabKey = "contrib" | "whatif";

export function CompareDrawer({
  pinned,
  isOpen,
  onClose,
  onClear,
  onSwap,
  onSelect,
}: {
  pinned: ScoredCity[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  onSwap: () => void;
  onSelect: (c: ScoredCity) => void;
}) {
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();

  const [localWeights, setLocalWeights] = React.useState<Record<string, RawWeights>>({});
  const [tabsById, setTabsById] = React.useState<Record<string, TabKey>>({});

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const count = pinned.length;
  const panelVariants = isMobile ? drawerBottomVariants : drawerRightVariants;

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-[2px]"
            aria-hidden="true"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={overlayVariants}
            onClick={onClose}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Compare drawer"
            className={cn(
              "fixed z-[90] flex flex-col will-change-transform",
              "border border-white/10 bg-white/[0.04] backdrop-blur shadow-[0_30px_90px_rgba(0,0,0,0.55)]",
              isMobile ? "left-0 right-0 bottom-0 rounded-t-3xl" : "top-0 right-0 h-dvh w-[min(980px,92vw)] rounded-l-3xl"
            )}
            initial={reducedMotion ? false : "initial"}
            animate={reducedMotion ? undefined : "animate"}
            exit={reducedMotion ? undefined : "exit"}
            variants={panelVariants}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight text-white/90">Compare</h2>
                    <span className="ui-chip text-[11px] font-semibold text-white/70">{count}/2 pinned</span>
                  </div>
                  <p className="mt-1 text-xs text-white/60">
                    “What-if” changes priority weights locally (ranking stays unchanged).
                  </p>
                  <LinkInline href="/methodology" label="View methodology" />
                </div>

                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <button type="button" onClick={onClear} className="ui-btn rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/85">
                      Clear
                    </button>
                  )}
                  {count === 2 && (
                    <button
                      type="button"
                      onClick={onSwap}
                      className="ui-btn rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/85"
                      title="Swap left/right"
                    >
                      Swap
                    </button>
                  )}
                  <button type="button" onClick={onClose} className="ui-btn rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/85">
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {count === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  Pin up to <span className="font-semibold text-white/85">2</span> cities to compare drivers and do local what-ifs.
                </div>
              ) : (
                <div className={count === 2 && !isMobile ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
                  {pinned.map((it) => {
                    const id = getId(it);
                    const name = getName(it);
                    const components = getComponents(it);

                    const baseWeights = getWeightsPct(it);
                    const local = localWeights[id];
                    const activeWeights = normalizeWeightsPct(local ?? baseWeights);

                    const totalContrib = DRIVER_ORDER.reduce(
                      (acc, k) => acc + contributionPoints(activeWeights[k], components[k]),
                      0
                    );

                    const modelTotal = nOr((it as any).totalScore, nOr((it as any).score, 0));
                    const tab: TabKey = tabsById[id] ?? "contrib";

                    const status = (it as any).budgetStatus ?? "unknown";
                    const est = (it as any).estimatedTripCostUsd ?? null;
                    const budget = (it as any).budgetUsd ?? null;

                    return (
                      <div key={id} className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold tracking-tight text-white/90">{name}</div>

                              {status !== "unknown" && budget != null && est != null && (
                                <span
                                  className={cn(
                                    "ui-chip text-[11px] font-semibold",
                                    status === "over" ? "text-rose-200" : status === "within" ? "text-white/70" : "text-emerald-200"
                                  )}
                                  title="Informational only (does not affect ranking)."
                                >
                                  {status === "over" ? "Overbudget" : status === "within" ? "Within budget" : "Underbudget"}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-xs text-white/60">
                              Model total: <span className="font-semibold text-white/85">{fmt1(modelTotal)}</span>
                              <span className="text-white/25"> · </span>
                              Σ contributions: <span className="font-semibold text-white/85">{fmt1(totalContrib)}</span>
                            </div>
                          </div>

                          <button type="button" onClick={() => onSelect(it)} className="ui-btn rounded-xl px-2.5 py-1 text-xs font-semibold text-white/85">
                            Open
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2">
                          <div className="flex gap-2">
                            <TabButton active={tab === "contrib"} onClick={() => setTabsById((p) => ({ ...p, [id]: "contrib" }))}>
                              Contributions
                            </TabButton>
                            <TabButton active={tab === "whatif"} onClick={() => setTabsById((p) => ({ ...p, [id]: "whatif" }))}>
                              What-if
                            </TabButton>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setLocalWeights((prev) => {
                                const next = { ...prev };
                                delete next[id];
                                return next;
                              })
                            }
                            className="text-[11px] font-semibold text-white/55 hover:text-white/85"
                            title="Reset local what-if sliders"
                          >
                            Reset
                          </button>
                        </div>

                        {tab === "contrib" ? (
                          <div className="mt-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold text-white/85">Contribution breakdown</div>
                              <div className="text-[11px] text-white/45">(weight% × score → points)</div>
                            </div>

                            <div className="mt-2 space-y-2">
                              {DRIVER_ORDER.map((k) => {
                                const w = activeWeights[k];
                                const s = components[k];
                                const pts = contributionPoints(w, s);

                                return (
                                  <div key={k} className="rounded-2xl border border-white/10 bg-black/20 p-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-xs font-medium text-white/85">{DRIVER_LABEL[k]}</div>
                                      <div className="text-xs text-white/60">
                                        <span className="font-semibold text-white/85">{Math.round(w)}%</span> × {Math.round(s)} →{" "}
                                        <span className="font-semibold text-emerald-200">{fmt1(pts)}</span>
                                      </div>
                                    </div>

                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                      <div className="h-1.5 bg-white/40" style={{ width: `${clamp(s, 0, 100)}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="text-[11px] text-white/60">Adjust local weights (0–100). We normalize internally.</div>
                            </div>

                            <div className="mt-3 space-y-3">
                              {DRIVER_ORDER.map((k) => {
                                const raw = local?.[k] ?? baseWeights[k];
                                const v = clamp(Math.round(raw), 0, 100);

                                return (
                                  <div key={k} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="flex items-center justify-between text-xs text-white/70">
                                      <span className="font-medium">{DRIVER_LABEL[k]}</span>
                                      <span className="font-semibold text-white/85">{v}</span>
                                    </div>

                                    <input
                                      type="range"
                                      min={0}
                                      max={100}
                                      value={v}
                                      onChange={(e) => {
                                        const next = clamp(parseInt(e.target.value, 10), 0, 100);
                                        setLocalWeights((prev) => ({
                                          ...prev,
                                          [id]: {
                                            ...(prev[id] ?? baseWeights),
                                            [k]: next,
                                          },
                                        }));
                                      }}
                                      className="mt-2 w-full accent-emerald-400"
                                    />

                                    <div className="mt-2 text-[11px] leading-snug text-white/60">
                                      <div>
                                        Priority: <span className="font-semibold text-white/80">0–100</span> (higher = matters more)
                                      </div>
                                      <div className="mt-0.5">{driverBasisLine(it, k)}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="text-[11px] text-white/40">This is an “instrument panel”: same math, more clarity.</div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold border transition",
        active
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
          : "border-white/15 bg-white/[0.04] text-white/80 hover:border-white/25 hover:bg-white/[0.06]"
      )}
    >
      {children}
    </button>
  );
}

function LinkInline({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="mt-2 inline-block text-xs font-semibold text-emerald-200/90 hover:text-emerald-200">
      {label}
    </a>
  );
}