"use client";

import { motion } from "framer-motion";
import type { SeatState } from "@/lib/types";
import { Chip } from "./Chip";
import { sfx } from "@/lib/sound";
import { useCountdown } from "@/hooks/useCountdown";

const QUICK_AMOUNTS = [100, 200, 300, 400, 500];

interface BetPanelProps {
  mySeats: SeatState[];
  balance: number;
  onPlaceBet: (seatNumber: number, amount: number) => void;
  onClearBet: (seatNumber: number) => void;
  onLeaveSeat: (seatNumber: number) => void;
  bettingDeadline: number | null;
}

export function BetPanel({ mySeats, balance, onPlaceBet, onClearBet, onLeaveSeat, bettingDeadline }: BetPanelProps) {
  const remaining = useCountdown(bettingDeadline);
  if (mySeats.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      // Docked to the bottom of the actual viewport (not the scaled table
      // stage) on phones — a floating panel centered on a short, letterboxed
      // mobile stage used to land mid-screen over the felt/cards. From `sm`
      // up it reverts to floating over the stage like before.
      className="fixed sm:absolute inset-x-0 sm:inset-x-auto bottom-0 sm:bottom-6 left-0 sm:left-1/2 sm:-translate-x-1/2 z-30 flex flex-col items-center gap-3 rounded-t-2xl sm:rounded-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4"
      style={{ background: "rgba(5,8,10,0.85)", border: "1px solid rgba(217,184,118,0.25)", backdropFilter: "blur(6px)" }}
    >
      <span className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "var(--gold-400)" }}>
        Placez votre mise {bettingDeadline ? `· ${Math.ceil(remaining / 1000)}s` : ""}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-4 max-h-[40vh] sm:max-h-none overflow-y-auto">
        {mySeats.map((seat) => {
          const bet = seat.hands[0]?.bet ?? 0;
          return (
            <div key={seat.seatNumber} className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--cream-dim)" }}>
                Place {seat.seatNumber}
              </span>
              {bet > 0 ? (
                <div className="flex items-center gap-2">
                  <Chip amount={bet} size={34} />
                  <button
                    onClick={() => onClearBet(seat.seatNumber)}
                    className="text-[9px] uppercase tracking-widest px-2 py-1 rounded-full"
                    style={{ color: "var(--wine-500)", border: "1px solid var(--wine-600)" }}
                  >
                    annuler
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      disabled={balance < amount}
                      onClick={() => {
                        sfx.chip();
                        onPlaceBet(seat.seatNumber, amount);
                      }}
                      className="disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-1 transition-transform"
                    >
                      <Chip amount={amount} size={38} />
                    </button>
                  ))}
                  <button
                    onClick={() => onLeaveSeat(seat.seatNumber)}
                    className="text-[9px] uppercase tracking-widest px-2 ml-1 rounded-full"
                    style={{ color: "var(--cream-dim)" }}
                  >
                    quitter
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
