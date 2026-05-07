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

  useEffect(() => {
    const s = loadSetup();

    const loadedBudget = clamp(nOr(s.budgetUsd, DEFAULT_SETUP.budgetUsd), 0, 1_000_000);
    const loadedTripDays = clamp(
      nOr((s as any).tripDays ?? (s as any).days, DEFAULT_SETUP.days),
      1,
      60
    );

    setProfileId(s.profileId);
    setBudgetUsd(loadedBudget);
    setBudgetUsdInput(String(loadedBudget));
    setMonth(typeof s.month === "string" ? s.month : DEFAULT_SETUP.month);
    setTripDays(loadedTripDays);
    setTripDaysInput(String(loadedTripDays));
    setWeights(s.weights ?? DEFAULT_SETUP.weights);

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    // Preserve newer setup sections like groupDynamic while editing Step 2
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

  function updateWeight<K extends keyof SetupWeights>(key: K, next: number) {
    setProfileId("custom");
    setWeights((prev) => ({
      ...prev,
      [key]: clamp(next, 0, 100),
    }));
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
                    {showTuning ? "Custom tuning is active." : "Hidden by default."}
                  </div>
                </div>

                <div className="text-xs text-white/35">0–100</div>
              </div>

              {!showTuning ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                  Optional. Outcomes already work great without tuning.
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
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