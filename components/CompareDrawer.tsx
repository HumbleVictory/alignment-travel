// components/CompareDrawer.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { ScoredCity } from "@/lib/scoring";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

function useMounted() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

function useIsDesktop(breakpoint = 1180) {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);

    const update = () => setIsDesktop(mq.matches);
    update();

    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [breakpoint]);

  return isDesktop;
}

function nOr(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function scoreOf(c: ScoredCity) {
  return Math.round(nOr((c as any)?.totalScore, nOr((c as any)?.score, 0)));
}

function tierOf(c: ScoredCity) {
  const tier = (c as any)?.tier;
  return typeof tier === "string" && tier.length ? tier : "C";
}

function cityName(c: ScoredCity) {
  const name = (c as any)?.city?.name;
  return typeof name === "string" && name.length ? name : "City";
}

function countryName(c: ScoredCity) {
  const country = (c as any)?.city?.country;
  return typeof country === "string" ? country : "";
}

function cityId(c: ScoredCity) {
  const id = (c as any)?.city?.id;
  return typeof id === "string" && id.length ? id : cityName(c);
}

function fmtUsd(n: unknown) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  const abs = Math.round(Math.abs(n)).toLocaleString();
  return `${n < 0 ? "-" : "+"}$${abs}`;
}

function budgetBadge(c: ScoredCity) {
  const status = String((c as any)?.budgetStatus ?? "unknown");
  const delta = (c as any)?.budgetDeltaUsd;

  if (status === "under") {
    return {
      label: "Under",
      value: fmtUsd(delta),
      tone: "green" as const,
    };
  }

  if (status === "over") {
    return {
      label: "Over",
      value: fmtUsd(delta),
      tone: "red" as const,
    };
  }

  if (status === "within") {
    return {
      label: "Within",
      value: "",
      tone: "neutral" as const,
    };
  }

  return {
    label: "Budget",
    value: "",
    tone: "neutral" as const,
  };
}

export function CompareDrawer({
  pinned,
  isOpen,
  onClose,
  onClear,
  onSwap: _onSwap,
  onSelect,
}: {
  pinned: ScoredCity[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  onSwap: () => void;
  onSelect: (c: ScoredCity) => void;
  variant?: "center" | "right";
}) {
  const mounted = useMounted();
  const isDesktop = useIsDesktop(1180);
  const reducedMotion = useReducedMotion();

  const [dismissed, setDismissed] = React.useState(true);

  const count = Array.isArray(pinned) ? pinned.length : 0;
  const first = pinned[0] ?? null;
  const second = pinned[1] ?? null;

  const pinnedKey = React.useMemo(() => {
    return pinned.map((c) => cityId(c)).join("|");
  }, [pinned]);

  /**
   * Important:
   * This makes the panel open automatically when the second city is pinned,
   * even if the parent page does not correctly flip isOpen to true.
   */
  React.useEffect(() => {
    if (count >= 2) {
      setDismissed(false);
    }

    if (count === 0) {
      setDismissed(true);
    }
  }, [count, pinnedKey]);

  const visible = count > 0 && (isOpen || !dismissed);

  const diff = first && second ? scoreOf(first) - scoreOf(second) : 0;

  const leaderText =
    first && second
      ? diff === 0
        ? "Even match"
        : diff > 0
        ? `${cityName(first)} leads`
        : `${cityName(second)} leads`
      : first
      ? `${cityName(first)} locked`
      : "No cities pinned";

  const handleClose = React.useCallback(() => {
    setDismissed(true);
    onClose();
  }, [onClose]);

  const handleClear = React.useCallback(() => {
    setDismissed(true);
    onClear();
    onClose();
  }, [onClear, onClose]);

  React.useEffect(() => {
    if (!visible) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        isDesktop ? (
          <DesktopComparePanel
            count={count}
            first={first}
            second={second}
            leaderText={leaderText}
            diff={diff}
            reducedMotion={reducedMotion}
            onClose={handleClose}
            onClear={handleClear}
            onSelect={onSelect}
          />
        ) : (
          <MobileComparePanel
            count={count}
            first={first}
            second={second}
            leaderText={leaderText}
            reducedMotion={reducedMotion}
            onClose={handleClose}
            onClear={handleClear}
            onSelect={onSelect}
          />
        )
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function DesktopComparePanel({
  count,
  first,
  second,
  leaderText,
  diff,
  reducedMotion,
  onClose,
  onClear,
  onSelect,
}: {
  count: number;
  first: ScoredCity | null;
  second: ScoredCity | null;
  leaderText: string;
  diff: number;
  reducedMotion: boolean | null;
  onClose: () => void;
  onClear: () => void;
  onSelect: (c: ScoredCity) => void;
}) {
  return (
    <motion.aside
      role="complementary"
      aria-label="Pinned city comparison"
      className={cn(
        "pointer-events-auto fixed top-[96px] bottom-6 w-[356px] overflow-hidden rounded-[28px]",
        "border border-white/10 bg-[#06080c]",
        "shadow-[0_30px_90px_rgba(0,0,0,0.84)]",
        "ring-1 ring-white/[0.06]"
      )}
      style={{
        zIndex: 2147483000,
        right: "max(24px, calc((100vw - 1152px) / 2 + 24px))",
      }}
      initial={reducedMotion ? false : { x: 32, opacity: 0 }}
      animate={reducedMotion ? undefined : { x: 0, opacity: 1 }}
      exit={reducedMotion ? undefined : { x: 32, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.2),rgba(200,170,110,0.5),transparent)]" />

      <div className="flex h-full flex-col">
        <header className="border-b border-white/[0.08] bg-[#070a0f] px-5 py-5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c8aa6e] shadow-[0_0_14px_rgba(200,170,110,0.5)]" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/42">
              Compare
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-[32px] font-semibold leading-none tracking-[-0.06em] text-white">
                {count}/2
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">
                pinned
              </div>
            </div>

            <div className="max-w-[170px] rounded-full border border-white/10 bg-[#10151c] px-3 py-1.5 text-right text-[11px] font-semibold text-white/62">
              {leaderText}
            </div>
          </div>

          {first && second ? (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0b1017] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/32">
                Spread
              </div>
              <div className="mt-1 text-sm font-semibold text-white/76">
                {Math.abs(diff)} alignment points
              </div>
            </div>
          ) : null}
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {first ? (
            <PinnedSlot city={first} slot={1} onOpen={() => onSelect(first)} />
          ) : (
            <EmptySlot slot={1} />
          )}

          {second ? (
            <PinnedSlot city={second} slot={2} onOpen={() => onSelect(second)} />
          ) : (
            <EmptySlot slot={2} />
          )}
        </div>

        <footer className="border-t border-white/[0.08] bg-[#05070a] px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <PanelButton onClick={onClear} disabled={count === 0}>
              Clear
            </PanelButton>

            <PanelButton onClick={onClose}>Close</PanelButton>
          </div>
        </footer>
      </div>
    </motion.aside>
  );
}

function MobileComparePanel({
  count,
  first,
  second,
  leaderText,
  reducedMotion,
  onClose,
  onClear,
  onSelect,
}: {
  count: number;
  first: ScoredCity | null;
  second: ScoredCity | null;
  leaderText: string;
  reducedMotion: boolean | null;
  onClose: () => void;
  onClear: () => void;
  onSelect: (c: ScoredCity) => void;
}) {
  return (
    <motion.aside
      role="complementary"
      aria-label="Pinned city comparison"
      className={cn(
        "pointer-events-auto fixed inset-x-3 bottom-3 overflow-hidden rounded-[24px]",
        "border border-white/10 bg-[#06080c]",
        "shadow-[0_24px_70px_rgba(0,0,0,0.82)] ring-1 ring-white/[0.06]"
      )}
      style={{ zIndex: 2147483000 }}
      initial={reducedMotion ? false : { y: 24, opacity: 0 }}
      animate={reducedMotion ? undefined : { y: 0, opacity: 1 }}
      exit={reducedMotion ? undefined : { y: 24, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.2),rgba(200,170,110,0.5),transparent)]" />

      <header className="border-b border-white/[0.08] bg-[#070a0f] px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/42">
          Compare
        </div>
        <div className="mt-2 text-xl font-semibold tracking-[-0.05em] text-white">
          {count}/2 pinned
        </div>
        <div className="mt-2 text-sm text-white/54">{leaderText}</div>
      </header>

      <div className="space-y-3 px-4 py-4">
        {first ? (
          <PinnedSlot city={first} slot={1} onOpen={() => onSelect(first)} compact />
        ) : (
          <EmptySlot slot={1} compact />
        )}

        {second ? (
          <PinnedSlot city={second} slot={2} onOpen={() => onSelect(second)} compact />
        ) : (
          <EmptySlot slot={2} compact />
        )}
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-white/[0.08] bg-[#05070a] px-4 py-4">
        <PanelButton onClick={onClear} disabled={count === 0}>
          Clear
        </PanelButton>
        <PanelButton onClick={onClose}>Close</PanelButton>
      </footer>
    </motion.aside>
  );
}

function PinnedSlot({
  city,
  slot,
  onOpen,
  compact = false,
}: {
  city: ScoredCity;
  slot: 1 | 2;
  onOpen: () => void;
  compact?: boolean;
}) {
  const budget = budgetBadge(city);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "group relative w-full overflow-hidden rounded-[22px] border text-left transition duration-150",
        "border-white/10 bg-[#0d1219]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        "hover:border-white/18 hover:bg-[#111821]",
        "active:scale-[0.995]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        compact ? "p-4" : "p-5"
      )}
      title={`Open ${cityName(city)} details`}
    >
      <div
        className={cn(
          "absolute inset-y-4 left-0 w-[3px] rounded-r-full",
          slot === 1 ? "bg-[#c8aa6e]" : "bg-[#8f9fb0]"
        )}
      />

      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.14),transparent)]" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">
            Slot {slot}
          </div>

          <div className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.06em] text-white">
            {scoreOf(city)}
          </div>

          <div className="mt-4 truncate text-lg font-semibold tracking-[-0.02em] text-white">
            {cityName(city)}
          </div>

          <div className="mt-1 truncate text-sm text-white/52">{countryName(city)}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Alignment
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone={budget.tone}>{budget.label}</Badge>
        {budget.value ? <Badge tone={budget.tone}>{budget.value}</Badge> : null}
        <Badge>Tier {tierOf(city)}</Badge>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <span className="text-xs font-semibold text-white/42 transition group-hover:text-white/85">
          Open →
        </span>
      </div>
    </button>
  );
}

function EmptySlot({
  slot,
  compact = false,
}: {
  slot: 1 | 2;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[22px] border border-dashed border-white/10 bg-[#0a0e13] text-left",
        compact ? "p-4" : "p-5"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,rgba(255,255,255,0.08),transparent)]" />

      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28">
        Slot {slot}
      </div>

      <div className="mt-3 text-base font-semibold text-white/70">
        {slot === 1 ? "Ready to pin" : "Awaiting second city"}
      </div>

      <div className="mt-2 text-sm leading-6 text-white/42">
        {slot === 1
          ? "Choose a city from the board."
          : "Pin another city to complete the compare panel."}
      </div>
    </div>
  );
}

function PanelButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!disabled) {
          onClick();
        }
      }}
      className={cn(
        "h-11 rounded-[16px] border text-sm font-semibold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        disabled
          ? "cursor-not-allowed border-white/[0.06] bg-[#0a0d11] text-white/22"
          : "border-white/10 bg-[#11161d] text-white/78 hover:border-white/16 hover:bg-[#171e27] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        tone === "green"
          ? "border-emerald-400/18 bg-emerald-400/10 text-emerald-100"
          : tone === "red"
          ? "border-rose-400/18 bg-rose-400/10 text-rose-100"
          : "border-white/10 bg-white/[0.04] text-white/62"
      )}
    >
      {children}
    </span>
  );
}