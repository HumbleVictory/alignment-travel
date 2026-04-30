// app/page.tsx
"use client";

import Link from "next/link";
import { H1, P } from "@/components/Typography";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="shell p-10 md:p-12">
          <div className="max-w-2xl">
            <div className="text-xs font-medium tracking-wide text-emerald-200/80">Decision intelligence</div>

            <H1 className="mt-3 text-4xl md:text-6xl">Rank destinations by what you care about.</H1>

            <P className="mt-5">
              Choose a profile, set budget + trip length, and get outcomes — then open layers when you want the “why.”
            </P>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/configure/profile" className="ui-btn ui-btn-accent rounded-2xl px-6 py-3 text-sm font-semibold">
                Start
              </Link>

              <Link
                href="/methodology"
                className="ui-btn rounded-2xl border border-white/10 bg-black/20 px-6 py-3 text-sm font-semibold text-white/75 hover:border-white/20 hover:text-white/90"
              >
                Methodology
              </Link>
            </div>

            <div className="mt-6 text-[11px] text-white/45">Transparent scoring. Optional depth.</div>
          </div>
        </div>
      </div>
    </main>
  );
}