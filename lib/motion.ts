// lib/motion.ts
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const DUR = {
  fast: 0.14,
  base: 0.22,
  slow: 0.34,
} as const;

export const motionTokens = {
  ease: EASE_OUT,
  dur: DUR,
};

// Page transitions
export const pageVariants = {
  initial: { opacity: 0, y: 12, filter: "blur(3px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DUR.slow, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: 10,
    filter: "blur(3px)",
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
};

// Overlay (modal/drawer)
export const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE_OUT } },
};

// Modal panel
export const modalPanelVariants = {
  initial: { opacity: 0, y: 16, scale: 0.99 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.99,
    transition: { duration: DUR.fast, ease: EASE_OUT },
  },
};

// Drawer panels
export const drawerRightVariants = {
  initial: { x: "105%", opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: DUR.slow, ease: EASE_OUT } },
  exit: { x: "105%", opacity: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
};

export const drawerBottomVariants = {
  initial: { y: "105%", opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: DUR.slow, ease: EASE_OUT } },
  exit: { y: "105%", opacity: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
};

// Card micro-interactions (Framer Motion "whileHover/whileTap")
export const cardMotion = {
  whileHover: { y: -2, transition: { duration: DUR.fast, ease: EASE_OUT } },
  whileTap: { y: 0, scale: 0.99, transition: { duration: DUR.fast, ease: EASE_OUT } },
};