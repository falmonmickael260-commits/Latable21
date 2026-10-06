"use client";

import { motion } from "framer-motion";
import { sfx } from "@/lib/sound";

const CHIP_THEME: Record<number, { base: string; ring: string; text: string }> = {
  100: { base: "#f4ead8", ring: "#2a2a2a", text: "#1a1a1a" },
  200: { base: "#7a1f2b", ring: "#f4ead8", text: "#f4ead8" },
  300: { base: "#123c2b", ring: "#d9b876", text: "#f4ead8" },
  400: { base: "#161616", ring: "#d9b876", text: "#d9b876" },
  500: { base: "#2a1140", ring: "#d9b876", text: "#f3e2b4" },
};

function themeFor(amount: number) {
  const steps = [100, 200, 300, 400, 500];
  const nearest = steps.reduce((a, b) => (Math.abs(b - amount) < Math.abs(a - amount) ? b : a));
  return CHIP_THEME[nearest];
}

interface ChipProps {
  amount: number;
  size?: number;
  animate?: boolean;
  dropFrom?: number;
}

export function Chip({ amount, size = 46, animate = false, dropFrom = -80 }: ChipProps) {
  const theme = themeFor(amount);
  return (
    <motion.div
      className="relative rounded-full select-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${theme.base}, ${theme.base} 55%, #000 130%)`,
        border: `2px dashed ${theme.ring}`,
        boxShadow: "0 6px 10px rgba(0,0,0,0.5), inset 0 0 0 4px rgba(0,0,0,0.25)",
      }}
      initial={animate ? { y: dropFrom, opacity: 0, rotate: -120, scale: 0.6 } : false}
      animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 16 }}
      onAnimationComplete={() => animate && sfx.chip()}
    >
      <div
        className="absolute inset-[5px] rounded-full flex items-center justify-center font-semibold"
        style={{
          border: `1px solid ${theme.ring}66`,
          color: theme.text,
          fontFamily: "var(--font-display)",
          fontSize: size * 0.24,
        }}
      >
        {amount}
      </div>
    </motion.div>
  );
}
