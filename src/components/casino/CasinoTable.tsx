"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCasinoSocket } from "@/lib/use-casino-socket";
import { useImageBox } from "@/hooks/useImageBox";
import { DEALER_CARD_FRACTION, SEAT_FRACTIONS, SHOE_FRACTION, seatFraction } from "@/lib/table-layout";
import { SEAT_COUNT } from "@/lib/types";
import { Seat } from "./Seat";
import { DealerMark } from "./DealerMark";
import { LogoPanel } from "./LogoPanel";
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

  const { ref: tableImgRef, box: tableBox } = useImageBox<HTMLImageElement>();

  // Every anchor (seats, dealer, cards) is computed from the photo table's
  // own live-measured pixel box + a fraction read off its baked-in badges —
  // so alignment holds regardless of viewport size/aspect.
  const pointFor = useMemo(() => {
    return (fx: number, fy: number) => ({ x: tableBox.left + fx * tableBox.width, y: tableBox.top + fy * tableBox.height });
  }, [tableBox]);

  const flightFor = useMemo(() => {
    const shoe = pointFor(SHOE_FRACTION.fx, SHOE_FRACTION.fy);
    return (targetSeat: number | "dealer"): FlightVector => {
      const frac = targetSeat === "dealer" ? DEALER_CARD_FRACTION : seatFraction(targetSeat);
      const dest = pointFor(frac.fx, frac.fy);
      return { dx: shoe.x - dest.x, dy: shoe.y - dest.y };
    };
  }, [pointFor]);

  const dealerActive = table?.phase === "dealer_reveal" || table?.phase === "dealer_turns";
  const dealerPoint = pointFor(0.5, 0);
  const dealerCardPoint = pointFor(DEALER_CARD_FRACTION.fx, DEALER_CARD_FRACTION.fy);

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
    <div className="relative flex-1 overflow-hidden">
      <Image
        src="/images/la-table-21-hero.png"
        alt=""
        fill
        priority
        className="object-cover scale-110"
        style={{ objectPosition: "center 22%", filter: "blur(6px) brightness(0.7) saturate(1.05)" }}
        sizes="100vw"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(3,4,5,0.6) 0%, rgba(3,4,5,0.2) 30%, rgba(3,4,5,0.5) 100%)" }}
      />

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

      <div className="absolute inset-0">
        {/* The real table surface — every other element on it is anchored
            to this image's own live-measured box. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={tableImgRef}
          src="/images/table-blackjack.png"
          alt=""
          draggable={false}
          className="absolute left-1/2 bottom-0 -translate-x-1/2 pointer-events-none select-none"
          style={{ height: "min(64vh, 640px)", width: "auto", maxWidth: "none" }}
        />

        <div
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: dealerPoint.x, top: dealerPoint.y - tableBox.height * 0.1 }}
        >
          <LogoPanel />
        </div>

        <div
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: dealerPoint.x, top: dealerPoint.y }}
        >
          <DealerMark active={dealerActive} phase={table.phase} />
        </div>

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 flex gap-1 -space-x-6"
          style={{ left: dealerCardPoint.x, top: dealerCardPoint.y }}
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
          const pos = pointFor(frac.fx, frac.fy);
          const dimmed =
            table.phase === "player_turns" && table.activeSeat !== null && table.activeSeat !== seatNumber;
          return (
            <div
              key={seatNumber}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
              style={{ left: pos.x, top: pos.y, opacity: dimmed ? 0.55 : 1 }}
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
  );
}
