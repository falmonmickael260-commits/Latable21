"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { HandState } from "@/lib/types";
import { ActionButton } from "./ActionButton";

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
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2"
      >
        <span
          className="text-[11px] uppercase tracking-[0.25em] px-3 py-1 rounded-full"
          style={{ color: "var(--gold-400)", background: "rgba(5,8,10,0.6)", border: "1px solid rgba(217,184,118,0.3)" }}
        >
          À vous de jouer — Place {seatNumber}
        </span>
        <div className="flex gap-3 rounded-2xl p-3" style={{ background: "rgba(5,8,10,0.55)", backdropFilter: "blur(6px)" }}>
          <ActionButton label="TIRER" tone="gold" onClick={() => onAction("hit")} />
          <ActionButton label="RESTER" tone="neutral" onClick={() => onAction("stand")} />
          <ActionButton label="DOUBLE" tone="wine" disabled={!canDouble} onClick={() => onAction("double")} />
          <ActionButton label="SPLIT" tone="wine" disabled={!canSplit} onClick={() => onAction("split")} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
