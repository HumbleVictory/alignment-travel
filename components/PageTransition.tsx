// components/PageTransition.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { pageVariants } from "@/lib/motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduced ? false : "initial"}
        animate={reduced ? undefined : "animate"}
        exit={reduced ? undefined : "exit"}
        variants={pageVariants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}