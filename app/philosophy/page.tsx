// app/philosophy/page.tsx
import Link from "next/link";
import { TopTabs } from "@/components/TopTabs";
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
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-2 text-sm text-white/70">{children}</div>
    </section>
  );
}

export default function PhilosophyPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_55%),linear-gradient(to_bottom,#05070a,#070b12,#05070a)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="shell p-6 md:p-8">
          <TopTabs />

          <div className="mt-6 max-w-3xl">
            <H1 className="headline-fix">Philosophy</H1>
            <P className="mt-4">
              Alignment Travel is built on one rule: if you can’t explain the ranking,
              you don’t deserve to trust it.
            </P>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card title="Transparency over vibes">
              Every score is an additive sum of visible components. No “black box” boosts.
            </Card>

            <Card title="Weights are the product">
              You’re not choosing a destination — you’re choosing what matters. The system
              simply executes that preference.
            </Card>

            <Card title="Auditable tradeoffs">
              If a city wins, you can see exactly why (and what would need to change for it to lose).
            </Card>
          </div>

          <div className="mt-6 panel p-5">
            <H2 className="subhead-fix">The promise</H2>
            <P className="mt-2">
              Rankings are never manipulated. If you change priorities, the math changes — and
              the result changes — in a way you can verify.
            </P>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="ui-btn ui-btn-accent rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Start optimization
              </Link>

              <Link
                href="/methodology"
                className="ui-btn rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/20 hover:bg-black/25"
              >
                Read methodology
              </Link>
            </div>
          </div>

          <footer className="mt-8 text-xs text-white/35">
            © {new Date().getFullYear()} Alignment Travel
          </footer>
        </div>
      </div>
    </main>
  );
}