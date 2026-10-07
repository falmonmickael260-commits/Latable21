"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import type { HandState, SeatState } from "@/lib/types";
import { PlayingCard, type FlightVector } from "./PlayingCard";
import { Chip } from "./Chip";
import { useCountdown } from "@/hooks/useCountdown";
import { sfx } from "@/lib/sound";

interface SeatProps {
  seat: SeatState;
  isMine: boolean;
  isActiveTurn: boolean;
  activeHandIndex: number;
  turnDeadline: number | null;
  phase: string;
  flightFor: (cardId: string) => FlightVector | undefined;
  justDealtCardId: string | null;
  onSit: () => void;
}

const RESULT_LABEL: Record<string, string> = {
  blackjack: "BLACKJACK !",
  win: "VICTOIRE",
  lose: "PERDU",
  bust: "BUST",
  push: "PUSH",
};

const BUST_PARTICLES = [
  { dx: -22, dy: -18, delay: 0 },
  { dx: 20, dy: -22, delay: 0.03 },
  { dx: -28, dy: 6, delay: 0.06 },
  { dx: 26, dy: 10, delay: 0.02 },
  { dx: -10, dy: -28, delay: 0.08 },
  { dx: 12, dy: 24, delay: 0.05 },
];

function handTotal(hand: HandState): number | null {
  if (hand.cards.length === 0) return null;
  return hand.cards.reduce((sum, c) => sum + (c.rank === "A" ? 11 : ["J", "Q", "K"].includes(c.rank) ? 10 : Number(c.rank)), 0);
}

function HandView({
  hand,
  highlighted,
  flightFor,
  justDealtCardId,
}: {
  hand: HandState;
  highlighted: boolean;
  flightFor: (cardId: string) => FlightVector | undefined;
  justDealtCardId: string | null;
}) {
  const total = handTotal(hand);
  const isBust = hand.status === "bust" || hand.result === "bust";
  const wasBust = useRef(false);
  const controls = useAnimationControls();
  const [justBusted, setJustBusted] = useState(false);

  useEffect(() => {
    if (isBust && !wasBust.current) {
      wasBust.current = true;
      sfx.bust();
      setJustBusted(true);
      void controls.start({ x: [0, -7, 7, -5, 5, -2, 2, 0], transition: { duration: 0.45, ease: "easeOut" } });
      const t = setTimeout(() => setJustBusted(false), 1400);
      return () => clearTimeout(t);
    }
    if (!isBust) wasBust.current = false;
  }, [isBust, controls]);

  return (
    <motion.div
      animate={controls}
      className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-shadow duration-300 ${
        highlighted ? "shadow-[0_0_0_2px_var(--gold-500),0_0_18px_rgba(217,184,118,0.5)]" : ""
      }`}
      style={isBust ? { boxShadow: "0 0 0 1.5px rgba(167,45,58,0.7), 0 0 20px rgba(167,45,58,0.35)" } : undefined}
    >
      <AnimatePresence>
        {justBusted && (
          <motion.div
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute -inset-2 rounded-xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(167,45,58,0.5), transparent 70%)" }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {justBusted &&
          BUST_PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full pointer-events-none"
              style={{ background: i % 2 === 0 ? "#c0394a" : "var(--gold-400)" }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.3 }}
              transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
            />
          ))}
      </AnimatePresence>

      {/* "xs" cards, tightly fanned — with 7 seats packed close together
          (shoulder-width apart, by design) a seated hand has only ~35-45px
          of real room before it runs into the next seat's cards; the
          larger "sm" size used elsewhere overflowed into the neighboring
          seat even for a single card. */}
      <div className="flex -space-x-4">
        <AnimatePresence initial={false}>
          {hand.cards.map((card, i) => {
            const isBustCard = isBust && i === hand.cards.length - 1;
            return (
              <div key={card.id} style={{ zIndex: i }} className="relative">
                {justBusted && isBustCard && (
                  <motion.div
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 1.3 }}
                    className="absolute -inset-0.5 rounded-[9px] pointer-events-none"
                    style={{ boxShadow: "0 0 0 2px #c0394a" }}
                  />
                )}
                <PlayingCard
                  card={card}
                  size="xs"
                  tilt={(i - (hand.cards.length - 1) / 2) * 5}
                  origin={card.id === justDealtCardId ? flightFor(card.id) : undefined}
                />
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1.5">
        {hand.bet > 0 && (
          <motion.div animate={{ opacity: isBust ? 0.4 : 1 }} transition={{ duration: 0.6 }}>
            <Chip amount={hand.bet} size={28} />
          </motion.div>
        )}
        {total !== null && (
          <motion.span
            className="text-[11px] font-bold tabular-nums"
            animate={{ color: isBust ? "#e0616f" : "var(--cream-dim)", scale: justBusted ? [1, 1.35, 1] : 1 }}
            transition={{ duration: 0.4 }}
          >
            {total}
          </motion.span>
        )}
        {hand.isSplitAce && (
          <span className="text-[8px] uppercase tracking-wide px-1 rounded" style={{ background: "var(--wine-600)" }}>
            As split — 1 carte
          </span>
        )}
      </div>

      <AnimatePresence>
        {isBust && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="absolute -bottom-6 whitespace-nowrap text-[12px] font-black tracking-wide px-2.5 py-0.5 rounded-full"
            style={{ fontFamily: "var(--font-display)", color: "var(--cream)", background: "var(--wine-600)", border: "1px solid #e0616f" }}
          >
            BUST !
          </motion.div>
        )}
        {!isBust && hand.result && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-6 whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              fontFamily: "var(--font-display)",
              color: hand.payout > 0 ? "var(--ink)" : "var(--cream)",
              background: hand.payout > 0 ? "var(--gold-400)" : hand.result === "push" ? "var(--felt-650)" : "var(--wine-600)",
            }}
          >
            {RESULT_LABEL[hand.result] ?? hand.result}
            {hand.payout > 0 ? ` +${hand.payout}` : hand.result === "push" ? "" : ` -${hand.bet}`}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Seat({
  seat,
  isMine,
  isActiveTurn,
  activeHandIndex,
  turnDeadline,
  phase,
  flightFor,
  justDealtCardId,
  onSit,
}: SeatProps) {
  if (seat.status === "empty") {
    // The table photo already shows a numbered, crowned betting circle at
    // this exact spot — this is just the clickable hotspot over it, with a
    // soft hover glow instead of a second, redundant label.
    return (
      <button
        onClick={onSit}
        className="group flex items-center justify-center rounded-full w-[72px] h-[72px] cursor-pointer transition-all"
        style={{ background: "transparent" }}
      >
        <span
          className="w-full h-full rounded-full transition-all duration-300 group-hover:shadow-[0_0_0_2px_rgba(217,184,118,0.6),0_0_22px_rgba(217,184,118,0.35)]"
          style={{ background: "transparent" }}
        />
      </button>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-1">
      {isActiveTurn && (
        <motion.div
          className="absolute -inset-3 rounded-2xl pointer-events-none"
          style={{ boxShadow: "0 0 0 2px var(--gold-500), 0 0 28px rgba(217,184,118,0.55)" }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}

      <div className="flex items-center gap-1.5">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={{ background: "var(--gold-500)", color: "var(--ink)" }}
        >
          {seat.pseudo?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span
          className="text-[10px] uppercase tracking-wide truncate max-w-[90px]"
          style={{ color: isMine ? "var(--gold-300)" : "var(--cream-dim)", fontFamily: "var(--font-display)" }}
        >
          {seat.pseudo}
        </span>
      </div>

      {seat.hands.length === 0 ? (
        <span className="text-[9px] uppercase tracking-widest opacity-60">en attente de mise</span>
      ) : (
        <div className="flex gap-2">
          {seat.hands.map((hand, idx) => (
            <HandView
              key={hand.id}
              hand={hand}
              highlighted={isActiveTurn && activeHandIndex === idx}
              flightFor={flightFor}
              justDealtCardId={justDealtCardId}
            />
          ))}
        </div>
      )}

      {isActiveTurn && isMine && turnDeadline && phase === "player_turns" && <TurnTimer deadline={turnDeadline} />}
    </div>
  );
}

function TurnTimer({ deadline }: { deadline: number }) {
  const remaining = useCountdown(deadline);
  const pct = Math.min(100, (remaining / 20000) * 100);
  return (
    <div className="w-16 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
      <motion.div
        className="h-full"
        style={{ background: "var(--gold-500)", width: `${pct}%` }}
        animate={{ width: "0%" }}
        transition={{ duration: remaining / 1000, ease: "linear" }}
      />
    </div>
  );
}
