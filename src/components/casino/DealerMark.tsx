"use client";

import { motion } from "framer-motion";

interface DealerMarkProps {
  active: boolean;
  phase: string;
}

/**
 * The dealer — a rendered sprite (rigged character, suit pack, rendered to
 * a transparent PNG) rather than a live 3D viewport, matching the "flat
 * composited scene" the rest of the table uses. Subtle breathing/sway
 * keeps it from reading as a static cutout.
 */
export function DealerMark({ active, phase }: DealerMarkProps) {
  return (
    <div className="flex flex-col items-center select-none">
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.img
          src="/images/dealer-suit.png"
          alt="Croupier"
          draggable={false}
          className="pointer-events-none"
          style={{ height: "min(19vh, 180px)", width: "auto" }}
          animate={{
            filter: active
              ? "drop-shadow(0 6px 10px rgba(0,0,0,0.6)) drop-shadow(0 0 26px rgba(217,184,118,0.55))"
              : "drop-shadow(0 6px 10px rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(217,184,118,0.2))",
          }}
          transition={{ duration: 0.7 }}
        />
      </motion.div>
      <span
        className="-mt-1 text-[9px] uppercase tracking-[0.25em] px-2 py-0.5 rounded-full"
        style={{ color: "var(--gold-400)", background: "rgba(5,8,10,0.55)" }}
      >
        Croupier
      </span>
      {phase === "dealer_turns" && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[8px] uppercase tracking-widest mt-0.5"
          style={{ color: "var(--cream-dim)" }}
        >
          tire ses cartes…
        </motion.span>
      )}
    </div>
  );
}
