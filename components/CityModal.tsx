// components/CityModal.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { ScoredCity } from "@/lib/scoring";

export type CityFeedback = "love" | "maybe" | "pass";

type DriverKey =
  | "flight"
  | "hotel"
  | "diningValue"
  | "culinaryDensity"
  | "shopping"
  | "safetyTransit"
  | "weather"
  | "crowds";

type Layer = "verdict" | "drivers" | "impact";
type PersonalizationStep = 1 | 2 | 3;

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
  safetyTransit: "Safety + transit",
  weather: "Weather fit",
  crowds: "Low crowds",
};

const DRIVER_HELP: Record<DriverKey, string> = {
  flight: "Lower cost → higher score.",
  hotel: "Lower nightly → higher score.",
  diningValue: "Better value → higher score.",
  culinaryDensity: "More food depth → higher score.",
  shopping: "Better value + selection → higher score.",
  safetyTransit: "Higher index → higher score.",
  weather: "Higher index → higher score.",
  crowds: "Inverted: less crowded → higher score.",
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function nOr(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function fmt1(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function normalizeWeightsPct(
  raw: Partial<Record<DriverKey, number>>
): Record<DriverKey, number> {
  const safe: Record<DriverKey, number> = {
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

function tierCopy(tier: ScoredCity["tier"]) {
  if (tier === "S") {
    return {
      headline: "Elite fit.",
      sub: "Minimal tradeoffs across your priorities.",
    };
  }

  if (tier === "A") {
    return {
      headline: "Strong fit.",
      sub: "A few tradeoffs, but the core match is strong.",
    };
  }

  if (tier === "B") {
    return {
      headline: "Solid fit.",
      sub: "Works well with clear tradeoffs.",
    };
  }

  if (tier === "C") {
    return {
      headline: "Mixed fit.",
      sub: "Viable if your constraints are flexible.",
    };
  }

  return {
    headline: "Weak fit.",
    sub: "Likely misaligned with your current priorities.",
  };
}

function useMounted() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return matches;
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
  onSetVisited: (v: boolean) => void;
  onSetTrips: (n: number) => void;

  feedback?: CityFeedback;
  onSetFeedback: (v: CityFeedback) => void;

  shiftLeftPx?: number;
  isCompareOpen?: boolean;

  isPinned?: boolean;
  onTogglePin?: () => void;
}) {
  const mounted = useMounted();
  const isRail = useMediaQuery("(min-width: 720px)");

  const [layer, setLayer] = React.useState<Layer>("verdict");

  const panelRef = React.useRef<HTMLElement | null>(null);
  const scrollportRef = React.useRef<HTMLDivElement | null>(null);

  const cityId = selected?.city?.id ?? "destination";

  React.useEffect(() => {
    setLayer("verdict");
  }, [cityId]);

  React.useLayoutEffect(() => {
    const scrollport = scrollportRef.current;
    if (!scrollport) return;

    scrollport.scrollTop = 0;

    const frame = requestAnimationFrame(() => {
      scrollport.scrollTop = 0;
    });

    return () => cancelAnimationFrame(frame);
  }, [cityId, layer, mounted]);

  React.useEffect(() => {
    if (!mounted) return;

    const html = document.documentElement;
    const body = document.body;

    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [mounted]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [cityId]);

  const handleWheelCapture = React.useCallback((event: React.WheelEvent) => {
    const scrollport = scrollportRef.current;
    const panel = panelRef.current;

    if (!scrollport || !panel) return;
    if (!(event.target instanceof Node)) return;
    if (!panel.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();

    const multiplier =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollport.clientHeight : 1;

    scrollport.scrollTop += event.deltaY * multiplier;
    scrollport.scrollLeft += event.deltaX * multiplier;
  }, []);

  const components = React.useMemo(() => getComponents(selected as any), [selected]);

  const weightsPct = React.useMemo(
    () =>
      normalizeWeightsPct(
        ((selected as any)?.weightsPct ?? {}) as Partial<Record<DriverKey, number>>
      ),
    [selected]
  );

  const score = nOr((selected as any)?.totalScore, nOr((selected as any)?.score, 0));
  const cityName = selected?.city?.name ?? "Destination";
  const cityCountry = selected?.city?.country ?? country ?? "";
  const tier = selected?.tier ?? "C";

  const ranked = React.useMemo(() => {
    return DRIVER_ORDER.map((k) => {
      const w = weightsPct[k];
      const s = components[k];
      const pts = (w / 100) * s;

      return { k, w, s, pts };
    }).sort((a, b) => b.pts - a.pts);
  }, [weightsPct, components]);

  const top3 = ranked.slice(0, 3);
  const copy = tierCopy(tier);
  const rightOffset = isCompareOpen ? Math.max(24, shiftLeftPx + 24) : 24;

  if (!mounted) return null;

  const modal = (
    <div
      data-city-modal-root="true"
      className="fixed inset-0 z-[1300] overflow-hidden pointer-events-auto"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="pointer-events-none fixed inset-y-0 right-0 w-[min(900px,100vw)] bg-[linear-gradient(to_left,rgba(2,3,5,0.94),rgba(2,3,5,0.58),transparent)]" />

      <aside
        ref={panelRef}
        key={cityId}
        role="dialog"
        aria-modal="true"
        aria-label={`${cityName} destination details`}
        tabIndex={-1}
        data-city-modal-panel="true"
        onWheelCapture={handleWheelCapture}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={cn(
          "pointer-events-auto fixed isolate overflow-hidden border border-white/[0.10] outline-none",
          "shadow-[0_34px_110px_rgba(0,0,0,0.86)] ring-1 ring-white/[0.045]",
          "before:pointer-events-none before:absolute before:inset-0 before:z-[-1] before:bg-[radial-gradient(circle_at_18%_0%,rgba(200,170,110,0.08),transparent_34%),linear-gradient(180deg,#070a0f_0%,#05070b_46%,#06080c_100%)]",
          isRail ? "rounded-[32px]" : "rounded-[28px]"
        )}
        style={
          isRail
            ? {
                top: 92,
                bottom: 20,
                right: rightOffset,
                width: 560,
                maxWidth: "calc(100vw - 48px)",
                backgroundColor: "#05070b",
              }
            : {
                top: 84,
                right: 12,
                bottom: 12,
                left: 12,
                backgroundColor: "#05070b",
              }
        }
      >
        <div
          ref={scrollportRef}
          data-city-modal-scrollport="true"
          style={{
            position: "absolute",
            inset: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            scrollBehavior: "auto",
            scrollbarGutter: "stable",
            backgroundColor: "#05070b",
          }}
        >
          <div className="h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.22),rgba(200,170,110,0.62),transparent)]" />

          <header className="border-b border-white/[0.08] bg-[#070a0f]">
            <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c8aa6e] shadow-[0_0_16px_rgba(200,170,110,0.62)]" />
                    <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#c8aa6e]/78">
                      Destination console
                    </div>
                  </div>

                  <div className="mt-4 truncate text-[34px] font-semibold leading-none tracking-[-0.065em] text-white">
                    {cityName}
                  </div>

                  {cityCountry ? (
                    <div className="mt-2 truncate text-sm font-medium text-white/52">
                      {cityCountry}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {onTogglePin ? (
                    <PanelButton
                      type="button"
                      onClick={onTogglePin}
                      active={isPinned}
                      title={isPinned ? "Remove from comparison" : "Pin to comparison"}
                    >
                      {isPinned ? "Pinned" : "Pin"}
                    </PanelButton>
                  ) : null}

                  <PanelButton type="button" onClick={onClose} title="Close details">
                    Close
                  </PanelButton>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_156px]">
                <HeroMetricCard label="Verdict">
                  <div className="mt-2 text-base font-semibold leading-6 text-white/92">
                    {copy.headline}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-white/56">{copy.sub}</div>
                </HeroMetricCard>

                <HeroMetricCard label="Alignment score">
                  <div className="mt-2 text-[38px] font-semibold leading-none tracking-[-0.07em] text-white">
                    {Math.round(score)}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">
                    /100
                  </div>
                </HeroMetricCard>
              </div>
            </div>

            <div className="border-t border-white/[0.06] bg-[#05070b] px-5 py-3 sm:px-6">
              <div className="grid grid-cols-3 rounded-[18px] border border-white/[0.08] bg-[#0b1017] p-1">
                <LayerTab active={layer === "verdict"} onClick={() => setLayer("verdict")}>
                  Verdict
                </LayerTab>
                <LayerTab active={layer === "drivers"} onClick={() => setLayer("drivers")}>
                  Drivers
                </LayerTab>
                <LayerTab active={layer === "impact"} onClick={() => setLayer("impact")}>
                  Impact
                </LayerTab>
              </div>
            </div>
          </header>

          <main className="bg-[#05070b]">
            <div className="space-y-5 p-5 sm:p-6">
              {layer === "verdict" ? (
                <VerdictLayer
                  cityKey={cityId}
                  cityName={cityName}
                  ranked={ranked}
                  top3={top3}
                  score={score}
                  components={components}
                  cityCountry={cityCountry}
                  tier={tier}
                  confidence={confidenceLabel(selected)}
                  budget={budgetLabel(selected)}
                  visited={visited}
                  trips={trips}
                  feedback={feedback}
                  onSetVisited={onSetVisited}
                  onSetTrips={onSetTrips}
                  onSetFeedback={onSetFeedback}
                />
              ) : null}

              {layer === "drivers" ? <DriversLayer ranked={ranked} /> : null}

              {layer === "impact" ? <ImpactLayer ranked={ranked} /> : null}
            </div>
          </main>

          <footer className="border-t border-white/[0.08] bg-[#05070a] px-5 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[11px] font-medium text-white/36">
                Model-driven destination fit
              </div>
              <div className="h-px min-w-16 flex-1 bg-[linear-gradient(to_right,rgba(200,170,110,0.32),transparent)]" />
            </div>
          </footer>
        </div>
      </aside>
    </div>
  );

  return createPortal(modal, document.body);
}

function VerdictLayer({
  cityKey,
  cityName,
  ranked,
  top3,
  score,
  components,
  cityCountry,
  tier,
  confidence,
  budget,
  visited,
  trips,
  feedback,
  onSetVisited,
  onSetTrips,
  onSetFeedback,
}: {
  cityKey: string | number;
  cityName: string;
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
  top3: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
  score: number;
  components: Record<DriverKey, number>;
  cityCountry: string;
  tier: ScoredCity["tier"];
  confidence: string;
  budget: string;
  visited?: boolean;
  trips?: number;
  feedback?: CityFeedback;
  onSetVisited: (v: boolean) => void;
  onSetTrips: (n: number) => void;
  onSetFeedback: (v: CityFeedback) => void;
}) {
  return (
    <>
      <SurfaceCard>
        <SectionKicker>Fast read</SectionKicker>

        <div className="mt-3 text-sm leading-6 text-white/72">
          <span className="font-semibold text-white/92">
            {DRIVER_LABEL[top3[0]?.k ?? "safetyTransit"]}
          </span>{" "}
          leads the fit
          {top3[1] ? `, while ${DRIVER_LABEL[top3[1].k]} reinforces it.` : "."}
        </div>

        <div className="mt-3 rounded-2xl border border-white/[0.07] bg-[#080c12] px-3 py-2 text-xs leading-5 text-white/48">
          {dominantConstraintLine(ranked)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
          <span className="font-semibold uppercase tracking-[0.18em] text-white/34">
            Descriptors
          </span>
          <span className="text-white/22">·</span>
          <span className="font-semibold text-white/70">Tier {tier}</span>
          <span className="text-white/22">·</span>
          <span className="font-semibold text-white/70">{confidence}</span>
          <span className="text-white/22">·</span>
          <span className="font-semibold text-emerald-100">{budget}</span>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard>
          <SectionKicker>Alignment score</SectionKicker>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="text-[42px] font-semibold leading-none tracking-[-0.07em] text-white">
              {Math.round(score)}
            </div>

            <div className="mb-1 rounded-full border border-white/[0.08] bg-[#080c12] px-2.5 py-1 text-[11px] font-semibold text-white/48">
              /100
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-[#c8aa6e]"
              style={{ width: `${clamp(score, 0, 100)}%` }}
            />
          </div>

          <div className="mt-3 text-xs leading-5 text-white/48">
            Confidence reflects how complete the data coverage is for your weighted priorities.
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionKicker>Top contributors</SectionKicker>

          <div className="mt-3 space-y-2">
            {top3.map((r) => (
              <ContributorMini key={r.k} row={r} />
            ))}
          </div>
        </SurfaceCard>
      </div>

      <PersonalizationWizard
        key={String(cityKey)}
        cityName={cityName}
        cityCountry={cityCountry}
        visited={visited}
        trips={trips}
        feedback={feedback}
        onSetVisited={onSetVisited}
        onSetTrips={onSetTrips}
        onSetFeedback={onSetFeedback}
      />

      <SurfaceCard>
        <SectionKicker>Travel conditions</SectionKicker>

        <div className="mt-3 divide-y divide-white/[0.06]">
          <DetailRow
            label="Weather"
            value={Math.round(components.weather)}
            help="Higher = more favorable overall climate conditions."
          />
          <DetailRow
            label="Crowds"
            value={Math.round(components.crowds)}
            help="Higher = more crowded. Lower is quieter."
          />
        </div>
      </SurfaceCard>
    </>
  );
}

function PersonalizationWizard({
  cityName,
  cityCountry,
  visited,
  trips,
  feedback,
  onSetVisited,
  onSetTrips,
  onSetFeedback,
}: {
  cityName: string;
  cityCountry: string;
  visited?: boolean;
  trips?: number;
  feedback?: CityFeedback;
  onSetVisited: (v: boolean) => void;
  onSetTrips: (n: number) => void;
  onSetFeedback: (v: CityFeedback) => void;
}) {
  const normalizedTrips = clamp(nOr(trips, 0), 0, 99);

  const initialStep: PersonalizationStep = feedback
    ? 3
    : normalizedTrips > 0 || visited
      ? 2
      : 1;

  const [step, setStep] = React.useState<PersonalizationStep>(initialStep);
  const [draftTrips, setDraftTrips] = React.useState<string>(String(normalizedTrips));
  const [localFeedback, setLocalFeedback] = React.useState<CityFeedback | undefined>(feedback);

  React.useEffect(() => {
    const nextTrips = clamp(nOr(trips, 0), 0, 99);
    setDraftTrips(String(nextTrips));
    setLocalFeedback(feedback);

    if (feedback) {
      setStep(3);
    } else if (nextTrips > 0 || visited) {
      setStep(2);
    } else {
      setStep(1);
    }
  }, [cityName, trips, visited, feedback]);

  const commitsTrips = React.useCallback(() => {
    const parsed = clamp(parseInt(draftTrips || "0", 10) || 0, 0, 99);
    onSetTrips(parsed);
    onSetVisited(parsed > 0);
    return parsed;
  }, [draftTrips, onSetTrips, onSetVisited]);

  const handleContinueFromTrips = React.useCallback(() => {
    commitsTrips();
    setStep(2);
  }, [commitsTrips]);

  const handleSelectFeedback = React.useCallback(
    (value: CityFeedback) => {
      commitsTrips();
      setLocalFeedback(value);
      onSetFeedback(value);
      setStep(3);
    },
    [commitsTrips, onSetFeedback]
  );

  const stepLabel =
    step === 1 ? "Step 1 of 3" : step === 2 ? "Step 2 of 3" : "Step 3 of 3";

  const displayFeedback = localFeedback
    ? localFeedback === "love"
      ? "Love"
      : localFeedback === "maybe"
        ? "Maybe"
        : "Pass"
    : null;

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-3">
        <SectionKicker>Personalization</SectionKicker>
        <div className="rounded-full border border-white/[0.08] bg-[#080c12] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38">
          {stepLabel}
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-4">
          <div className="text-base font-semibold text-white/92">
            How many times have you been to {cityName} before?
          </div>

          <div className="mt-1 text-sm leading-6 text-white/56">
            Tell us your prior familiarity so we can personalize the recommendation.
          </div>

          <div className="mt-4 rounded-[22px] border border-white/[0.10] bg-[#080c12] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium text-white/72">
                Previous visits
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  value={draftTrips}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setDraftTrips(raw === "" ? "" : String(clamp(parseInt(raw, 10), 0, 99)));
                  }}
                  className="h-11 w-24 rounded-[14px] border border-white/[0.10] bg-[#11161d] px-3 text-base font-semibold text-white/90 outline-none transition focus:border-[#c8aa6e]/45"
                />
                <span className="text-sm text-white/44">times</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <PanelButton type="button" onClick={handleContinueFromTrips}>
              Continue
            </PanelButton>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4">
          <div className="text-base font-semibold text-white/92">
            How did you like it?
          </div>

          <div className="mt-1 text-sm leading-6 text-white/56">
            We’ll use your sentiment to personalize how strongly this destination is favored.
          </div>

          <div className="mt-4 rounded-[22px] border border-white/[0.10] bg-[#080c12] p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5">
              <span className="font-semibold uppercase tracking-[0.16em] text-white/34">
                Recorded
              </span>
              <span className="text-white/22">·</span>
              <span className="font-semibold text-white/76">
                {clamp(parseInt(draftTrips || "0", 10) || 0, 0, 99)} visits
              </span>
              {cityCountry ? (
                <>
                  <span className="text-white/22">·</span>
                  <span className="font-semibold text-white/58">{cityCountry}</span>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <MiniChoice
                active={localFeedback === "love"}
                onClick={() => handleSelectFeedback("love")}
              >
                Love
              </MiniChoice>
              <MiniChoice
                active={localFeedback === "maybe"}
                onClick={() => handleSelectFeedback("maybe")}
              >
                Maybe
              </MiniChoice>
              <MiniChoice
                active={localFeedback === "pass"}
                onClick={() => handleSelectFeedback("pass")}
              >
                Pass
              </MiniChoice>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <PanelButton
              type="button"
              onClick={() => {
                setStep(1);
              }}
            >
              Back
            </PanelButton>

            <div className="text-xs text-white/38">Choose one to continue</div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4">
          <div className="text-base font-semibold text-white/92">
            Personalization saved
          </div>

          <div className="mt-1 text-sm leading-6 text-white/56">
            This will be taken into account in the final alignment score.
          </div>

          <div className="mt-4 rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 p-4">
            <div className="text-sm font-medium text-emerald-100">
              Your preference profile has been updated.
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs leading-5">
              <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 font-semibold text-white/84">
                {clamp(parseInt(draftTrips || "0", 10) || 0, 0, 99)} visits
              </span>

              {displayFeedback ? (
                <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 font-semibold text-white/84">
                  {displayFeedback}
                </span>
              ) : null}

              <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 font-semibold text-white/70">
                Saved for scoring
              </span>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <PanelButton
              type="button"
              onClick={() => {
                setStep(1);
              }}
            >
              Edit answers
            </PanelButton>
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function DriversLayer({
  ranked,
}: {
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
}) {
  return (
    <>
      <SurfaceCard>
        <SectionKicker>Driver model</SectionKicker>

        <div className="mt-2 text-sm leading-6 text-white/62">
          Weights × destination scores create the final alignment number.
        </div>
      </SurfaceCard>

      <div className="space-y-3">
        {ranked.map((r) => (
          <SurfaceCard key={r.k} compact>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90">
                  {DRIVER_LABEL[r.k]}
                </div>
                <div className="mt-1 text-xs leading-5 text-white/48">
                  {DRIVER_HELP[r.k]}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/32">
                  Driver
                </div>
                <div className="mt-1 text-sm font-semibold text-white/82">
                  {Math.round(r.s)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[#c8aa6e]"
                  style={{ width: `${clamp(r.s, 0, 100)}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-white/46">
                <span>
                  Weight{" "}
                  <span className="font-semibold text-white/78">
                    {Math.round(r.w)}%
                  </span>
                </span>
                <span>
                  Contribution{" "}
                  <span className="font-semibold text-emerald-100">{fmt1(r.pts)}</span>{" "}
                  pts
                </span>
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </>
  );
}

function ImpactLayer({
  ranked,
}: {
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>;
}) {
  const levers = ranked
    .map((r) => {
      const lever = (r.w / 100) * (100 - r.s);
      return { ...r, lever };
    })
    .sort((a, b) => b.lever - a.lever)
    .slice(0, 5);

  return (
    <>
      <SurfaceCard>
        <SectionKicker>Score levers</SectionKicker>

        <div className="mt-2 text-sm leading-6 text-white/62">
          Highest weight + lowest score reveals what would move this match most.
        </div>
      </SurfaceCard>

      <div className="space-y-3">
        {levers.map((r) => {
          const plus10 = (r.w / 100) * 10;

          return (
            <SurfaceCard key={r.k} compact>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    {DRIVER_LABEL[r.k]}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/48">
                    Current {Math.round(r.s)}/100 · Weight {Math.round(r.w)}%
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">
                    Lever
                  </div>
                  <div className="mt-1 text-sm font-semibold text-emerald-100">
                    {fmt1(r.lever)}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#080c12] p-3 text-xs leading-5 text-white/56">
                If this driver improved by{" "}
                <span className="font-semibold text-white/82">+10</span>, the total
                would move about{" "}
                <span className="font-semibold text-emerald-100">
                  +{fmt1(plus10)}
                </span>{" "}
                points.
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      <SurfaceCard>
        <SectionKicker>Interpretation</SectionKicker>

        <div className="mt-2 text-sm leading-6 text-white/62">
          High lever does not mean “bad.” It means that area is the strongest opportunity
          to improve the match score.
        </div>
      </SurfaceCard>
    </>
  );
}

function SurfaceCard({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0d1219] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]",
        compact ? "p-4" : "p-5"
      )}
      style={{ backgroundColor: "#0d1219" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.14),rgba(200,170,110,0.18),transparent)]" />
      {children}
    </div>
  );
}

function HeroMetricCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0b1017] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
      style={{ backgroundColor: "#0b1017" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(200,170,110,0.28),transparent)]" />
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
        {label}
      </div>
      {children}
    </div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/34">
      {children}
    </div>
  );
}

function PanelButton({
  active = false,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      {...props}
      onPointerDown={(e) => {
        e.stopPropagation();
        props.onPointerDown?.(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.(e);
      }}
      className={cn(
        "h-9 rounded-[14px] border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "border-emerald-400/24 bg-emerald-400/12 text-emerald-100 hover:border-emerald-400/38"
          : "border-white/[0.10] bg-[#11161d] text-white/74 hover:border-white/[0.18] hover:bg-[#171e27] hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

function LayerTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "h-9 rounded-[14px] text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "border border-[#c8aa6e]/30 bg-[#c8aa6e]/12 text-[#f1dfb8] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "border border-transparent text-white/52 hover:bg-white/[0.04] hover:text-white/82"
      )}
    >
      {children}
    </button>
  );
}

function MiniChoice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-events-auto relative z-10 h-10 rounded-[14px] border px-4 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "border-[#c8aa6e]/70 bg-[#c8aa6e]/18 text-[#f8e7bf] shadow-[0_0_0_1px_rgba(200,170,110,0.18),0_10px_24px_rgba(200,170,110,0.08)]"
          : "border-white/[0.10] bg-[#11161d] text-white/66 hover:border-white/[0.18] hover:bg-[#171e27] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function ContributorMini({
  row,
}: {
  row: { k: DriverKey; w: number; s: number; pts: number };
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#080c12] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-white/84">{DRIVER_LABEL[row.k]}</div>
        <div className="text-[11px] text-white/44">{Math.round(row.s)}/100</div>
      </div>

      <div className="mt-1 text-[11px] leading-5 text-white/46">
        Adds <span className="font-semibold text-emerald-100">{fmt1(row.pts)}</span> pts
      </div>
    </div>
  );
}

function DetailRow({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-white/74">{label}</div>
        <div className="text-sm font-semibold text-white/88">{value}</div>
      </div>

      <div className="mt-1 text-xs leading-5 text-white/46">{help}</div>
    </div>
  );
}

function confidenceLabel(selected: ScoredCity) {
  const c = (selected as any)?.confidence;

  if (typeof c === "number") {
    if (c >= 0.8) return "High confidence";
    if (c >= 0.55) return "Medium confidence";
    return "Low confidence";
  }

  return "High confidence";
}

function budgetLabel(selected: ScoredCity) {
  const st = ((selected as any)?.budgetStatus ?? "unknown") as string;

  if (st === "under") return "Budget under";
  if (st === "within") return "Within budget";
  if (st === "over") return "Over budget";

  return "Budget unknown";
}

function dominantConstraintLine(
  ranked: Array<{ k: DriverKey; w: number; s: number; pts: number }>
) {
  const weightedWeakness = [...ranked]
    .filter((r) => r.w >= 18)
    .sort((a, b) => a.s - b.s)[0];

  if (weightedWeakness && weightedWeakness.s <= 45) {
    return `Primary constraint: ${DRIVER_LABEL[weightedWeakness.k]} is important to your profile but weaker here.`;
  }

  return "No dominant constraint detected.";
}