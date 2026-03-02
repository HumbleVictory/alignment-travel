// app/methodology/page.tsx
"use client";

import Link from "next/link";
import { H1, H2, P } from "@/components/Typography";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <H2 className="headline-fix">{title}</H2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="shell p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-medium tracking-wide text-emerald-200/80">
                METHODOLOGY
              </div>
              <H1 className="mt-3 headline-fix">
                How Alignment Score Works
              </H1>
              <P className="mt-4">
                Every city’s score is the sum of transparent contribution points:
                <span className="font-semibold text-white/85">
                  {" "}
                  weight% × component score → points
                </span>
                . No hidden boosts.
              </P>
            </div>

            <Link
              href="/"
              className="ui-btn rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/20 hover:bg-black/25"
            >
              Home
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card title="1) Inputs">
              <P>
                You pick a profile (or Custom), month, and total budget. The
                system calculates a budget status per city (under / within /
                over) and shows the delta — informational only.
              </P>
            </Card>

            <Card title="2) Driver components">
              <P>
                Each city has 0–100 component scores for drivers like Flights,
                Hotels, Dining value, Culinary density, Shopping, Safety &
                transit.
              </P>
            </Card>

            <Card title="3) Weights → contributions">
              <P>
                Your profile provides weights across the same drivers. We
                normalize weights internally so you don’t manage totals.
              </P>
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                Example: <span className="font-semibold text-white/85">17%</span>{" "}
                Flights × <span className="font-semibold text-white/85">74</span>{" "}
                → <span className="font-semibold text-emerald-200">12.6</span>{" "}
                points
              </div>
            </Card>

            <Card title="4) Sum to total">
              <P>
                Total Alignment Score is the sum of all driver contribution
                points. The Compare drawer shows the breakdown and lets you do
                local “what-if” weight tweaks.
              </P>
            </Card>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/results?demo=1"
              className="ui-btn inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              View example results
            </Link>
            <Link
              href="/setup"
              className="ui-btn inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white/80 hover:border-white/20 hover:bg-black/25"
            >
              Start optimization
            </Link>
          </div>

          <footer className="mt-8 text-xs text-white/35">
            © {new Date().getFullYear()} Alignment Travel
          </footer>
        </div>
      </div>
    </main>
  );
}