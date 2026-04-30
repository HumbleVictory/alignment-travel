// app/configure/profile/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILES } from "@/data/profiles";
import { loadSetup, saveSetup, DEFAULT_SETUP } from "@/lib/clientSetup";
import { H1, P } from "@/components/Typography";

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

export default function ConfigureProfilePage() {
  const router = useRouter();

  const initial = useMemo(() => {
    const s = loadSetup();
    return {
      profileId: (s as any).profileId ?? (DEFAULT_SETUP as any).profileId ?? "balanced",
      budgetUsd: nOr((s as any).budgetUsd, nOr((DEFAULT_SETUP as any).budgetUsd, 2500)),
      month: (s as any).month ?? (DEFAULT_SETUP as any).month ?? "January",
      tripDays: clamp(nOr((s as any).tripDays, 6), 1, 60),
    };
  }, []);

  const [selected, setSelected] = useState<string>(initial.profileId);

  const cards = useMemo(
    () =>
      (PROFILES as any[]).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        description: p.description as string,
      })),
    []
  );

  function commitAndContinue() {
    const prev = loadSetup();

    saveSetup({
      ...(prev as any),
      profileId: selected,
      budgetUsd: (prev as any)?.budgetUsd ?? initial.budgetUsd,
      month: (prev as any)?.month ?? initial.month,
      tripDays: (prev as any)?.tripDays ?? initial.tripDays,
    } as any);

    router.push("/configure/setup");
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* extra top padding -> more “premium breathing room” */}
        <div className="shell p-8 md:p-10">
          <header className="flex flex-col gap-4">
            <StepPill step="Step 1/2" label="Choose profile" />
            <div className="max-w-2xl">
              <H1 className="mt-2 text-4xl md:text-6xl">Choose a travel stance.</H1>
              <P className="mt-4">
                Pick one. You can go deeper later — the “why” layers stay optional.
              </P>
            </div>
          </header>

          <section className="mt-8">
            <div className="grid gap-4 md:grid-cols-2">
              {cards.map((c) => {
                const active = selected === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className={[
                      "text-left rounded-3xl border backdrop-blur p-5 transition",
                      "bg-white/[0.04] shadow-[0_18px_60px_rgba(0,0,0,0.28)]",
                      active
                        ? "border-emerald-400/30 ring-2 ring-emerald-400/20"
                        : "border-white/10 hover:border-white/15 hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-white/90">{c.name}</div>
                        <div className="mt-1 text-sm text-white/65">{c.description}</div>
                      </div>

                      <span
                        className={[
                          "shrink-0 rounded-full px-3 py-1 text-xs font-semibold border",
                          active
                            ? "bg-emerald-400/15 text-emerald-100 border-emerald-400/20"
                            : "bg-white/10 text-white/70 border-white/10",
                        ].join(" ")}
                      >
                        {active ? "Selected" : "Pick"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* “Configurator” style sticky action bar */}
            <div className="mt-8 sticky bottom-4 z-30">
              <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-white/55">
                    Next: set budget + trip length.
                  </div>

                  <button
                    type="button"
                    onClick={commitAndContinue}
                    className="ui-btn ui-btn-accent rounded-2xl px-6 py-3 text-sm font-semibold"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-10 text-xs text-white/35">© {new Date().getFullYear()} Alignment Travel</footer>
        </div>
      </div>
    </main>
  );
}