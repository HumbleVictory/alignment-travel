// components/SmoothScroll.tsx
"use client";

import * as React from "react";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  // Lightweight “premium” feel without risky scroll hijacking.
  // (No JS wheel interception = fewer bugs, keeps native momentum on trackpads.)
  React.useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return <>{children}</>;
}