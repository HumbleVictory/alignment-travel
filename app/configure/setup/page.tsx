// app/configure/setup/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PROFILES } from "@/data/profiles";
import { DEFAULT_SETUP, loadSetup, saveSetup } from "@/lib/clientSetup";
import { H1, P } from "@/components/Typography";

type SetupWeights = {
  food: number;
  culture: number;
  nightlife: number;
  comfort: number;
  cost: number;
  safety: number;
  shopping: number;
  weather: number;
  crowds: number;
};

const MONTHS = [
  "January","February","March","April","May","June","July","August","September","October","November","December",
];

function clamp(n: number, lo: number, hi: number) {
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

export default function ConfigureSetupPage() {
  const [hydrated, setHydrated] = useState(false);

  const [profileId, setProfileId] = useState<string>((DEFAULT_SETUP as any).profileId ?? "balanced");
  const [month, setMonth] = useState<string>((DEFAULT_SETUP as any).month ?? "January");
  const [budgetUsd, setBudgetUsd] = useState<number>(nOr((DEFAULT_SETUP as any).budgetUsd, 2500));
  const [tripDays, setTripDays] = useState<number>(clamp(nOr((DEFAULT_SETUP as any).tripDays, 6), 1, 60));

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [weights, setWeights] = useState<SetupWeights>({
    food: 60,
    culture: 60,
    nightlife: 40,
    comfort: 55,
    cost: 50,
    safety: 50,
    shopping: 50,
    weather: 50,
    crowds: 50,
  });

  useEffect(() => {
    const s = loadSetup();

    setProfileId((s as any).profileId ?? (DEFAULT_SETUP as any).profileId ?? "balanced");
    setMonth((s as any).month ?? (DEFAULT_SETUP as any).month ?? "January");
    setBudgetUsd(nOr((s as any).budgetUsd, nOr((DEFAULT_SETUP as any).budgetUsd, 2500)));
    setTripDays(clamp(nOr((s as any).tripDays, 6), 1, 60));

    const w = (s as any).weights ?? {};
    setWeights({
      food: clamp(nOr(w.food, 60), 0, 100),
      culture: clamp(nOr(w.culture, 60), 0, 100),
      nightlife: clamp(nOr(w.nightlife, 40), 0, 100),
      comfort: clamp(nOr(w.comfort, 55), 0, 100),
      cost: clamp(nOr(w.cost, 50), 0, 100),
      safety: clamp(nOr(w.safety, 50), 0, 100),
      shopping: clamp(nOr(w.shopping, 50), 0, 100),
      weather: clamp(nOr(w.weather, 50), 0, 100),
      crowds: clamp(nOr(w.crowds, 50), 0, 100),
    });

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSetup({
      profileId,
      month,
      budgetUsd,
      tripDays,
      weights,
    } as any);
  }, [hydrated, profileId, month, budgetUsd, tripDays, weights]);

  const profile = useMemo(() => {
    return ((((PROFILES as any[]).find((p) => p?.id === profileId) ?? (PROFILES as any[])[0]) as any) ?? null);
  }, [profileId]);

  const isCustom = profileId === "custom";

  // keep mapping behavior for non-custom
  useEffect(() => {
    if (!hydrated) return;
    if (isCustom) return;

    const wp = (profile as any)?.weightsPct;
    if (!wp) return;

    const cost = clamp(
      Math.round(0.45 * nOr(wp.flight, 50) + 0.35 * nOr(wp.hotel, 50) + 0.2 * nOr(wp.diningValue, 50)),
      0,
      100
    );
    const food = clamp(Math.round(0.55 * nOr(wp.diningValue, 50) + 0.45 * nOr(wp.culinaryDensity, 50)), 0, 100);
    const culture = clamp(Math.round(0.65 * nOr(wp.culinaryDensity, 50) + 0.35 * nOr(wp.safetyTransit, 50)), 0, 100);
    const comfort = clamp(Math.round(0.6 * nOr(wp.hotel, 50) + 0.4 * nOr(wp.safetyTransit, 50)), 0, 100);
    const nightlife = clamp(Math.round(0.7 * nOr(wp.diningValue, 50) + 0.3 * nOr(wp.shopping, 50)), 0, 100);

    const safety = clamp(Math.round(nOr(wp.safetyTransit, 50)), 0, 100);
    const shopping = clamp(Math.round(nOr(wp.shopping, 50)), 0, 100);
    const weather = clamp(Math.round(nOr(wp.weather, 50)), 0, 100);
    const crowds = clamp(Math.round(nOr(wp.crowds, 50)), 0, 100);

    setWeights({ food, culture, nightlife, comfort, cost, safety, shopping, weather, crowds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isCustom, profileId]);

  if (!hydrated) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* more top breathing room (fix for screenshot #1) */}
        <div className="shell p-8 md:p-10">
          <header className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <StepPill step="Step 2/2" label="Trip basics" />
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

          <div className="mt-8 grid gap-5 lg:grid-cols-[420px_1fr]">
            {/* Essentials (single-action feel) */}
            <section className="panel p-5">
              <div className="text-sm font-semibold text-white/85">Essentials</div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-medium text-white/55">Profile</div>
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  >
                    {(PROFILES as any[]).map((p) => (
                      <option key={p.id} value={p.id} className="text-black">
                        {p.name}
                      </option>
                    ))}
                    {!((PROFILES as any[]).some((p) => p?.id === "custom")) ? (
                      <option value="custom" className="text-black">
                        Custom
                      </option>
                    ) : null}
                  </select>
                  <div className="mt-2 text-[11px] text-white/55">{profile?.description ?? ""}</div>
                </div>

                <div>
                  <div className="text-xs font-medium text-white/55">Total budget (USD)</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={budgetUsd}
                    onChange={(e) => setBudgetUsd(clamp(parseInt(e.target.value || "0", 10), 0, 1_000_000))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none placeholder:text-white/40 focus:border-emerald-400/30"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-white/55">Trip length (days)</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={tripDays}
                    onChange={(e) => setTripDays(clamp(parseInt(e.target.value || "1", 10), 1, 60))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none placeholder:text-white/40 focus:border-emerald-400/30"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-white/55">Month</div>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m} className="text-black">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="ui-btn inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/75 hover:border-white/20 hover:text-white/90"
                >
                  {showAdvanced ? "Hide tuning" : "Tuning (optional)"}
                </button>

                <div className="text-[11px] text-white/45">Keep it simple. Only tune if you want to.</div>
              </div>
            </section>

            {/* Tuning (optional) */}
            <section className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white/85">Tuning</div>
                  <div className="mt-1 text-xs text-white/60">
                    {showAdvanced ? (
                      isCustom ? (
                        <>Live edits.</>
                      ) : (
                        <>
                          Locked by profile. Switch to <span className="font-semibold text-white/80">Custom</span> to edit.
                        </>
                      )
                    ) : (
                      <>Hidden by default.</>
                    )}
                  </div>
                </div>
                <div className="text-xs text-white/45">0–100</div>
              </div>

              {!showAdvanced ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
                  Optional. Outcomes already work great without tuning.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {(
                    [
                      { key: "food", label: "Food" },
                      { key: "culture", label: "Culture" },
                      { key: "nightlife", label: "Nightlife" },
                      { key: "comfort", label: "Comfort" },
                      { key: "cost", label: "Cost sensitivity" },
                      { key: "safety", label: "Safety" },
                      { key: "shopping", label: "Shopping" },
                      { key: "weather", label: "Weather" },
                      { key: "crowds", label: "Low crowds" },
                    ] as const
                  ).map(({ key, label }) => {
                    const v = weights[key];

                    return (
                      <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-white/85">{label}</div>
                          <div className="text-sm font-semibold text-white/80">{v}</div>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={v}
                          disabled={!isCustom}
                          onChange={(e) => {
                            const next = clamp(parseInt(e.target.value, 10), 0, 100);
                            setWeights((prev) => ({ ...prev, [key]: next }));
                          }}
                          className={[
                            "mt-3 w-full",
                            isCustom ? "accent-emerald-500" : "opacity-60 cursor-not-allowed",
                          ].join(" ")}
                        />

                        <div className="mt-2 text-[11px] text-white/50">
                          {isCustom ? "Higher = matters more" : "Locked by profile"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Maserati-style sticky “Next” bar */}
          <div className="mt-8 sticky bottom-4 z-30">
            <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-white/55">Next: view outcomes and open layers only if you want depth.</div>

                <Link
                  href="/results"
                  className="ui-btn ui-btn-accent rounded-2xl px-6 py-3 text-sm font-semibold text-center"
                >
                  View outcomes
                </Link>
              </div>
            </div>
          </div>

          <footer className="mt-10 text-xs text-white/35">© {new Date().getFullYear()} Alignment Travel</footer>
        </div>
      </div>
    </main>
  );
}