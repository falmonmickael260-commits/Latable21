"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { sfx } from "@/lib/sound";

interface ActionButtonProps {
  label: string;
  sub?: string;
  icon?: ReactNode;
  disabled?: boolean;
  tone?: "gold" | "wine" | "neutral";
  onClick: () => void;
}

export function ActionButton({ label, sub, disabled, tone = "neutral", onClick }: ActionButtonProps) {
  const palette = {
    gold: { bg: "linear-gradient(180deg, var(--gold-400), var(--gold-600))", text: "var(--ink)", ring: "var(--gold-400)" },
    wine: { bg: "linear-gradient(180deg, var(--wine-500), var(--wine-600))", text: "var(--cream)", ring: "var(--wine-500)" },
    neutral: { bg: "linear-gradient(180deg, #2a2a2a, #121212)", text: "var(--cream)", ring: "rgba(217,184,118,0.4)" },
  }[tone];

  return (
    <motion.button
      disabled={disabled}
      onMouseEnter={() => !disabled && sfx.buttonHover()}
      onClick={() => {
        if (disabled) return;
        sfx.buttonClick();
        onClick();
      }}
      whileHover={disabled ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { y: 1, scale: 0.97 }}
      className="relative flex flex-col items-center justify-center rounded-xl px-3.5 py-2.5 sm:px-5 sm:py-3 min-w-[72px] sm:min-w-[92px] disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
      style={{
        background: palette.bg,
        color: palette.text,
        boxShadow: disabled ? "none" : `0 6px 0 rgba(0,0,0,0.35), 0 10px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)`,
        border: `1px solid ${palette.ring}`,
      }}
    >
      <span className="text-[13px] font-bold tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        {label}
      </span>
      {sub && (
        <span className="text-[9px] uppercase tracking-widest opacity-80">
          {sub}
        </span>
      )}
    </motion.button>
  );
}
