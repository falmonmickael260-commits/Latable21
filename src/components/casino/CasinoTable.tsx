"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCasinoSocket } from "@/lib/use-casino-socket";
import { useElementSize } from "@/hooks/useElementSize";
import { DEALER_POS, SHOE_POS, seatPosition } from "@/lib/table-layout";
import { SEAT_COUNT } from "@/lib/types";
import { Seat } from "./Seat";
import { Table2D } from "./Table2D";
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

// All seat/card/badge sizing throughout the scene is designed in fixed px
// against this reference canvas, then the whole scene is uniformly scaled
// (via CSS transform) to whatever size the live, aspect-locked stage box
// actually renders at. That's what makes the table (and everything on it)
// scale smoothly from a small phone up to a wide desktop instead of seats
// and cards staying a constant, viewport-breaking pixel size.
const REF_WIDTH = 1200;

// The stage's own aspect ratio adapts to the available space instead of
// staying locked at 16:9 everywhere: capped at 16:9 on wide/landscape
// screens (the look everything was designed for), but allowed to go as
// narrow as MIN_RATIO on tall/portrait screens (a phone) so the table
// actually grows to use the available height instead of shrinking to a
// thin letterboxed strip with the photo background filling the rest.
const MAX_RATIO = 16 / 9;
const MIN_RATIO = 1.05;

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
  const { ref: stageRef, size } = useElementSize<HTMLDivElement>();
  const boxRatio =
    outerSize.width > 0 && outerSize.height > 0
      ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, outerSize.width / outerSize.height))
      : MAX_RATIO;
  // The reference canvas's own height adapts with boxRatio too (staying
  // REF_WIDTH wide), so the scaled scene exactly fills a taller/narrower
  // stage on a portrait screen instead of only filling its top portion.
  const refHeight = REF_WIDTH / boxRatio;
  const scale = size.width > 0 ? size.width / REF_WIDTH : 1;

  const flightFor = useMemo(() => {
    return (targetSeat: number | "dealer"): FlightVector => {
      const dest = targetSeat === "dealer" ? DEALER_POS : seatPosition(targetSeat);
      // Computed in reference-canvas px, not live px — the scene wrapper's
      // own transform:scale() takes care of scaling these deltas along
      // with everything else, so this must not depend on the live size.
      const dx = ((SHOE_POS.x - dest.x) / 100) * REF_WIDTH;
      const dy = ((SHOE_POS.y - dest.y) / 100) * refHeight;
      return { dx, dy };
    };
  }, [refHeight]);

  const dealerActive = table?.phase === "dealer_reveal" || table?.phase === "dealer_turns";

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
        style={{ objectPosition: "center 22%", filter: "blur(5px) brightness(0.75) saturate(1.05)" }}
        sizes="100vw"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(3,4,5,0.55) 0%, rgba(3,4,5,0.25) 28%, rgba(3,4,5,0.88) 100%)" }}
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

      {/* The whole table scene is locked to a fixed aspect ratio and
          centered/letterboxed — every seat/card/dealer position is tuned
          as a percentage of THIS box, so it must never stretch to an
          arbitrary viewport shape (a very wide/short window was pushing
          seat badges outside the drawn table). */}
      <div ref={outerRef} className="absolute inset-0 flex items-center justify-center p-3">
        <div ref={stageRef} className="relative w-full" style={{ aspectRatio: boxRatio, maxHeight: "100%" }}>
          {/* Scaled scene: fixed-px sizing throughout (seats, cards, badges)
              rendered at the reference canvas size, then scaled as one unit
              to fit the live stage — this is what keeps everything a sane,
              proportionate size on a small phone instead of overlapping. */}
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: REF_WIDTH, height: refHeight, transform: `scale(${scale})` }}
          >
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${DEALER_POS.x}%`, top: `${DEALER_POS.y - 14}%` }}
            >
              <LogoPanel />
            </div>

            <Table2D />

            <div
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${DEALER_POS.x}%`, top: `${DEALER_POS.y}%` }}
            >
              <DealerMark active={dealerActive} phase={table.phase} />
            </div>

            <div
              className="absolute -translate-x-1/2 flex gap-1 -space-x-6"
              style={{ left: `${DEALER_POS.x}%`, top: `${DEALER_POS.y + 8}%` }}
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
              const pos = seatPosition(seatNumber);
              const dimmed =
                table.phase === "player_turns" && table.activeSeat !== null && table.activeSeat !== seatNumber;
              return (
                <div
                  key={seatNumber}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, opacity: dimmed ? 0.55 : 1 }}
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

          {/* Not scaled — UI chrome (bets, actions, results) stays a
              comfortable, constant readable/tappable size regardless of
              how small the table itself has to shrink. */}
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
