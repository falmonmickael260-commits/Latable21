"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCasinoSocket } from "@/lib/use-casino-socket";
import { useElementSize } from "@/hooks/useElementSize";
import { useImageBox } from "@/hooks/useImageBox";
import {
  DEALER_CARD_FRACTION,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  SEAT_FRACTIONS,
  SHOE_FRACTION,
  seatFraction,
} from "@/lib/table-layout";
import { SEAT_COUNT } from "@/lib/types";
import { Seat } from "./Seat";
import { HUD } from "./HUD";
import { ActionBar } from "./ActionBar";
import { BetPanel } from "./BetPanel";
import { ResultBanner } from "./ResultBanner";
import type { FlightVector } from "./PlayingCard";
import { PlayingCard } from "./PlayingCard";

const PHASE_LABEL: Record<string, string> = {
  idle: "En attente de mises",
  betting: "Les mises sont ouvertes",
  dealing: "Distribution des cartes",
  player_turns: "Tour des joueurs",
  dealer_reveal: "Le croupier révèle sa carte",
  dealer_turns: "Le croupier joue",
  payout: "Résultats de la manche",
};

const IMAGE_RATIO = IMAGE_WIDTH / IMAGE_HEIGHT;

export function CasinoTable({ pseudo }: { pseudo: string }) {
  const {
    connected,
    player,
    table,
    lastDeal,
    roundResults,
    errorMessage,
    sit,
    leaveSeat,
    placeBet,
    clearBet,
    action,
    clearError,
  } = useCasinoSocket(pseudo);

  const { ref: outerRef, size: outerSize } = useElementSize<HTMLDivElement>();
  const { ref: imgRef, box: imageBox } = useImageBox<HTMLImageElement>();

  // Explicit JS-computed "contain" sizing for the scene photo — CSS
  // aspect-ratio + width:100% + max-height:100% doesn't reliably shrink
  // width back down once max-height caps the height, so the box can
  // silently overflow vertically on a wide/short window.
  let photoWidth = outerSize.width;
  let photoHeight = outerSize.width / IMAGE_RATIO;
  if (outerSize.height > 0 && photoHeight > outerSize.height) {
    photoHeight = outerSize.height;
    photoWidth = outerSize.height * IMAGE_RATIO;
  }

  // Every overlay (seats, dealt cards) lives in a wrapper sized to the
  // photo's own natural pixel dimensions, then scaled as one unit to match
  // the photo's live rendered size — so a fixed-px seat circle or card
  // stays proportionate to the table whether it renders at 300px or
  // 1800px wide, instead of overlapping on a small phone.
  const scale = imageBox.width > 0 ? imageBox.width / IMAGE_WIDTH : photoWidth / IMAGE_WIDTH;

  const flightFor = useMemo(() => {
    return (targetSeat: number | "dealer"): FlightVector => {
      const frac = targetSeat === "dealer" ? DEALER_CARD_FRACTION : seatFraction(targetSeat);
      const dx = (SHOE_FRACTION.fx - frac.fx) * IMAGE_WIDTH;
      const dy = (SHOE_FRACTION.fy - frac.fy) * IMAGE_HEIGHT;
      return { dx, dy };
    };
  }, []);

  if (!table || !player) {
    return (
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <Image src="/images/la-table-21-hero.png" alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0" style={{ background: "rgba(3,4,5,0.6)" }} />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="relative text-sm uppercase tracking-[0.3em]"
          style={{ color: "var(--gold-400)" }}
        >
          Entrée dans le casino…
        </motion.span>
      </div>
    );
  }

  const mySeats = table.seats.filter((s) => s.playerId === player.id);
  const mySeatsAwaitingBet = mySeats.filter((s) => s.status === "reserved" || s.status === "betting");
  const activeSeatState = table.activeSeat ? table.seats.find((s) => s.seatNumber === table.activeSeat) : null;
  const isMyTurn = activeSeatState?.playerId === player.id;
  const activeHand = isMyTurn ? activeSeatState?.hands[table.activeHandIndex] : null;

  const justDealtCardId = lastDeal?.card.id ?? null;
  const dealerJustDealt = lastDeal?.seatNumber === "dealer" && justDealtCardId;

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: "#07090b" }}>
      <HUD player={player} connected={connected} />

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={clearError}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-50 cursor-pointer rounded-full px-4 py-2 text-[12px]"
          style={{ background: "var(--wine-600)", color: "var(--cream)" }}
        >
          {errorMessage}
        </motion.div>
      )}

      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
        <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--cream-dim)" }}>
          {PHASE_LABEL[table.phase] ?? ""} · Manche {table.roundNumber}
        </span>
      </div>

      <div ref={outerRef} className="absolute inset-0 flex items-center justify-center p-2">
        <div className="relative" style={{ width: photoWidth || "100%", height: photoHeight || "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src="/images/table-scene.png"
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
          />

          {/* Overlays: sized at the photo's own natural resolution, then
              scaled as one unit to match its live rendered box. */}
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT, transform: `scale(${scale})` }}
          >
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 flex gap-1 -space-x-6"
              style={{ left: `${DEALER_CARD_FRACTION.fx * 100}%`, top: `${DEALER_CARD_FRACTION.fy * 100}%` }}
            >
              {table.dealer.cards.map((card, i) => (
                <div key={card.id} style={{ zIndex: i }}>
                  <PlayingCard
                    card={card}
                    size="sm"
                    faceDown={i === 1 && !table.dealer.holeCardRevealed}
                    tilt={(i - 0.5) * 4}
                    origin={card.id === dealerJustDealt ? flightFor("dealer") : undefined}
                  />
                </div>
              ))}
              {table.dealer.total !== null && table.dealer.holeCardRevealed && (
                <span
                  className="absolute -right-9 top-1/2 -translate-y-1/2 text-[12px] font-bold tabular-nums"
                  style={{ color: table.dealer.total > 21 ? "#e0616f" : "var(--cream-dim)" }}
                >
                  {table.dealer.total}
                </span>
              )}
            </div>

            {Array.from({ length: SEAT_COUNT }, (_, i) => i + 1).map((seatNumber) => {
              const seat = table.seats.find((s) => s.seatNumber === seatNumber)!;
              const frac = SEAT_FRACTIONS[seatNumber];
              const dimmed =
                table.phase === "player_turns" && table.activeSeat !== null && table.activeSeat !== seatNumber;
              return (
                <div
                  key={seatNumber}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
                  style={{ left: `${frac.fx * 100}%`, top: `${frac.fy * 100}%`, opacity: dimmed ? 0.55 : 1 }}
                >
                  <Seat
                    seat={seat}
                    isMine={seat.playerId === player.id}
                    isActiveTurn={table.activeSeat === seatNumber}
                    activeHandIndex={table.activeHandIndex}
                    turnDeadline={table.turnDeadline}
                    phase={table.phase}
                    flightFor={() => flightFor(seatNumber)}
                    justDealtCardId={justDealtCardId}
                    onSit={() => sit(seatNumber)}
                  />
                </div>
              );
            })}
          </div>

          {/* Not scaled — UI chrome stays a comfortable, constant size. */}
          {mySeatsAwaitingBet.length > 0 && (table.phase === "idle" || table.phase === "betting") && (
            <BetPanel
              mySeats={mySeatsAwaitingBet}
              balance={player.balance}
              onPlaceBet={placeBet}
              onClearBet={clearBet}
              onLeaveSeat={leaveSeat}
              bettingDeadline={table.phase === "betting" ? table.turnDeadline : null}
            />
          )}

          {isMyTurn && activeHand && table.activeSeat && (
            <ActionBar
              seatNumber={table.activeSeat}
              handIndex={table.activeHandIndex}
              hand={activeHand}
              balance={player.balance}
              onAction={(type) => action(table.activeSeat!, table.activeHandIndex, type)}
            />
          )}

          <ResultBanner
            results={roundResults}
            mySeatNumbers={mySeats.map((s) => s.seatNumber)}
            dealerBusted={(table.dealer.total ?? 0) > 21}
          />
        </div>
      </div>
    </div>
  );
}
