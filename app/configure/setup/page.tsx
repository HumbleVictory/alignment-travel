// app/configure/setup/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PROFILES } from "@/data/profiles";
import {
  DEFAULT_SETUP,
  loadSetup,
  saveSetup,
  type SetupWeights,
} from "@/lib/clientSetup";
import { H1, P } from "@/components/Typography";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type TuningMode = "rank" | "sliders";
type TopicKey = keyof SetupWeights;

const TOPICS: Array<{
  key: TopicKey;
  label: string;
  description: string;
}> = [
  {
    key: "cost",
    label: "Cost",
    description: "Value, budget efficiency, and lower trip friction.",
  },
  {
    key: "comfort",
    label: "Comfort",
    description: "Hotels, smoother logistics, and easier pacing.",
  },
  {
    key: "food",
    label: "Food",
    description: "Dining quality, culinary density, and food culture.",
  },
  {
    key: "culture",
    label: "Culture",
    description: "Museums, identity, atmosphere, and local depth.",
  },
  {
    key: "nightlife",
    label: "Nightlife",
    description: "Energy, bars, late-night dining, and social momentum.",
  },
  {
    key: "safety",
    label: "Safety",
    description: "Safety, transit ease, and practical confidence.",
  },
  {
    key: "shopping",
    label: "Shopping",
    description: "Luxury, contemporary retail, value, and selection.",
  },
  {
    key: "weather",
    label: "Weather",
    description: "Seasonal comfort and climate fit.",
  },
  {
    key: "crowds",
    label: "Crowds",
    description: "Lower crowd pressure and calmer movement.",
  },
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

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white/85">{label}</span>
        <span className="text-xs font-semibold text-white/45">{value}</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10), 0, 100))}
        className="w-full"
      />
    </label>
  );
}

function modeButtonClass(active: boolean) {
  return [
    "rounded-2xl px-4 py-3 text-sm font-semibold transition",
    active
      ? "border border-[#c8aa6e]/35 bg-[#c8aa6e]/12 text-[#f1dfb8] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "border border-white/10 bg-black/20 text-white/60 hover:border-white/20 hover:text-white/85",
  ].join(" ");
}

function topicButtonClass(active: boolean) {
  return [
    "group relative rounded-[22px] border p-4 text-left transition",
    active
      ? "border-emerald-400/30 bg-emerald-400/10 shadow-[0_18px_60px_rgba(16,185,129,0.08)]"
      : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/25",
  ].join(" ");
}

function rankToWeights(rank: TopicKey[]): SetupWeights {
  const background = 8;
  const rankedScores = [100, 86, 72, 58, 46, 36, 28, 20, 14];

  const next: SetupWeights = {
    cost: background,
    comfort: background,
    food: background,
    culture: background,
    nightlife: background,
    safety: background,
    shopping: background,
    weather: background,
    crowds: background,
  };

  rank.forEach((key, index) => {
    next[key] = rankedScores[index] ?? 14;
  });

  return next;
}

function inferRankFromWeights(weights: SetupWeights): TopicKey[] {
  const values = TOPICS.map((topic) => ({
    key: topic.key,
    value: clamp(nOr(weights[topic.key], 0), 0, 100),
  }));

  const max = Math.max(...values.map((v) => v.value));
  const min = Math.min(...values.map((v) => v.value));

  // If everything is basically equal, do not pretend the user ranked priorities.
  if (Math.abs(max - min) < 8) return [];

  return values
    .filter((v) => v.value >= 20)
    .sort((a, b) => b.value - a.value)
    .map((v) => v.key);
}

function RankRow({
  index,
  topic,
  dragging,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  canMoveUp,
  canMoveDown,
}: {
  index: number;
  topic: (typeof TOPICS)[number];
  dragging: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", topic.key);
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={[
        "group rounded-[22px] border bg-black/25 p-4 transition",
        "cursor-grab active:cursor-grabbing",
        dragging
          ? "scale-[0.985] border-[#c8aa6e]/45 bg-[#c8aa6e]/10 opacity-70 shadow-[0_18px_70px_rgba(200,170,110,0.10)]"
          : "border-white/10 hover:border-[#c8aa6e]/25 hover:bg-black/30",
      ].join(" ")}
      title="Drag to reorder"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c8aa6e]/25 bg-[#c8aa6e]/10 text-[11px] font-bold tracking-[0.14em] text-[#f1dfb8]">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-white/90">{topic.label}</div>
              <div className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 group-hover:inline-flex">
                drag
              </div>
            </div>

            <div className="mt-1 text-xs leading-5 text-white/48">{topic.description}</div>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-1"
          onPointerDown={(e) => {
            // Keeps button clicks from feeling like drag handles.
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/55 transition hover:border-rose-400/25 hover:bg-rose-400/10 hover:text-rose-100"
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfigureSetupPage() {
  const [hydrated, setHydrated] = useState(false);

  const [profileId, setProfileId] = useState<string>(DEFAULT_SETUP.profileId);
  const [budgetUsd, setBudgetUsd] = useState<number>(DEFAULT_SETUP.budgetUsd);
  const [budgetUsdInput, setBudgetUsdInput] = useState<string>(String(DEFAULT_SETUP.budgetUsd));
  const [month, setMonth] = useState<string>(DEFAULT_SETUP.month);

  // Numeric saved value
  const [tripDays, setTripDays] = useState<number>(
    clamp(nOr((DEFAULT_SETUP as any).tripDays ?? (DEFAULT_SETUP as any).days, 5), 1, 60)
  );

  // String editing value so backspace can temporarily clear the field
  const [tripDaysInput, setTripDaysInput] = useState<string>(
    String(clamp(nOr((DEFAULT_SETUP as any).tripDays ?? (DEFAULT_SETUP as any).days, 5), 1, 60))
  );

  const [weights, setWeights] = useState<SetupWeights>(DEFAULT_SETUP.weights);
  const [showTuning, setShowTuning] = useState(false);
  const [tuningMode, setTuningMode] = useState<TuningMode>("rank");
  const [priorityRank, setPriorityRank] = useState<TopicKey[]>([]);
  const [draggingTopic, setDraggingTopic] = useState<TopicKey | null>(null);

  useEffect(() => {
    const s = loadSetup();

    const loadedBudget = clamp(nOr(s.budgetUsd, DEFAULT_SETUP.budgetUsd), 0, 1_000_000);
    const loadedTripDays = clamp(
      nOr((s as any).tripDays ?? (s as any).days, DEFAULT_SETUP.days),
      1,
      60
    );

    const loadedWeights = s.weights ?? DEFAULT_SETUP.weights;
    const inferredRank = inferRankFromWeights(loadedWeights);

    setProfileId(s.profileId);
    setBudgetUsd(loadedBudget);
    setBudgetUsdInput(String(loadedBudget));
    setMonth(typeof s.month === "string" ? s.month : DEFAULT_SETUP.month);
    setTripDays(loadedTripDays);
    setTripDaysInput(String(loadedTripDays));
    setWeights(loadedWeights);
    setPriorityRank(inferredRank);
    setTuningMode("rank");

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    // Preserve newer setup sections like groupDynamic while editing Step 2.
    const curr = loadSetup();

    saveSetup({
      ...curr,
      profileId,
      budgetUsd,
      month,
      days: tripDays,
      tripDays,
      weights,
    } as any);
  }, [hydrated, profileId, budgetUsd, month, tripDays, weights]);

  const selectedProfile = useMemo(() => {
    return (PROFILES as any[]).find((p) => p.id === profileId) ?? (PROFILES as any[])[0];
  }, [profileId]);

  const rankedTopics = useMemo(() => {
    return priorityRank
      .map((key) => TOPICS.find((topic) => topic.key === key))
      .filter(Boolean) as typeof TOPICS;
  }, [priorityRank]);

  const availableTopics = useMemo(() => {
    return TOPICS.filter((topic) => !priorityRank.includes(topic.key));
  }, [priorityRank]);

  function updateWeight<K extends keyof SetupWeights>(key: K, next: number) {
    setProfileId("custom");
    setWeights((prev) => ({
      ...prev,
      [key]: clamp(next, 0, 100),
    }));
  }

  function applyRank(nextRank: TopicKey[]) {
    setProfileId("custom");
    setPriorityRank(nextRank);
    setWeights(rankToWeights(nextRank));
  }

  function addTopic(key: TopicKey) {
    if (priorityRank.includes(key)) return;
    applyRank([...priorityRank, key]);
  }

  function removeTopic(key: TopicKey) {
    applyRank(priorityRank.filter((item) => item !== key));
  }

  function moveTopic(key: TopicKey, direction: "up" | "down") {
    const index = priorityRank.indexOf(key);
    if (index < 0) return;

    const next = [...priorityRank];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;

    const current = next[index];
    next[index] = next[target];
    next[target] = current;

    applyRank(next);
  }

  function reorderTopic(dragKey: TopicKey, targetKey: TopicKey) {
    if (dragKey === targetKey) return;

    const from = priorityRank.indexOf(dragKey);
    const to = priorityRank.indexOf(targetKey);

    if (from < 0 || to < 0) return;

    const next = [...priorityRank];
    next.splice(from, 1);
    next.splice(to, 0, dragKey);

    applyRank(next);
  }

  function clearRank() {
    applyRank([]);
    setDraggingTopic(null);
  }

  function commitBudgetInput(raw: string) {
    const trimmed = raw.trim();

    if (trimmed === "") {
      setBudgetUsd(0);
      setBudgetUsdInput("");
      return;
    }

    const parsed = parseInt(trimmed, 10);
    const safe = clamp(Number.isFinite(parsed) ? parsed : 0, 0, 1_000_000);

    setBudgetUsd(safe);
    setBudgetUsdInput(String(safe));
  }

  function commitTripDaysInput(raw: string) {
    const trimmed = raw.trim();

    if (trimmed === "") {
      setTripDays(1);
      setTripDaysInput("1");
      return;
    }

    const parsed = parseInt(trimmed, 10);
    const safe = clamp(Number.isFinite(parsed) ? parsed : 1, 1, 60);

    setTripDays(safe);
    setTripDaysInput(String(safe));
  }

  if (!hydrated) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="shell p-8 md:p-10">
          <header className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <StepPill step="Step 2/3" label="Trip basics" />
                <H1 className="mt-3 text-4xl md:text-6xl">Set trip basics.</H1>
                <P className="mt-4">Budget + length first. Tuning stays optional.</P>
              </div>

              <Link
                href="/configure/profile"
                className="ui-btn self-start rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/70 hover:border-white/20 hover:text-white/90"
              >
                Back
              </Link>
            </div>
          </header>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <section className="panel p-5">
              <div className="text-sm font-semibold text-white/85">Essentials</div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-white/75">Profile</div>
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  >
                    {(PROFILES as any[]).map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 text-xs leading-relaxed text-white/45">
                    {selectedProfile?.description ??
                      "Choose a base profile, then optionally tune it below."}
                  </div>
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-white/75">Total budget (USD)</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000000}
                    value={budgetUsdInput}
                    onChange={(e) => {
                      setBudgetUsdInput(e.target.value);
                    }}
                    onBlur={(e) => {
                      commitBudgetInput(e.target.value);
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-white/75">Trip length (days)</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={tripDaysInput}
                    onChange={(e) => {
                      setTripDaysInput(e.target.value);
                    }}
                    onBlur={(e) => {
                      commitTripDaysInput(e.target.value);
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-white/75">Month</div>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setShowTuning((v) => !v)}
                  className="ui-btn w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/20 hover:text-white"
                >
                  {showTuning ? "Hide tuning" : "Tuning (optional)"}
                </button>

                <div className="text-xs text-white/40">Keep it simple. Only tune if you want to.</div>
              </div>
            </section>

            <section className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white/85">Tuning</div>
                  <div className="mt-1 text-xs text-white/45">
                    {showTuning
                      ? tuningMode === "rank"
                        ? "Rank only what matters."
                        : "Custom tuning is active."
                      : "Hidden by default."}
                  </div>
                </div>

                <div className="text-xs text-white/35">
                  {showTuning ? (tuningMode === "rank" ? "priority order" : "0–100") : "optional"}
                </div>
              </div>

              {!showTuning ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                  Optional. Outcomes already work great without tuning.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-white/10 bg-black/20 p-1.5">
                    <button
                      type="button"
                      onClick={() => setTuningMode("rank")}
                      className={modeButtonClass(tuningMode === "rank")}
                    >
                      Rank priorities
                    </button>

                    <button
                      type="button"
                      onClick={() => setTuningMode("sliders")}
                      className={modeButtonClass(tuningMode === "sliders")}
                    >
                      Fine tune sliders
                    </button>
                  </div>

                  {tuningMode === "rank" ? (
                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                          Priority ranking
                        </div>

                        <div className="mt-2 text-lg font-semibold text-white/90">
                          What matters most?
                        </div>

                        <div className="mt-2 text-sm leading-6 text-white/55">
                          Click topics in order from most important to least. You can stop whenever you want.
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {availableTopics.map((topic) => (
                            <button
                              key={topic.key}
                              type="button"
                              onClick={() => addTopic(topic.key)}
                              className={topicButtonClass(false)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white/88">
                                    {topic.label}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-white/45">
                                    {topic.description}
                                  </div>
                                </div>

                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/45 group-hover:border-[#c8aa6e]/30 group-hover:text-[#f1dfb8]">
                                  +
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                              Your order
                            </div>

                            <div className="mt-2 text-sm leading-6 text-white/55">
                              Drag topics to reorder. Ranked items receive stronger weight.
                            </div>
                          </div>

                          {priorityRank.length > 0 ? (
                            <button
                              type="button"
                              onClick={clearRank}
                              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/55 transition hover:border-rose-400/25 hover:bg-rose-400/10 hover:text-rose-100"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>

                        {rankedTopics.length === 0 ? (
                          <div className="mt-4 rounded-[22px] border border-dashed border-white/12 bg-black/20 p-5 text-sm leading-6 text-white/45">
                            No priorities ranked yet. Pick only what matters — even one topic is enough.
                          </div>
                        ) : (
                          <div className="mt-4 space-y-2">
                            {rankedTopics.map((topic, index) => (
                              <RankRow
                                key={topic.key}
                                index={index}
                                topic={topic}
                                dragging={draggingTopic === topic.key}
                                onDragStart={() => setDraggingTopic(topic.key)}
                                onDragOver={(e) => {
                                  e.preventDefault();

                                  if (!draggingTopic || draggingTopic === topic.key) return;
                                  reorderTopic(draggingTopic, topic.key);
                                }}
                                onDrop={() => {
                                  setDraggingTopic(null);
                                }}
                                onDragEnd={() => {
                                  setDraggingTopic(null);
                                }}
                                onRemove={() => removeTopic(topic.key)}
                                onMoveUp={() => moveTopic(topic.key, "up")}
                                onMoveDown={() => moveTopic(topic.key, "down")}
                                canMoveUp={index > 0}
                                canMoveDown={index < rankedTopics.length - 1}
                              />
                            ))}
                          </div>
                        )}

                        <div className="mt-4 rounded-[22px] border border-[#c8aa6e]/15 bg-[#c8aa6e]/10 p-4 text-xs leading-5 text-white/52">
                          This ranking is converted into the same scoring weights used by the sliders, so results stay compatible.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <SliderRow
                        label="Cost"
                        value={weights.cost}
                        onChange={(next) => updateWeight("cost", next)}
                      />
                      <SliderRow
                        label="Comfort"
                        value={weights.comfort}
                        onChange={(next) => updateWeight("comfort", next)}
                      />
                      <SliderRow
                        label="Food"
                        value={weights.food}
                        onChange={(next) => updateWeight("food", next)}
                      />
                      <SliderRow
                        label="Culture"
                        value={weights.culture}
                        onChange={(next) => updateWeight("culture", next)}
                      />
                      <SliderRow
                        label="Nightlife"
                        value={weights.nightlife}
                        onChange={(next) => updateWeight("nightlife", next)}
                      />
                      <SliderRow
                        label="Safety"
                        value={weights.safety}
                        onChange={(next) => updateWeight("safety", next)}
                      />
                      <SliderRow
                        label="Shopping"
                        value={weights.shopping}
                        onChange={(next) => updateWeight("shopping", next)}
                      />
                      <SliderRow
                        label="Weather"
                        value={weights.weather}
                        onChange={(next) => updateWeight("weather", next)}
                      />
                      <SliderRow
                        label="Crowds"
                        value={weights.crowds}
                        onChange={(next) => updateWeight("crowds", next)}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <div className="mt-8 sticky bottom-4 z-30">
            <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-white/55">
                  Next: add group context so alignment can account for comfort and logistics.
                </div>

                <Link
                  href="/configure/group"
                  className="ui-btn ui-btn-accent rounded-2xl px-6 py-3 text-center text-sm font-semibold"
                >
                  Continue to group dynamic
                </Link>
              </div>
            </div>
          </div>

          <footer className="mt-10 text-xs text-white/35">
            © {new Date().getFullYear()} Alignment Travel
          </footer>
        </div>
      </div>
    </main>
  );
}