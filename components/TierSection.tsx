// components/TierSection.tsx
import { ScoredCity } from "@/lib/scoring";

function safeStrList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export function TierSection({
  tier,
  items,
  onSelect,
}: {
  tier: "S" | "A" | "B" | "C" | "D";
  items: ScoredCity[];
  onSelect: (item: ScoredCity) => void;
}) {
  const tierMeta: Record<
    "S" | "A" | "B" | "C" | "D",
    {
      accentBar: string;
      chipBg: string;
      chipText: string;
      ring: string;
      title: string;
    }
  > = {
    S: {
      accentBar: "bg-white/80",
      chipBg: "bg-white/10",
      chipText: "text-white/90",
      ring: "ring-white/15",
      title: "Best-in-class",
    },
    A: {
      accentBar: "bg-emerald-400/90",
      chipBg: "bg-emerald-400/10",
      chipText: "text-emerald-100",
      ring: "ring-emerald-400/20",
      title: "Excellent",
    },
    B: {
      accentBar: "bg-sky-400/90",
      chipBg: "bg-sky-400/10",
      chipText: "text-sky-100",
      ring: "ring-sky-400/20",
      title: "Strong",
    },
    C: {
      accentBar: "bg-amber-300/90",
      chipBg: "bg-amber-300/10",
      chipText: "text-amber-100",
      ring: "ring-amber-300/20",
      title: "Okay",
    },
    D: {
      accentBar: "bg-rose-400/90",
      chipBg: "bg-rose-400/10",
      chipText: "text-rose-100",
      ring: "ring-rose-400/20",
      title: "Weak value",
    },
  };

  const meta = tierMeta[tier];
  const safeItems = items ?? [];

  return (
    <section className="space-y-4">
      {/* Header (panel style like v1) */}
      <div className="panel p-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={["mt-1 h-9 w-1.5 rounded-full", meta.accentBar].join(" ")} />

            <div>
              <div className="text-xs font-semibold tracking-widest">
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider ring-1",
                    meta.chipBg,
                    meta.chipText,
                    meta.ring,
                  ].join(" ")}
                >
                  TIER {tier}
                </span>
              </div>

              <div className="mt-2 text-lg font-semibold text-white/90">
                {tier} picks{" "}
                <span className="text-sm font-normal text-white/55">· {meta.title}</span>
              </div>
            </div>
          </div>

          <div className="text-xs font-semibold text-white/45">
            {safeItems.length} cit{safeItems.length === 1 ? "y" : "ies"}
          </div>
        </div>
      </div>

      {safeItems.length === 0 ? (
        <div className="panel p-5 text-sm text-white/70">
          No cities match your filters.{" "}
          <span className="text-white/55">Try raising your budget or lowering cost sensitivity.</span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {safeItems.map((it) => (
            <CityCard key={it.city.id} it={it} onClick={() => onSelect(it)} />
          ))}
        </div>
      )}
    </section>
  );
}

function CityCard({ it, onClick }: { it: ScoredCity; onClick: () => void }) {
  const drivers = (it?.topDrivers ?? []).slice(0, 2);
  const highlights = safeStrList(it?.highlights);

  const title =
    drivers.length > 0
      ? drivers
          .map((d) => {
            const w = Number.isFinite(d?.weight) ? Math.round(d.weight * 100) : 0;
            const pts = Number.isFinite(d?.points) ? d.points.toFixed(1) : "0.0";
            const sc = Number.isFinite(d?.score) ? d.score : 0;
            return `${d.label}: ${pts} pts (weight ${w}%, score ${sc}/100)`;
          })
          .join(" · ")
      : highlights.join(" · ");

  const score = Number.isFinite(it?.totalScore) ? it.totalScore : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || "City details"}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur shadow-[0_18px_60px_rgba(0,0,0,0.28)] transition hover:-translate-y-[1px] hover:border-white/15 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white/90">{it.city.name}</div>
          <div className="truncate text-sm text-white/65">{it.city.country}</div>
        </div>

        <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/85">
          {Math.round(score)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {drivers.length > 0
          ? drivers.map((d) => (
              <span
                key={d.key}
                className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/75"
              >
                <span className="text-emerald-200/90">{d.label}</span>
              </span>
            ))
          : highlights.slice(0, 2).map((h) => (
              <span
                key={h}
                className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/75"
              >
                {h}
              </span>
            ))}
      </div>
    </button>
  );
}