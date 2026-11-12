import { MIN_BET, MAX_BET, SEAT_COUNT, type RoomSummary, type TableState } from "@/lib/types";
import { GameManager, type GameManagerCallbacks } from "./game-manager";

export const ROOM_DEFINITIONS = [
  { id: "table-1", name: "Salon Émeraude", description: "La table signature. Prenez place et retrouvez le rythme du casino.", theme: "emerald" },
  { id: "table-2", name: "Salon Ambre", description: "Une autre table, une nouvelle rencontre. Les mêmes règles, votre propre partie.", theme: "amber" },
  { id: "table-3", name: "Salon Minuit", description: "L’atmosphère du soir, une table indépendante pour prolonger la partie.", theme: "midnight" },
] as const;

export class CasinoRooms {
  readonly games = new Map<string, GameManager>();
  constructor(callbacks: (id: string) => GameManagerCallbacks) {
    for (const room of ROOM_DEFINITIONS) this.games.set(room.id, new GameManager(callbacks(room.id), room.id));
  }
  game(id: string) {
    const game = this.games.get(id);
    if (!game) throw new Error("Cette room n’existe pas.");
    return game;
  }
  occupiedRoom(playerId: string): string | undefined {
    return [...this.games].find(([, game]) => game.getTable().seats.some(s => s.playerId === playerId))?.[0];
  }
  summaries(): RoomSummary[] {
    return ROOM_DEFINITIONS.map(room => {
      const table: TableState = this.game(room.id).getTable();
      const occupied = table.seats.filter(s => s.playerId !== null);
      return { ...room, occupiedSeats: occupied.length, capacity: SEAT_COUNT,
        players: new Set(occupied.map(s => s.playerId)).size, phase: table.phase,
        roundNumber: table.roundNumber, minBet: MIN_BET, maxBet: MAX_BET };
    });
  }
  releaseForSwitch(playerId: string, targetId: string) {
    this.game(targetId);
    const oldId = this.occupiedRoom(playerId);
    if (!oldId || oldId === targetId) return;
    const game = this.game(oldId), table = game.getTable();
    const seats = table.seats.filter(s => s.playerId === playerId);
    if (table.phase !== "idle" && table.phase !== "betting" && seats.some(s => s.hands.length > 0)) {
      throw new Error("Terminez votre manche avant de changer de room.");
    }
    for (const seat of seats) game.leaveSeat(seat.seatNumber, playerId);
  }
}
