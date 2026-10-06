// In-memory persistence layer, deliberately shaped like the future Supabase
// schema (see supabase/migrations/0001_init.sql) so swapping the
// implementation later doesn't change any call site in game-manager.ts or
// socket-server.ts — only this file gets replaced by Supabase queries.

import { randomUUID } from "crypto";
import { HOURLY_BONUS, HOURLY_BONUS_INTERVAL_MS, STARTING_BALANCE } from "@/lib/types";

export interface PlayerRecord {
  id: string;
  pseudo: string;
  deviceToken: string;
  balance: number;
  createdAt: number;
  lastSeen: number;
  totalWins: number;
  totalLosses: number;
  totalBlackjacks: number;
  /** epoch ms of the last hourly-bonus credit; drives nextBonusAt. */
  lastBonusAt: number;
}

export interface BonusCreditLog {
  id: string;
  playerId: string;
  amount: number;
  creditedAt: number;
}

class MemoryStore {
  private players = new Map<string, PlayerRecord>(); // id -> record
  private byDeviceToken = new Map<string, string>(); // deviceToken -> id
  private bonusLog: BonusCreditLog[] = [];

  getByDeviceToken(deviceToken: string): PlayerRecord | undefined {
    const id = this.byDeviceToken.get(deviceToken);
    return id ? this.players.get(id) : undefined;
  }

  getById(id: string): PlayerRecord | undefined {
    return this.players.get(id);
  }

  createPlayer(pseudo: string, deviceToken: string): PlayerRecord {
    const now = Date.now();
    const record: PlayerRecord = {
      id: randomUUID(),
      pseudo: sanitizePseudo(pseudo),
      deviceToken,
      balance: STARTING_BALANCE,
      createdAt: now,
      lastSeen: now,
      totalWins: 0,
      totalLosses: 0,
      totalBlackjacks: 0,
      lastBonusAt: now,
    };
    this.players.set(record.id, record);
    this.byDeviceToken.set(deviceToken, record.id);
    return record;
  }

  touchLastSeen(id: string) {
    const p = this.players.get(id);
    if (p) p.lastSeen = Date.now();
  }

  renamePseudo(id: string, pseudo: string) {
    const p = this.players.get(id);
    if (p) p.pseudo = sanitizePseudo(pseudo);
  }

  /** Atomically adjusts balance; throws if it would go negative. */
  adjustBalance(id: string, delta: number): PlayerRecord {
    const p = this.players.get(id);
    if (!p) throw new Error("Unknown player");
    const next = p.balance + delta;
    if (next < 0) throw new Error("Insufficient balance");
    p.balance = next;
    return p;
  }

  recordHandResult(id: string, outcome: "win" | "lose" | "blackjack" | "push") {
    const p = this.players.get(id);
    if (!p) return;
    if (outcome === "win") p.totalWins += 1;
    else if (outcome === "lose") p.totalLosses += 1;
    else if (outcome === "blackjack") {
      p.totalWins += 1;
      p.totalBlackjacks += 1;
    }
  }

  /**
   * Credits every player whose hourly bonus is due, using server time only
   * (never trusting any client-supplied timestamp). Idempotent: calling it
   * repeatedly only ever credits once per elapsed hour per player.
   */
  runBonusSweep(): void {
    const now = Date.now();
    for (const p of this.players.values()) {
      while (now - p.lastBonusAt >= HOURLY_BONUS_INTERVAL_MS) {
        p.lastBonusAt += HOURLY_BONUS_INTERVAL_MS;
        p.balance += HOURLY_BONUS;
        this.bonusLog.push({
          id: randomUUID(),
          playerId: p.id,
          amount: HOURLY_BONUS,
          creditedAt: p.lastBonusAt,
        });
      }
    }
  }

  nextBonusAt(id: string): number {
    const p = this.players.get(id);
    if (!p) return Date.now() + HOURLY_BONUS_INTERVAL_MS;
    return p.lastBonusAt + HOURLY_BONUS_INTERVAL_MS;
  }

  bonusHistory(playerId: string): BonusCreditLog[] {
    return this.bonusLog.filter((b) => b.playerId === playerId);
  }
}

function sanitizePseudo(raw: string): string {
  const trimmed = raw.trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "JOUEUR";
}

// Singleton: one process, one in-memory world. Fine for a single Next.js
// custom server instance; a Supabase-backed implementation removes this
// constraint since state lives outside the process.
export const store = new MemoryStore();

// Sweep every minute so bonuses land close to on-time without needing a
// request to trigger them.
setInterval(() => store.runBonusSweep(), 60_000);
