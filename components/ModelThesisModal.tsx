// components/ModelThesisModal.tsx
"use client";

import { useEffect } from "react";

export function ModelThesisModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 backdrop-blur-sm sm:items-center dark:bg-black/55 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white/85 p-5 shadow-xl backdrop-blur animate-in zoom-in-95 slide-in-from-bottom-2 sm:slide-in-from-bottom-0 duration-150 dark:border-neutral-800 dark:bg-neutral-950/55"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-emerald-700 dark:text-emerald-400">
              MODEL THESIS
            </div>
            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              A transparent framework for aligning travel decisions with personal priorities
            </div>
            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              This prototype is a decision framework — not a promise of “best city.”
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200 dark:hover:bg-neutral-900/50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-neutral-800 dark:text-neutral-200">
          <Section title="What the score means">
            <ul className="list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
              <li>
                The <span className="font-semibold text-neutral-900 dark:text-neutral-100">alignment score</span> is a
                weighted blend of normalized components (0–100 each).
              </li>
              <li>
                It reflects <span className="font-semibold text-neutral-900 dark:text-neutral-100">fit</span> for your
                stated priorities — not universal truth.
              </li>
            </ul>
          </Section>

          <Section title="Core formula">
            <div className="rounded-xl border border-neutral-200 bg-white p-3 font-mono text-[12px] text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-200">
              total = Σ ( weight_share[k] × component_score[k] )
            </div>
            <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
              We normalize your raw sliders into shares that sum to 1. Components are scored 0–100.
            </div>
          </Section>

          <Section title="Principles">
            <ul className="list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
              <li>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Transparency over magic</span>: no
                hidden boosts.
              </li>
              <li>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Tradeoffs, not winners</span>:
                rankings reflect your weights.
              </li>
              <li>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">No false precision</span>:
                prototype data is curated, not live.
              </li>
            </ul>
          </Section>

          <Section title="Known limitations (prototype)">
            <ul className="list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
              <li>Data is curated estimates (not real-time flights/hotels yet).</li>
              <li>Some dimensions may be correlated (e.g., safety & transit with development).</li>
              <li>Scores are best used to compare tradeoffs, not as absolute truth.</li>
            </ul>
          </Section>

          <Section title="Next integrity upgrades">
            <ul className="list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
              <li>Rename cost-only metrics for clarity (affordability vs “value”).</li>
              <li>Correlation warnings when weights double-count similar signals.</li>
              <li>Better data coverage + validation loop (post-trip feedback).</li>
            </ul>
          </Section>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white/70 p-4 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/25 dark:text-neutral-300">
          You can also keep a longer written version in <span className="font-mono">/docs/MODEL_THESIS.md</span>.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}


