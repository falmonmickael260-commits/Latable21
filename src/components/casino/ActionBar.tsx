"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { HandState } from "@/lib/types";
import { ActionButton } from "./ActionButton";
import { HitIcon, StandIcon, DoubleIcon, SplitIcon } from "./ActionIcons";

interface ActionBarProps {
  seatNumber: number;
  handIndex: number;
  hand: HandState;
  balance: number;
  onAction: (type: "hit" | "stand" | "double" | "split") => void;
}

export function ActionBar({ seatNumber, handIndex, hand, balance, onAction }: ActionBarProps) {
  const canDouble = hand.cards.length === 2 && !hand.doubled && balance >= hand.bet;
  const canSplit =
    hand.cards.length === 2 &&
    !hand.isSplit &&
    hand.cards[0].rank === hand.cards[1].rank &&
    balance >= hand.bet;

  return (
    <AnimatePresence>
      <motion.div
        key={`${seatNumber}-${handIndex}`}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        // Docked to the bottom of the actual viewport (not the scaled
        // table stage) on phones, same reasoning as BetPanel — floating
        // centered over a short mobile stage used to land on top of the
        // felt/cards instead of below them.
        className="fixed sm:absolute inset-x-0 sm:inset-x-auto bottom-0 sm:bottom-6 left-0 sm:left-1/2 sm:-translate-x-1/2 z-30 flex flex-col items-center gap-2 px-3 pt-3 sm:pt-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-0 rounded-t-2xl sm:rounded-none bg-[rgba(5,8,10,0.85)] sm:bg-transparent"
      >
        <span
          className="text-[11px] uppercase tracking-[0.25em] px-3 py-1 rounded-full"
          style={{ color: "var(--gold-400)", background: "rgba(5,8,10,0.6)", border: "1px solid rgba(217,184,118,0.3)" }}
        >
          À vous de jouer — Place {seatNumber}
        </span>
        <div
          className="flex flex-wrap justify-center gap-2 sm:gap-3 rounded-2xl p-2.5 sm:p-3 max-w-[420px] sm:max-w-none mx-auto"
          style={{ background: "rgba(5,8,10,0.55)", backdropFilter: "blur(6px)" }}
        >
          <ActionButton label="TIRER" tone="green" icon={<HitIcon />} onClick={() => onAction("hit")} />
          <ActionButton label="RESTER" tone="gold" icon={<StandIcon />} onClick={() => onAction("stand")} />
          <ActionButton label="DOUBLE" tone="wine" icon={<DoubleIcon />} disabled={!canDouble} onClick={() => onAction("double")} />
          <ActionButton label="SPLIT" tone="neutral" icon={<SplitIcon />} disabled={!canSplit} onClick={() => onAction("split")} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
