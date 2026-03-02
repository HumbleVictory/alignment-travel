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
    <section className="space-y-3">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={["mt-1 h-10 w-1.5 rounded-full", meta.accentBar].join(" ")} />

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

          <div className="text-xs text-white/55">
            {safeItems.length} cit{safeItems.length === 1 ? "y" : "ies"}
          </div>
        </div>
      </div>

      {safeItems.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-white/80 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur">
          No cities match your filters.{" "}
          <span className="text-white/60">
            Try raising your budget or lowering cost sensitivity.
          </span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur transition hover:-translate-y-[1px] hover:border-white/15 hover:bg-white/[0.05]"
    >
      <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-white/85">
        {Math.round(score)}
      </span>

      <div className="pr-12">
        <div className="text-base font-semibold leading-tight text-white/90">
          {it.city.name}
        </div>
        <div className="mt-1 text-sm text-white/55">{it.city.country}</div>

        <div className="mt-2 text-xs text-white/65">
          Total: <span className="font-semibold text-white/85">{score.toFixed(1)}</span>
          <span className="text-white/35"> · </span>
          <span className="text-white/65">{it.city.region}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {drivers.length > 0
            ? drivers.map((d) => (
                <span
                  key={d.key}
                  className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white/75"
                >
                  <span className="text-emerald-200/90">{d.label}</span> ·{" "}
                  {Number.isFinite(d.points) ? d.points.toFixed(1) : "0.0"} pts
                </span>
              ))
            : highlights.slice(0, 2).map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] text-white/75"
                >
                  <span className="text-emerald-200/90">{h}</span>
                </span>
              ))}
        </div>
      </div>
    </button>
  );
}


