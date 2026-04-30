// app/configure/priorities/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSetup, patchSetup } from "@/lib/clientSetup";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

const SLIDERS = [
  { key: "food", label: "Food" },
  { key: "culture", label: "Culture" }, // kept for your mental model; mapped downstream in ResultsClient
  { key: "nightlife", label: "Nightlife" },
  { key: "comfort", label: "Comfort" },
  { key: "cost", label: "Cost sensitivity" },
  { key: "safety", label: "Safety" },
  { key: "shopping", label: "Shopping" },
  { key: "weather", label: "Weather" },
  { key: "crowds", label: "Low crowds" },
] as const;

export default function ConfigurePrioritiesPage() {
  const router = useRouter();
  const setup = loadSetup();

  const [weights, setWeights] = useState<any>({
    ...setup.weights,
    culture: (setup.weights as any)?.culture ?? 60, // tolerate older setups
  });

  useEffect(() => {
    if (setup.profileId !== "custom") router.replace("/results");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function next() {
    patchSetup({
      weights: {
        ...setup.weights,
        ...weights,
      } as any,
    });
    router.push("/results");
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="shell p-6 md:p-8">
          <div>
            <div className="text-xs font-medium tracking-wide text-emerald-200/80">CONFIGURE</div>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Tune priorities</h1>
            <div className="mt-2 text-sm text-white/60">
              Higher means “matters more.” This is your steering wheel.
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
            <div className="panel p-5">
              <div className="grid gap-4 md:grid-cols-2">
                {SLIDERS.map(({ key, label }) => {
                  const v = clamp(Number(weights[key] ?? 50), 0, 100);
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
                        onChange={(e) => {
                          const next = clamp(parseInt(e.target.value, 10), 0, 100);
                          setWeights((prev: any) => ({ ...prev, [key]: next }));
                        }}
                        className="mt-3 w-full accent-emerald-500"
                      />

                      <div className="mt-2 text-[11px] text-white/50">Higher = matters more</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel p-5">
              <div className="text-sm font-semibold text-white/85">Finish</div>
              <div className="mt-2 text-sm text-white/60">
                This will update scoring immediately on Results.
              </div>

              <button
                type="button"
                onClick={next}
                className="ui-btn mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                See results →
              </button>

              <button
                type="button"
                onClick={() => router.push("/configure/trip")}
                className="ui-btn mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/70 hover:border-white/20 hover:text-white/90"
              >
                Back
              </button>
            </div>
          </div>

          <div className="mt-8 text-xs text-white/35">© {new Date().getFullYear()} Alignment Travel</div>
        </div>
      </div>
    </main>
  );
}