import { randomUUID } from "crypto";
import { Shoe, handValue, isBust } from "./engine/deck";
import { payoutFor } from "./engine/payout";
import { store } from "./store";
import {
  MAX_BET,
  MIN_BET,
  SEAT_COUNT,
  type Card,
  type HandResult,
  type HandState,
  type RoundResultEntry,
  type SeatState,
  type TableState,
} from "@/lib/types";

const BETTING_WINDOW_MS = 20_000;
const TURN_TIMEOUT_MS = 20_000;
const DEAL_STEP_MS = 450;
const REVEAL_STEP_MS = 700;
const PAYOUT_LINGER_MS = 3_500;

type DealTarget = { seatNumber: number | "dealer"; handIndex: number };

export interface GameManagerCallbacks {
  onTableUpdate(table: TableState): void;
  onDealCard(target: DealTarget, card: Card, order: number): void;
  onRoundResult(results: RoundResultEntry[]): void;
  onPlayerChanged(playerId: string): void;
}

function emptySeat(seatNumber: number): SeatState {
  return {
    seatNumber,
    status: "empty",
    playerId: null,
    pseudo: null,
    hands: [],
    activeHandIndex: 0,
  };
}

export class GameManager {
  private shoe = new Shoe();
  private table: TableState;
  private bettingTimer: NodeJS.Timeout | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  private dealOrder = 0;

  constructor(private cb: GameManagerCallbacks) {
    this.table = {
      id: "table-1",
      phase: "idle",
      seats: Array.from({ length: SEAT_COUNT }, (_, i) => emptySeat(i + 1)),
      dealer: { cards: [], holeCardRevealed: false, total: null },
      roundNumber: 0,
      activeSeat: null,
      activeHandIndex: 0,
      turnDeadline: null,
      shoeCardsRemaining: this.shoe.remaining,
    };
  }

  getTable(): TableState {
    return this.table;
  }

  // ---------- seating ----------

  sit(seatNumber: number, playerId: string, pseudo: string) {
    const seat = this.seat(seatNumber);
    if (this.table.phase !== "idle" && this.table.phase !== "betting") {
      throw new Error("La manche est en cours, attendez la prochaine mise.");
    }
    if (seat.status !== "empty") throw new Error("Cette place est déjà occupée.");
    seat.status = "reserved";
    seat.playerId = playerId;
    seat.pseudo = pseudo;
    seat.hands = [];
    this.publish();
  }

  leaveSeat(seatNumber: number, playerId: string) {
    const seat = this.seat(seatNumber);
    if (seat.playerId !== playerId) throw new Error("Place non assignée à ce joueur.");
    if (seat.status === "betting" && seat.hands[0]?.bet) {
      store.adjustBalance(playerId, seat.hands[0].bet);
      this.cb.onPlayerChanged(playerId);
    }
    Object.assign(seat, emptySeat(seatNumber));
    this.publish();
  }

  // ---------- betting ----------

  placeBet(seatNumber: number, playerId: string, amount: number) {
    const seat = this.seat(seatNumber);
    if (seat.playerId !== playerId) throw new Error("Place non assignée à ce joueur.");
    if (this.table.phase !== "idle" && this.table.phase !== "betting") {
      throw new Error("Les mises sont fermées pour cette manche.");
    }
    if (amount < MIN_BET || amount > MAX_BET) {
      throw new Error(`La mise doit être entre ${MIN_BET} et ${MAX_BET}.`);
    }
    const player = store.getById(playerId);
    if (!player || player.balance < amount) throw new Error("Solde insuffisant.");

    store.adjustBalance(playerId, -amount);
    this.cb.onPlayerChanged(playerId);

    seat.status = "betting";
    seat.hands = [
      {
        id: randomUUID(),
        cards: [],
        bet: amount,
        isSplitAce: false,
        isSplit: false,
        doubled: false,
        status: "active",
        result: null,
        payout: 0,
      },
    ];

    if (this.table.phase === "idle") this.table.phase = "betting";
    this.publish();
    this.scheduleBettingWindow();
  }

  clearBet(seatNumber: number, playerId: string) {
    const seat = this.seat(seatNumber);
    if (seat.playerId !== playerId) throw new Error("Place non assignée à ce joueur.");
    if (seat.status !== "betting") return;
    const refund = seat.hands[0]?.bet ?? 0;
    if (refund > 0) {
      store.adjustBalance(playerId, refund);
      this.cb.onPlayerChanged(playerId);
    }
    seat.status = "reserved";
    seat.hands = [];
    this.publish();
  }

  private scheduleBettingWindow() {
    if (this.bettingTimer) return; // already counting down
    this.table.turnDeadline = Date.now() + BETTING_WINDOW_MS;
    this.publish();
    this.bettingTimer = setTimeout(() => {
      this.bettingTimer = null;
      this.table.turnDeadline = null;
      void this.startRound();
    }, BETTING_WINDOW_MS);
  }

  // ---------- round flow ----------

  private activeSeats(): SeatState[] {
    return this.table.seats.filter((s) => s.status === "betting" && s.hands.length > 0);
  }

  private async startRound() {
    const seats = this.activeSeats();
    if (seats.length === 0) {
      this.table.phase = "idle";
      this.publish();
      return;
    }

    this.table.phase = "dealing";
    this.table.roundNumber += 1;
    this.table.dealer = { cards: [], holeCardRevealed: false, total: null };
    for (const s of seats) s.status = "playing";
    this.dealOrder = 0;
    this.publish();

    // Pass 1: one card to each active seat, left to right.
    for (const seat of seats) {
      await this.dealTo(seat, 0);
    }
    // Pass 2: second card to each active seat, left to right.
    for (const seat of seats) {
      await this.dealTo(seat, 0);
    }
    // Dealer's single up-card (European rule: hole card comes later).
    await this.dealToDealer();

    // Mark two-card 21s as already settled-pending (no further action).
    for (const seat of seats) {
      const hand = seat.hands[0];
      if (handValue(hand.cards).isBlackjack) hand.status = "stood";
    }

    await this.runPlayerTurns(seats);
    await this.dealerTurn(seats);
    await this.settleRound(seats);
  }

  private async dealTo(seat: SeatState, handIndex: number) {
    const card = this.shoe.draw();
    seat.hands[handIndex].cards.push(card);
    this.dealOrder += 1;
    this.table.shoeCardsRemaining = this.shoe.remaining;
    this.cb.onDealCard({ seatNumber: seat.seatNumber, handIndex }, card, this.dealOrder);
    this.publish();
    await delay(DEAL_STEP_MS);
  }

  private async dealToDealer() {
    const card = this.shoe.draw();
    this.table.dealer.cards.push(card);
    this.dealOrder += 1;
    this.table.shoeCardsRemaining = this.shoe.remaining;
    this.cb.onDealCard({ seatNumber: "dealer", handIndex: 0 }, card, this.dealOrder);
    this.publish();
    await delay(DEAL_STEP_MS);
  }

  // ---------- player turns ----------

  private async runPlayerTurns(seats: SeatState[]) {
    this.table.phase = "player_turns";
    for (const seat of seats) {
      for (let h = 0; h < seat.hands.length; h++) {
        await this.playHand(seat, h);
      }
    }
    this.table.activeSeat = null;
    this.table.turnDeadline = null;
    this.publish();
  }

  /** Resolves once the hand at seat/handIndex is stood, bust, or auto-settled. */
  private playHand(seat: SeatState, handIndex: number): Promise<void> {
    return new Promise((resolve) => {
      const hand = seat.hands[handIndex];
      if (hand.status !== "active") {
        resolve();
        return;
      }
      if (hand.isSplitAce) {
        // Single card already dealt by split(); auto-stand, no action window.
        hand.status = "stood";
        this.publish();
        resolve();
        return;
      }

      this.table.activeSeat = seat.seatNumber;
      this.table.activeHandIndex = handIndex;
      this.table.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
      this.publish();

      const finish = () => {
        if (this.turnTimer) {
          clearTimeout(this.turnTimer);
          this.turnTimer = null;
        }
        resolve();
      };

      // Stored so socket-server's action() can resolve this exact turn.
      this.pendingResolve = { seat, handIndex, finish };

      this.turnTimer = setTimeout(() => {
        // Timeout fallback: hit while 16 or below, otherwise stand — mirrors
        // the manual decision a player would make, so an idle hand doesn't
        // arbitrarily bust or walk away from a strong total.
        const { total } = handValue(hand.cards);
        if (total <= 16) {
          this.drawCard(seat, handIndex);
          if (hand.status === "active" && !isBust(hand.cards)) {
            // Keep offering timed decisions until they stand, bust, or hit 17+.
            this.table.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
            this.publish();
            this.turnTimer = setTimeout(() => this.pendingResolve?.finish(), 0);
            return;
          }
        } else {
          hand.status = "stood";
        }
        finish();
      }, TURN_TIMEOUT_MS);
    });
  }

  private pendingResolve: { seat: SeatState; handIndex: number; finish: () => void } | null = null;

  /** Invoked by socket-server when a player clicks an action button. */
  performAction(
    seatNumber: number,
    handIndex: number,
    playerId: string,
    type: "hit" | "stand" | "double" | "split",
  ) {
    const seat = this.seat(seatNumber);
    if (seat.playerId !== playerId) throw new Error("Place non assignée à ce joueur.");
    if (
      !this.pendingResolve ||
      this.pendingResolve.seat.seatNumber !== seatNumber ||
      this.pendingResolve.handIndex !== handIndex
    ) {
      throw new Error("Ce n'est pas votre tour.");
    }
    const hand = seat.hands[handIndex];

    if (type === "hit") {
      this.drawCard(seat, handIndex);
      if (hand.status !== "active") this.resolveTurn();
      else this.resetTurnDeadline();
      return;
    }

    if (type === "stand") {
      hand.status = "stood";
      this.resolveTurn();
      return;
    }

    if (type === "double") {
      if (hand.cards.length !== 2 || hand.doubled) throw new Error("Double impossible.");
      const player = store.getById(playerId);
      if (!player || player.balance < hand.bet) throw new Error("Solde insuffisant pour doubler.");
      store.adjustBalance(playerId, -hand.bet);
      this.cb.onPlayerChanged(playerId);
      hand.bet *= 2;
      hand.doubled = true;
      this.drawCard(seat, handIndex);
      if (hand.status === "active") hand.status = "stood";
      this.resolveTurn();
      return;
    }

    if (type === "split") {
      if (hand.cards.length !== 2 || hand.isSplit || seat.hands.length > 1) {
        throw new Error("Split impossible.");
      }
      const [a, b] = hand.cards;
      if (a.rank !== b.rank) throw new Error("Split impossible : cartes différentes.");
      const player = store.getById(playerId);
      if (!player || player.balance < hand.bet) throw new Error("Solde insuffisant pour diviser.");
      store.adjustBalance(playerId, -hand.bet);
      this.cb.onPlayerChanged(playerId);

      const isAceSplit = a.rank === "A";
      const second: HandState = {
        id: randomUUID(),
        cards: [b],
        bet: hand.bet,
        isSplitAce: isAceSplit,
        isSplit: true,
        doubled: false,
        status: "active",
        result: null,
        payout: 0,
      };
      hand.cards = [a];
      hand.isSplit = true;
      hand.isSplitAce = isAceSplit;
      seat.hands.push(second);

      // Each new hand immediately gets its second card (one each for split
      // aces; the regular hand keeps playing normally afterwards).
      this.drawCard(seat, handIndex);
      this.drawCard(seat, 1);
      if (isAceSplit) {
        hand.status = "stood";
        second.status = "stood";
        this.resolveTurn();
      } else {
        this.resetTurnDeadline();
      }
      return;
    }
  }

  private drawCard(seat: SeatState, handIndex: number) {
    const card = this.shoe.draw();
    const hand = seat.hands[handIndex];
    hand.cards.push(card);
    this.dealOrder += 1;
    this.table.shoeCardsRemaining = this.shoe.remaining;
    this.cb.onDealCard({ seatNumber: seat.seatNumber, handIndex }, card, this.dealOrder);
    if (isBust(hand.cards)) hand.status = "bust";
    this.publish();
  }

  private resetTurnDeadline() {
    this.table.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => this.pendingResolve?.finish(), TURN_TIMEOUT_MS);
    this.publish();
  }

  private resolveTurn() {
    const pending = this.pendingResolve;
    this.pendingResolve = null;
    this.publish();
    pending?.finish();
  }

  // ---------- dealer ----------

  private async dealerTurn(seats: SeatState[]) {
    this.table.phase = "dealer_reveal";
    this.publish();
    await delay(REVEAL_STEP_MS);
    await this.dealToDealer(); // the long-withheld hole card
    this.table.dealer.holeCardRevealed = true;
    this.table.dealer.total = handValue(this.table.dealer.cards).total;
    this.publish();
    await delay(REVEAL_STEP_MS);

    const anyoneLeft = seats.some((s) => s.hands.some((h) => h.status !== "bust"));
    if (!anyoneLeft) return; // table all bust: dealer doesn't need to draw further

    this.table.phase = "dealer_turns";
    while (true) {
      const { total } = handValue(this.table.dealer.cards);
      if (total > 21) break;
      if (total >= 17) break; // dealer stands on all 17s (hard or soft)
      await this.dealToDealer();
      this.table.dealer.total = handValue(this.table.dealer.cards).total;
      this.publish();
      await delay(DEAL_STEP_MS);
    }
    this.table.dealer.total = handValue(this.table.dealer.cards).total;
  }

  // ---------- settlement ----------

  private async settleRound(seats: SeatState[]) {
    this.table.phase = "payout";
    const dealerCards = this.table.dealer.cards;
    const dealerBust = isBust(dealerCards);
    const dealerBlackjack = handValue(dealerCards).isBlackjack;
    const dealerTotal = handValue(dealerCards).total;

    const results: RoundResultEntry[] = [];

    for (const seat of seats) {
      for (let h = 0; h < seat.hands.length; h++) {
        const hand = seat.hands[h];
        const playerBlackjack = !hand.isSplit && handValue(hand.cards).isBlackjack;
        let result: HandResult;

        if (hand.status === "bust") {
          result = "bust";
        } else if (playerBlackjack && dealerBlackjack) {
          result = "push";
        } else if (playerBlackjack) {
          result = "blackjack";
        } else if (dealerBlackjack) {
          result = "lose";
        } else if (dealerBust) {
          result = "win";
        } else {
          const playerTotal = handValue(hand.cards).total;
          if (playerTotal > dealerTotal) result = "win";
          else if (playerTotal < dealerTotal) result = "lose";
          else result = "push";
        }

        hand.result = result;
        hand.status = "done";
        hand.payout = payoutFor(result, hand.bet);

        if (hand.payout > 0 && seat.playerId) {
          store.adjustBalance(seat.playerId, hand.payout);
        }
        if (seat.playerId) {
          const outcome =
            result === "blackjack" ? "blackjack" : result === "win" ? "win" : result === "lose" || result === "bust" ? "lose" : null;
          if (outcome) store.recordHandResult(seat.playerId, outcome);
          this.cb.onPlayerChanged(seat.playerId);
        }

        results.push({
          seatNumber: seat.seatNumber,
          handIndex: h,
          pseudo: seat.pseudo ?? "",
          result,
          payout: hand.payout,
          bet: hand.bet,
        });
      }
    }

    this.publish();
    this.cb.onRoundResult(results);
    await delay(PAYOUT_LINGER_MS);
    this.resetForNextRound(seats);
  }

  private resetForNextRound(seats: SeatState[]) {
    for (const seat of seats) {
      seat.status = "reserved";
      seat.hands = [];
      seat.activeHandIndex = 0;
    }
    // Clear the dealer's hand now, not at the start of the next deal — it
    // must not still be sitting on the table through the next betting
    // window (that reads as "the dealer's cards are already out").
    this.table.dealer = { cards: [], holeCardRevealed: false, total: null };
    this.table.phase = "idle";
    this.table.activeSeat = null;
    this.table.turnDeadline = null;
    this.publish();
  }

  // ---------- helpers ----------

  private seat(seatNumber: number): SeatState {
    const seat = this.table.seats.find((s) => s.seatNumber === seatNumber);
    if (!seat) throw new Error("Place invalide.");
    return seat;
  }

  private publish() {
    this.cb.onTableUpdate(this.table);
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
