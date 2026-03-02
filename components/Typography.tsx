// components/Typography.tsx
import * as React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function H1({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h1
      className={cx(
        "headline-fix font-semibold text-white text-4xl md:text-6xl",
        className
      )}
    >
      {children}
    </h1>
  );
}

export function H2({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cx(
        "subhead-fix font-semibold text-white/90 text-xl md:text-2xl",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function P({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cx("text-white/70 text-sm md:text-base", className)}>
      {children}
    </p>
  );
}