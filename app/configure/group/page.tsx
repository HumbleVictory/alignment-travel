// app/configure/group/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SETUP,
  loadSetup,
  saveSetup,
  type GroupDynamicTravelStyle,
  type SetupGroupDynamic,
} from "@/lib/clientSetup";
import { H1, P } from "@/components/Typography";

type FlowStage = "party" | "count" | "access" | "read";

const TRAVEL_STYLE_OPTIONS: Array<{
  id: GroupDynamicTravelStyle;
  title: string;
  description: string;
}> = [
  {
    id: "solo",
    title: "Solo",
    description: "Maximum flexibility. Scoring stays closest to your personal priorities.",
  },
  {
    id: "partner",
    title: "Partner",
    description: "A small party with shared comfort needs and lighter logistics.",
  },
  {
    id: "friends",
    title: "Friends",
    description: "Group energy, coordination, and budget stretch matter more.",
  },
  {
    id: "family",
    title: "Family",
    description: "Comfort, safety, predictability, and simpler movement carry more weight.",
  },
  {
    id: "family_with_kids",
    title: "Family with kids",
    description: "Adds kid-friendly comfort, lower-friction transit, and calmer pacing.",
  },
  {
    id: "multigenerational",
    title: "Multi-generational",
    description: "Accounts for elders, kids, accessibility, and lower-hassle logistics.",
  },
  {
    id: "other",
    title: "Other group",
    description: "Flexible setup when your trip does not fit a standard category.",
  },
];

const FLOW_STEPS: Array<{ id: FlowStage; label: string }> = [
  { id: "party", label: "Party" },
  { id: "count", label: "Count" },
  { id: "access", label: "Access" },
  { id: "read", label: "Read" },
];

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function nOr(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function StepPill({ step, label }: { step: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-white/70">
      <span className="text-white/80">{step}</span>
      <span className="text-white/35">·</span>
      <span className="text-white/65">{label}</span>
    </div>
  );
}

function sanitizeGroupDynamic(raw: Partial<SetupGroupDynamic> | null | undefined): SetupGroupDynamic {
  const travelStyle =
    raw?.travelStyle === "partner" ||
    raw?.travelStyle === "friends" ||
    raw?.travelStyle === "family" ||
    raw?.travelStyle === "family_with_kids" ||
    raw?.travelStyle === "multigenerational" ||
    raw?.travelStyle === "other"
      ? raw.travelStyle
      : "solo";

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

function getNextStageFromParty(style: GroupDynamicTravelStyle): FlowStage {
  return style === "solo" ? "access" : "count";
}

function getPreviousStage(stage: FlowStage, style: GroupDynamicTravelStyle): FlowStage {
  if (stage === "party") return "party";
  if (stage === "count") return "party";
  if (stage === "access") return style === "solo" ? "party" : "count";
  return "access";
}

function StageProgress({
  active,
  travelStyle,
  onJump,
}: {
  active: FlowStage;
  travelStyle: GroupDynamicTravelStyle;
  onJump: (stage: FlowStage) => void;
}) {
  const visibleSteps = travelStyle === "solo" ? FLOW_STEPS.filter((s) => s.id !== "count") : FLOW_STEPS;
  const activeIndex = visibleSteps.findIndex((s) => s.id === active);

  return (
    <div className="rounded-full border border-white/10 bg-black/25 p-1">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${visibleSteps.length}, minmax(0, 1fr))` }}>
        {visibleSteps.map((step, index) => {
          const selected = step.id === active;
          const completed = index < activeIndex;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onJump(step.id)}
              className={[
                "rounded-full px-3 py-2 text-[11px] font-semibold transition",
                selected
                  ? "bg-white text-black"
                  : completed
                    ? "bg-emerald-400/10 text-emerald-100"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/75",
              ].join(" ")}
            >
              {index + 1}. {step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PremiumCard({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] shadow-[0_32px_120px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.28),rgba(16,185,129,0.35),transparent)]" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />

      <div className="relative p-6 md:p-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/38">{eyebrow}</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">{title}</h2>
        <div className="mt-3 max-w-2xl text-sm leading-6 text-white/58">{description}</div>

        <div className="mt-8">{children}</div>

        <div className="mt-8 rounded-[26px] border border-white/10 bg-black/30 p-4 backdrop-blur-xl">{footer}</div>
      </div>
    </section>
  );
}

function CounterRow({
  label,
  helper,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-black/22 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-semibold text-white/90">{label}</div>
          <div className="mt-1 max-w-xl text-sm leading-6 text-white/50">{helper}</div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2 py-1">
          <button
            type="button"
            onClick={() => onChange(clamp(value - 1, min, max))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl text-white/70 transition hover:border-white/20 hover:text-white"
          >
            −
          </button>

          <div className="min-w-[46px] text-center text-base font-semibold text-white/92">{value}</div>

          <button
            type="button"
            onClick={() => onChange(clamp(value + 1, min, max))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl text-white/70 transition hover:border-white/20 hover:text-white"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleTile({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative rounded-[28px] border p-5 text-left transition",
        checked
          ? "border-emerald-400/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(255,255,255,0.03))] shadow-[0_22px_80px_rgba(16,185,129,0.08)]"
          : "border-white/10 bg-black/22 hover:border-white/18 hover:bg-black/30",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-black",
            checked
              ? "border-emerald-300/45 bg-emerald-400/20 text-emerald-100"
              : "border-white/15 text-white/25",
          ].join(" ")}
        >
          {checked ? "✓" : ""}
        </div>

        <div>
          <div className="text-base font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-sm leading-6 text-white/52">{description}</div>
        </div>
      </div>
    </button>
  );
}

function StatBox({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[24px] border p-4",
        accent
          ? "border-emerald-400/25 bg-emerald-400/10"
          : "border-white/10 bg-black/24",
      ].join(" ")}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">{label}</div>
      <div className={["mt-2 text-2xl font-semibold", accent ? "text-emerald-100" : "text-white/90"].join(" ")}>
        {value}
      </div>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl px-5 py-3 text-sm font-semibold transition",
        variant === "primary"
          ? "bg-white text-black hover:bg-white/90"
          : "border border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function ConfigureGroupPage() {
  const [hydrated, setHydrated] = useState(false);
  const [stage, setStage] = useState<FlowStage>("party");
  const [groupDynamic, setGroupDynamic] = useState<SetupGroupDynamic>(DEFAULT_SETUP.groupDynamic);

  useEffect(() => {
    const s = loadSetup();
    setGroupDynamic(sanitizeGroupDynamic(s.groupDynamic));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const curr = loadSetup();

    saveSetup({
      ...curr,
      groupDynamic: sanitizeGroupDynamic(groupDynamic),
    });
  }, [hydrated, groupDynamic]);

  const selectedOption = useMemo(() => {
    return TRAVEL_STYLE_OPTIONS.find((option) => option.id === groupDynamic.travelStyle) ?? TRAVEL_STYLE_OPTIONS[0];
  }, [groupDynamic.travelStyle]);

  const isSolo = groupDynamic.travelStyle === "solo";
  const totalTravelers = groupDynamic.adults + groupDynamic.kids + groupDynamic.babies + groupDynamic.elders;
  const accessibilityCount = [
    groupDynamic.mobilityNeeds,
    groupDynamic.disabilityNeeds,
    groupDynamic.strollerNeeds,
    groupDynamic.comfortSensitive,
  ].filter(Boolean).length;

  function patchGroup(patch: Partial<SetupGroupDynamic>) {
    setGroupDynamic((prev) => sanitizeGroupDynamic({ ...prev, ...patch }));
  }

  function selectTravelStyle(next: GroupDynamicTravelStyle) {
    setGroupDynamic((prev) => {
      const base: SetupGroupDynamic = {
        ...prev,
        travelStyle: next,
      };

      if (next === "solo") {
        return sanitizeGroupDynamic({
          ...base,
          adults: 1,
          kids: 0,
          babies: 0,
          elders: 0,
          strollerNeeds: false,
        });
      }

      if (next === "family_with_kids") {
        return sanitizeGroupDynamic({
          ...base,
          adults: Math.max(prev.adults, 2),
          kids: Math.max(prev.kids, 1),
        });
      }

      if (next === "multigenerational") {
        return sanitizeGroupDynamic({
          ...base,
          adults: Math.max(prev.adults, 2),
          kids: Math.max(prev.kids, 1),
          elders: Math.max(prev.elders, 1),
        });
      }

      return sanitizeGroupDynamic({
        ...base,
        adults: Math.max(prev.adults, 2),
      });
    });
  }

  function goNext() {
    if (stage === "party") {
      setStage(getNextStageFromParty(groupDynamic.travelStyle));
      return;
    }

    if (stage === "count") {
      setStage("access");
      return;
    }

    if (stage === "access") {
      setStage("read");
      return;
    }
  }

  function goBack() {
    setStage((curr) => getPreviousStage(curr, groupDynamic.travelStyle));
  }

  function jumpStage(next: FlowStage) {
    if (groupDynamic.travelStyle === "solo" && next === "count") {
      setStage("party");
      return;
    }

    setStage(next);
  }

  if (!hydrated) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="shell p-7 md:p-10">
          <header className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-4xl">
                <StepPill step="Step 3/3" label="Group dynamic" />
                <H1 className="mt-4 text-4xl leading-[0.96] md:text-6xl">Who is this trip for?</H1>
                <P className="mt-4 max-w-3xl">
                  A guided setup for comfort, logistics, mobility, and budget pressure — one decision at a time.
                </P>
              </div>

              <Link
                href="/configure/setup"
                className="ui-btn self-start rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/70 hover:border-white/20 hover:text-white/90"
              >
                Back
              </Link>
            </div>

            <div className="max-w-3xl">
              <StageProgress active={stage} travelStyle={groupDynamic.travelStyle} onJump={jumpStage} />
            </div>
          </header>

          <div className="mx-auto mt-8 max-w-4xl">
            {stage === "party" ? (
              <PremiumCard
                eyebrow="Travel party"
                title="Who are you travelling with?"
                description="Choose the closest match. The next question adapts based on your answer."
                footer={
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs leading-5 text-white/50">
                      Selected: <span className="font-semibold text-white/80">{selectedOption?.title}</span>
                    </div>

                    <NavButton onClick={goNext} variant="primary">
                      Continue
                    </NavButton>
                  </div>
                }
              >
                <label className="block">
                  <div className="mb-3 text-sm font-semibold text-white/75">Travel party</div>

                  <select
                    value={groupDynamic.travelStyle}
                    onChange={(e) => {
                      const next = e.target.value as GroupDynamicTravelStyle;
                      selectTravelStyle(next);
                    }}
                    className="w-full rounded-[26px] border border-white/10 bg-black/30 px-5 py-4 text-base font-semibold text-white/90 outline-none transition focus:border-emerald-400/35"
                  >
                    {TRAVEL_STYLE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 rounded-[26px] border border-white/10 bg-black/22 p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                      What this means
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white/90">{selectedOption?.title}</div>
                    <div className="mt-2 text-sm leading-6 text-white/55">{selectedOption?.description}</div>
                  </div>
                </label>
              </PremiumCard>
            ) : null}

            {stage === "count" ? (
              <PremiumCard
                eyebrow="Party size"
                title="Refine the count."
                description="This controls budget estimates and how much comfort/logistics sensitivity gets added to the score."
                footer={
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <NavButton onClick={goBack}>Back</NavButton>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="text-xs leading-5 text-white/50">
                        Total: <span className="font-semibold text-white/80">{totalTravelers} travelers</span>
                      </div>

                      <NavButton onClick={goNext} variant="primary">
                        Continue
                      </NavButton>
                    </div>
                  </div>
                }
              >
                <div className="grid gap-3">
                  <CounterRow
                    label="Adults"
                    helper="Primary adult travelers, excluding elders if you want them weighted separately."
                    value={groupDynamic.adults}
                    min={1}
                    max={30}
                    onChange={(next) => patchGroup({ adults: next })}
                  />

                  <CounterRow
                    label="Kids"
                    helper="Children who increase need for easier pacing and kid-friendly comfort."
                    value={groupDynamic.kids}
                    min={0}
                    max={30}
                    onChange={(next) => patchGroup({ kids: next })}
                  />

                  <CounterRow
                    label="Babies / toddlers"
                    helper="Adds stronger low-friction and stroller-sensitive weighting."
                    value={groupDynamic.babies}
                    min={0}
                    max={10}
                    onChange={(next) =>
                      patchGroup({
                        babies: next,
                        strollerNeeds: next > 0 ? true : groupDynamic.strollerNeeds,
                      })
                    }
                  />

                  <CounterRow
                    label="Elders"
                    helper="Adds comfort, safety, transit ease, and lower-exertion sensitivity."
                    value={groupDynamic.elders}
                    min={0}
                    max={20}
                    onChange={(next) => patchGroup({ elders: next })}
                  />
                </div>
              </PremiumCard>
            ) : null}

            {stage === "access" ? (
              <PremiumCard
                eyebrow="Comfort + Access"
                title="Any comfort or access needs?"
                description="Optional. Mark only what matters for this specific trip."
                footer={
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <NavButton onClick={goBack}>Back</NavButton>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="text-xs leading-5 text-white/50">
                        Selected:{" "}
                        <span className="font-semibold text-white/80">
                          {accessibilityCount === 0 ? "None" : `${accessibilityCount} preference${accessibilityCount === 1 ? "" : "s"}`}
                        </span>
                      </div>

                      <NavButton onClick={goNext} variant="primary">
                        Continue
                      </NavButton>
                    </div>
                  </div>
                }
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleTile
                    title="Comfort-sensitive trip"
                    description="Prioritize smoother hotels, easier pacing, and lower-friction destinations."
                    checked={groupDynamic.comfortSensitive}
                    onChange={(next) => patchGroup({ comfortSensitive: next })}
                  />

                  <ToggleTile
                    title="Mobility-sensitive traveler"
                    description="Increase weight on transit ease, safety, walkability, and simpler movement."
                    checked={groupDynamic.mobilityNeeds}
                    onChange={(next) => patchGroup({ mobilityNeeds: next })}
                  />

                  <ToggleTile
                    title="Disability access matters"
                    description="Favor destinations that score better on ease, infrastructure, and predictability."
                    checked={groupDynamic.disabilityNeeds}
                    onChange={(next) => patchGroup({ disabilityNeeds: next })}
                  />

                  <ToggleTile
                    title="Stroller-friendly preferred"
                    description="Useful for babies, toddlers, or anyone needing smoother street and transit logistics."
                    checked={groupDynamic.strollerNeeds}
                    onChange={(next) => patchGroup({ strollerNeeds: next })}
                  />
                </div>
              </PremiumCard>
            ) : null}

            {stage === "read" ? (
              <PremiumCard
                eyebrow="Trip read"
                title="Personalization saved."
                description="This group dynamic will be included in the final alignment score and estimated trip-cost behavior."
                footer={
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <NavButton onClick={goBack}>Back</NavButton>

                    <Link
                      href="/results"
                      className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                      View outcomes
                    </Link>
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatBox label="Travel party" value={selectedOption?.title ?? "Solo"} accent />
                  <StatBox label="Travelers" value={String(isSolo ? 1 : totalTravelers)} />
                  <StatBox label="Adults" value={String(groupDynamic.adults)} />
                  <StatBox label="Kids + babies" value={String(groupDynamic.kids + groupDynamic.babies)} />
                  <StatBox label="Elders" value={String(groupDynamic.elders)} />
                  <StatBox label="Access flags" value={String(accessibilityCount)} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setStage("party")}
                    className="rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    Edit party
                  </button>

                  {!isSolo ? (
                    <button
                      type="button"
                      onClick={() => setStage("count")}
                      className="rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
                    >
                      Edit count
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setStage("access")}
                    className="rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    Edit access
                  </button>
                </div>
              </PremiumCard>
            ) : null}
          </div>

          <footer className="mt-10 text-xs text-white/35">© {new Date().getFullYear()} Alignment Travel</footer>
        </div>
      </div>
    </main>
  );
}