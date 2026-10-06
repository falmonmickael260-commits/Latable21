// Shared types between server (authoritative) and client (presentation only).
// The client never computes game outcomes — every type here mirrors what the
// server decides and broadcasts.

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  /** Unique id so the UI can key animations even across shuffles. */
  id: string;
}

export const SEAT_COUNT = 7;
export const MIN_BET = 100;
export const MAX_BET = 500;
export const STARTING_BALANCE = 3000;
export const HOURLY_BONUS = 3000;
export const HOURLY_BONUS_INTERVAL_MS = 60 * 60 * 1000;

export type SeatStatus =
  | "empty"
  | "reserved" // seat claimed, waiting for bet before round starts
  | "betting"
  | "playing"
  | "done";

export type HandResult = "blackjack" | "win" | "lose" | "push" | "bust" | null;

export interface HandState {
  id: string;
  cards: Card[];
  bet: number;
  /** true once this hand is a split hand that came from splitting aces (1 card only, auto-stand). */
  isSplitAce: boolean;
  isSplit: boolean;
  doubled: boolean;
  status: "active" | "stood" | "bust" | "done";
  result: HandResult;
  payout: number;
}

export interface SeatState {
  seatNumber: number; // 1..7
  status: SeatStatus;
  playerId: string | null;
  pseudo: string | null;
  /** A player may occupy several seats; each seat holds its own hand(s). */
  hands: HandState[];
  /** Index of the hand currently acting, for split hands. */
  activeHandIndex: number;
}

export type RoundPhase =
  | "betting"
  | "dealing"
  | "player_turns"
  | "dealer_reveal"
  | "dealer_turns"
  | "payout"
  | "idle";

export interface DealerState {
  cards: Card[];
  /** second card hidden until dealer_reveal phase */
  holeCardRevealed: boolean;
  total: number | null;
}

export interface TableState {
  id: string;
  phase: RoundPhase;
  seats: SeatState[];
  dealer: DealerState;
  roundNumber: number;
  /** seat number currently acting during player_turns, or null */
  activeSeat: number | null;
  activeHandIndex: number;
  /** ms timestamp when the active seat's turn timer expires */
  turnDeadline: number | null;
  shoeCardsRemaining: number;
}

export interface PlayerPublic {
  id: string;
  pseudo: string;
  balance: number;
  nextBonusAt: number; // epoch ms
  totalWins: number;
  totalLosses: number;
  totalBlackjacks: number;
}

// ---------- Socket.io event contracts ----------

export interface ClientToServerEvents {
  identify: (payload: { pseudo?: string; deviceToken?: string }) => void;
  sit: (payload: { seatNumber: number }) => void;
  leaveSeat: (payload: { seatNumber: number }) => void;
  placeBet: (payload: { seatNumber: number; amount: number }) => void;
  clearBet: (payload: { seatNumber: number }) => void;
  action: (payload: {
    seatNumber: number;
    handIndex: number;
    type: "hit" | "stand" | "double" | "split";
  }) => void;
}

export interface ServerToClientEvents {
  identified: (payload: { player: PlayerPublic; deviceToken: string }) => void;
  playerUpdate: (payload: { player: PlayerPublic }) => void;
  tableState: (payload: { table: TableState }) => void;
  dealAnimation: (payload: { seatNumber: number | "dealer"; handIndex: number; card: Card; order: number }) => void;
  roundResult: (payload: { results: RoundResultEntry[] }) => void;
  error: (payload: { message: string }) => void;
}

export interface RoundResultEntry {
  seatNumber: number;
  handIndex: number;
  pseudo: string;
  result: HandResult;
  payout: number;
  bet: number;
}
