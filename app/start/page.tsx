// app/start/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LS_KEY = "alignmentTravel:onboardingSeen:v1";

function safeHasSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, "1");
  } catch {
    // ignore
  }
}

export default function StartPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"boot" | "show" | "go">("boot");

  useEffect(() => {
    const seen = safeHasSeen();
    if (seen) {
      router.replace("/setup");
      return;
    }

    setPhase("show");
    const t1 = window.setTimeout(() => setPhase("go"), 900);
    const t2 = window.setTimeout(() => {
      markSeen();
      router.replace("/setup");
    }, 1450);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [router]);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="shell p-6 md:p-8">
          <div
            className={[
              "transition-all duration-500",
              phase === "boot" ? "opacity-0 translate-y-2 blur-[2px]" : "opacity-100 translate-y-0 blur-0",
            ].join(" ")}
          >
            <div className="text-xs font-medium tracking-wide text-emerald-200/80">SYSTEM</div>
            <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Initializing evaluation model</h1>

            <p className="mt-3 text-sm text-white/70">
              You define priorities. The system performs a weighted evaluation. Outcomes are ranked by Alignment Score with traceable contributors.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                { a: "Priorities", b: "Weights + constraints" },
                { a: "Evaluation", b: "0–100 driver scores" },
                { a: "Outcomes", b: "Ranked + explainable" },
              ].map((x) => (
                <div key={x.a} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-white/85">{x.a}</div>
                  <div className="mt-2 text-xs text-white/55">{x.b}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={[
                  "h-1.5 rounded-full bg-emerald-400/80 transition-all duration-700",
                  phase === "show" ? "w-2/3" : phase === "go" ? "w-full" : "w-1/4",
                ].join(" ")}
              />
            </div>

            <div className="mt-3 text-xs text-white/45">
              Skips automatically on returning visits.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}