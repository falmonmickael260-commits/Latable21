"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCasinoSocket } from "@/lib/use-casino-socket";
import { useElementSize } from "@/hooks/useElementSize";
import { DEALER_POS, SHOE_POS, IMAGE_WIDTH, IMAGE_HEIGHT, seatPosition } from "@/lib/table-layout";
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

// All seat/card sizing is authored in fixed px against this reference
// canvas, then the whole scene is uniformly scaled (CSS transform) to fit
// the live stage box — this is what keeps cards/badges a sane, legible
// size on a small phone instead of a constant viewport-breaking pixel size.
// REF_WIDTH itself shrinks on narrow stages (mobile) so the scale factor
// stays in a readable range instead of cratering on a 1200-wide canvas.
const REF_WIDTH_MAX = 1200;
const REF_WIDTH_MIN = 620;

// The scene is a real photo (public/images/table-bg.png) now, not an
// abstract hand-built shape — so unlike the old SVG table, its aspect
// ratio is NOT negotiable: stretching or squashing it to fit the viewport
// would distort the dealer/table photo and throw every seat position off.
// It's always displayed via a strict "contain" fit at its own native
// aspect ratio, letterboxed (not cropped/stretched) on viewports that
// don't match — the blurred hero image behind fills those letterbox bars.
const IMAGE_ASPECT = IMAGE_WIDTH / IMAGE_HEIGHT;

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
  // Explicit JS-computed "contain" sizing — CSS aspect-ratio + max-height
  // alone doesn't work here: with width:100% set explicitly, the browser
  // caps the *height* at max-height but never re-derives width from that
  // capped height, so the box silently overflows vertically instead of
  // shrinking. Computing both dimensions here avoids that entirely.
  let stageWidth = outerSize.width;
  let stageHeight = outerSize.width / IMAGE_ASPECT;
  if (outerSize.height > 0 && stageHeight > outerSize.height) {
    stageHeight = outerSize.height;
    stageWidth = outerSize.height * IMAGE_ASPECT;
  }
  const REF_WIDTH =
    outerSize.width > 0 ? Math.min(REF_WIDTH_MAX, Math.max(REF_WIDTH_MIN, outerSize.width * 1.15)) : REF_WIDTH_MAX;
  // Always exactly IMAGE_ASPECT — this reference canvas is just a fixed-px
  // coordinate space for sizing cards/seats, scaled as one unit onto the
  // stage box above, so its own aspect must match the photo's exactly.
  const refHeight = REF_WIDTH / IMAGE_ASPECT;
  const scale = stageWidth > 0 ? stageWidth / REF_WIDTH : 1;

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
  }, [refHeight, REF_WIDTH]);

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

  // The bottom-docked panel (BetPanel/ActionBar) only actually renders in
  // these states — reserving its height unconditionally wasted a big chunk
  // of a phone's screen (table pinned small under the HUD) the rest of the
  // time, e.g. before sitting down at all.
  const dockVisible = Boolean(
    (mySeatsAwaitingBet.length > 0 && (table.phase === "idle" || table.phase === "betting")) ||
      (isMyTurn && activeHand && table.activeSeat)
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Letterbox filler behind the contained photo — visible as side
          margins on wide/desktop screens where the tall photo can't fill
          the full width without distorting. */}
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

      {/* Sits below the HUD row instead of overlapping it — on a narrow
          phone the HUD's balance/bonus pill wraps to two lines and reaches
          down far enough to collide with this if it sits at the same
          top offset used on desktop. Width is capped and centered text
          truncates instead of spilling under the HUD pills either side. */}
      <div className="absolute top-20 sm:top-16 left-1/2 -translate-x-1/2 z-10 w-[70vw] sm:w-auto text-center">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.3em] whitespace-nowrap" style={{ color: "var(--cream-dim)" }}>
          {PHASE_LABEL[table.phase] ?? ""} · Manche {table.roundNumber}
        </span>
      </div>

      {/* The whole table scene is locked to the background photo's own
          aspect ratio (contain-fit, never stretched/cropped) — every
          seat/card position is tuned as a percentage of THIS photo, so
          distorting it would throw every one of them off. Anchored to the
          top (not vertically centered) so it sits just under the HUD
          instead of floating with a dead gap above and below it. Bottom
          padding on mobile reserves room for the fixed control dock
          (BetPanel/ActionBar) docked to the viewport there. */}
      <div
        ref={outerRef}
        className={`absolute inset-0 flex items-start sm:items-center justify-center p-3 pt-24 sm:pt-3 ${
          dockVisible ? "pb-[172px] sm:pb-3" : "pb-3"
        }`}
      >
        <div className="relative" style={{ width: stageWidth || "100%", height: stageHeight || "100%" }}>
          {stageWidth > 0 && (
            <Image
              src="/images/table-bg.png"
              alt=""
              fill
              priority
              className="object-contain pointer-events-none select-none rounded-2xl"
              sizes="100vw"
            />
          )}

          {/* Scaled scene: fixed-px sizing throughout (seats, cards)
              rendered at the reference canvas size, then scaled as one unit
              to fit the live stage — this is what keeps everything a sane,
              proportionate size on a small phone instead of overlapping. */}
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: REF_WIDTH, height: refHeight, transform: `scale(${scale})` }}
          >
            <div
              className="absolute -translate-x-1/2 flex gap-1 -space-x-6"
              style={{ left: `${DEALER_POS.x}%`, top: `${DEALER_POS.y}%` }}
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
