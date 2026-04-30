// app/configure/trip/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSetup, patchSetup } from "@/lib/clientSetup";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function ConfigureTripPage() {
  const router = useRouter();
  const setup = loadSetup();

  const [month, setMonth] = useState(setup.month ?? "January");
  const [days, setDays] = useState<number>(setup.days ?? 5);
  const [budgetUsd, setBudgetUsd] = useState<number>(setup.budgetUsd ?? 2500);

  const nextHref = useMemo(() => {
    // If custom: we go to priorities, else jump to results.
    return setup.profileId === "custom" ? "/configure/priorities" : "/results";
  }, [setup.profileId]);

  function next() {
    patchSetup({
      month,
      days: clamp(days, 1, 60),
      budgetUsd: clamp(budgetUsd, 0, 1_000_000),
    });
    router.push(nextHref);
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="shell p-6 md:p-8">
          <div>
            <div className="text-xs font-medium tracking-wide text-emerald-200/80">CONFIGURE</div>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Set the trip</h1>
            <div className="mt-2 text-sm text-white/60">
              Keep it simple. You can refine later.
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <div className="panel p-5 lg:col-span-2">
              <div className="text-sm font-semibold text-white/85">Inputs</div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

                <div>
                  <div className="text-xs font-medium text-white/55">Trip length (days)</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={days}
                    onChange={(e) => setDays(clamp(parseInt(e.target.value || "5", 10), 1, 60))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="text-xs font-medium text-white/55">Total budget (USD)</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={budgetUsd}
                    onChange={(e) => setBudgetUsd(clamp(parseInt(e.target.value || "0", 10), 0, 1_000_000))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none focus:border-emerald-400/30"
                  />
                  <div className="mt-2 text-[11px] text-white/50">
                    Budget impacts informational “Within/Over/Under” labels (ranking stays deterministic from weights).
                  </div>
                </div>
              </div>
            </div>

            <div className="panel p-5">
              <div className="text-sm font-semibold text-white/85">Next</div>
              <div className="mt-2 text-sm text-white/60">
                {setup.profileId === "custom"
                  ? "Custom selected — next you’ll tune priorities."
                  : "Profile selected — next you’ll see results."}
              </div>

              <button
                type="button"
                onClick={next}
                className="ui-btn mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Continue →
              </button>

              <button
                type="button"
                onClick={() => router.push("/configure/profile")}
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