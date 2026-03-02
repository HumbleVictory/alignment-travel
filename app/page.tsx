// app/page.tsx
"use client";

import Link from "next/link";
import { H1, P } from "@/components/Typography";

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="ui-btn inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
    >
      {children}
    </Link>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="ui-btn inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white/80 hover:border-white/20 hover:bg-black/25"
    >
      {children}
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="shell p-6 md:p-8">
          {/* hero */}
          <div className="max-w-3xl">
            <H1>Destination ranking that feels auditable.</H1>
            <P className="mt-4">
              Rank cities by what matters to you — with transparent scoring.
            </P>

            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryLink href="/setup">Start optimization</PrimaryLink>
              <GhostLink href="/results?demo=1">View example results</GhostLink>
              <GhostLink href="/methodology">Read methodology</GhostLink>
            </div>
          </div>

          {/* divider */}
          <div className="mt-8 h-px w-full bg-white/10" />

          {/* steps */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "1) Set constraints",
                body: "Budget, month, and context. The system shows budget impact explicitly.",
              },
              {
                title: "2) Weight priorities",
                body: "Independent sliders. We normalize internally; you don’t manage totals.",
              },
              {
                title: "3) Audit results",
                body: "Every city is explainable via additive contribution points.",
              },
            ].map((c) => (
              <div key={c.title} className="panel p-5">
                <div className="text-sm font-semibold text-white/90">{c.title}</div>
                <div className="mt-2 text-sm text-white/70">{c.body}</div>
              </div>
            ))}
          </div>

          {/* philosophy preview panel */}
          <div className="panel mt-5 p-5">
            <div className="text-sm font-semibold text-white/90">Philosophy</div>
            <div className="mt-2 text-sm text-white/70">
              A transparent framework for aligning travel decisions with personal priorities. Rankings are never manipulated; your
              weights drive the math.
            </div>
            <div className="mt-4">
              <Link
                href="/philosophy"
                className="ui-btn inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/20 hover:bg-black/25"
              >
                Open Philosophy <span className="text-white/50">→</span>
              </Link>
            </div>
          </div>

          <footer className="mt-8 text-xs text-white/35">© {new Date().getFullYear()} Alignment Travel</footer>
        </div>
      </div>
    </main>
  );
}