"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import type { Card } from "@/lib/types";
import { sfx } from "@/lib/sound";

const SUIT_GLYPH: Record<Card["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const RED_SUITS = new Set(["hearts", "diamonds"]);

export interface FlightVector {
  dx: number;
  dy: number;
}

interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  origin?: FlightVector;
  delay?: number;
  tilt?: number;
  size?: "md" | "sm";
}

export function PlayingCard({ card, faceDown = false, origin, delay = 0, tilt = 0, size = "md" }: PlayingCardProps) {
  const hasArrived = useRef(false);
  const dims = size === "sm" ? { w: 46, h: 66 } : { w: 64, h: 92 };
  const isRed = RED_SUITS.has(card.suit);

  return (
    <motion.div
      className="relative"
      style={{ width: dims.w, height: dims.h, perspective: 900 }}
      initial={origin ? { x: origin.dx, y: origin.dy, opacity: 0, rotate: tilt - 40, scale: 0.85 } : false}
      animate={{ x: 0, y: 0, opacity: 1, rotate: tilt, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.21, 0.8, 0.32, 1] }}
      onAnimationStart={() => {
        if (origin) sfx.cardSlide();
      }}
      onUpdate={(latest) => {
        if (!hasArrived.current && typeof latest.opacity === "number" && latest.opacity > 0.9) {
          hasArrived.current = true;
        }
      }}
    >
      <motion.div
        className="absolute inset-0 rounded-[7px] shadow-[0_8px_18px_rgba(0,0,0,0.55)]"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: faceDown ? 180 : 0 }}
        initial={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ duration: 0.45, delay: delay + 0.22, ease: "easeInOut" }}
        onAnimationComplete={() => sfx.cardFlip()}
      >
        {/* Face */}
        <div
          className="absolute inset-0 rounded-[7px] border flex flex-col justify-between p-[6px]"
          style={{
            backfaceVisibility: "hidden",
            background: "linear-gradient(160deg, #fbf6ea 0%, #f1e8d4 100%)",
            borderColor: "var(--gold-600)",
            color: isRed ? "var(--wine-600)" : "#1a1a1a",
          }}
        >
          <div className="flex flex-col items-start leading-none">
            <span className="text-[11px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {card.rank}
            </span>
            <span className="text-[10px]">{SUIT_GLYPH[card.suit]}</span>
          </div>
          <div className="self-center text-[22px] opacity-90">{SUIT_GLYPH[card.suit]}</div>
          <div className="flex flex-col items-end leading-none rotate-180">
            <span className="text-[11px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {card.rank}
            </span>
            <span className="text-[10px]">{SUIT_GLYPH[card.suit]}</span>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-[7px] border flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderColor: "var(--gold-600)",
            background:
              "repeating-linear-gradient(45deg, var(--felt-900) 0px, var(--felt-900) 6px, var(--wine-600) 6px, var(--wine-600) 7px)",
          }}
        >
          <div
            className="w-[60%] h-[42%] rotate-45 border"
            style={{ borderColor: "var(--gold-400)", background: "rgba(201,162,75,0.18)" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
