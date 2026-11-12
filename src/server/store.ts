import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { HOURLY_BONUS, HOURLY_BONUS_INTERVAL_MS, STARTING_BALANCE } from "@/lib/types";

export interface PlayerRecord {
  id: string;
  pseudo: string;
  deviceTokenHash: string;
  balance: number;
  createdAt: number;
  lastSeen: number;
  totalWins: number;
  totalLosses: number;
  totalBlackjacks: number;
  lastBonusAt: number;
}
export interface BonusCreditLog { id: string; playerId: string; amount: number; creditedAt: number }

/** One authoritative database, including offline bonuses and interrupted bets. */
export class PlayerStore {
  private db: DatabaseSync;
  constructor(path = ":memory:", private now: () => number = Date.now) {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, pseudo TEXT NOT NULL, deviceTokenHash TEXT UNIQUE NOT NULL,
        balance INTEGER NOT NULL CHECK(balance >= 0), createdAt INTEGER NOT NULL,
        lastSeen INTEGER NOT NULL, totalWins INTEGER NOT NULL DEFAULT 0,
        totalLosses INTEGER NOT NULL DEFAULT 0, totalBlackjacks INTEGER NOT NULL DEFAULT 0,
        lastBonusAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bonus_credits (
        id TEXT PRIMARY KEY, playerId TEXT NOT NULL, amount INTEGER NOT NULL, creditedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bonus_player ON bonus_credits(playerId);
      CREATE TABLE IF NOT EXISTS pending_bets (
        id TEXT PRIMARY KEY, playerId TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0)
      );`);
    // Tables are process-local: a restart refunds every unsettled reservation.
    this.transaction(() => {
      for (const row of this.db.prepare("SELECT playerId, SUM(amount) AS amount FROM pending_bets GROUP BY playerId").all()) {
        this.db.prepare("UPDATE players SET balance=balance+? WHERE id=?").run(row.amount, row.playerId);
      }
      this.db.exec("DELETE FROM pending_bets");
    });
    this.runBonusSweep();
  }
  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private read(id: string): PlayerRecord | undefined {
    return this.db.prepare("SELECT * FROM players WHERE id=?").get(id) as unknown as PlayerRecord | undefined;
  }
  private credit(id: string) {
    const initial = this.read(id);
    if (!initial || this.now() - initial.lastBonusAt < HOURLY_BONUS_INTERVAL_MS) return;
    this.transaction(() => {
      const player = this.read(id);
      if (!player) return;
      const hours = Math.max(0, Math.floor((this.now() - player.lastBonusAt) / HOURLY_BONUS_INTERVAL_MS));
      if (!hours) return;
      const amount = hours * HOURLY_BONUS;
      const creditedAt = player.lastBonusAt + hours * HOURLY_BONUS_INTERVAL_MS;
      this.db.prepare("UPDATE players SET balance=balance+?, lastBonusAt=? WHERE id=?").run(amount, creditedAt, id);
      this.db.prepare("INSERT INTO bonus_credits VALUES(?,?,?,?)").run(randomUUID(), id, amount, creditedAt);
    });
  }
  getByDeviceToken(token: string): PlayerRecord | undefined {
    const hash = createHash("sha256").update(token).digest("hex");
    const row = this.db.prepare("SELECT id FROM players WHERE deviceTokenHash=?").get(hash);
    return row ? this.getById(String(row.id)) : undefined;
  }
  getById(id: string): PlayerRecord | undefined { this.credit(id); return this.read(id); }
  createPlayer(pseudo: string, token: string): PlayerRecord {
    const id = randomUUID(), now = this.now();
    this.db.prepare("INSERT INTO players(id,pseudo,deviceTokenHash,balance,createdAt,lastSeen,lastBonusAt) VALUES(?,?,?,?,?,?,?)")
      .run(id, sanitizePseudo(pseudo), createHash("sha256").update(token).digest("hex"), STARTING_BALANCE, now, now, now);
    return this.read(id)!;
  }
  touchLastSeen(id: string) { this.db.prepare("UPDATE players SET lastSeen=? WHERE id=?").run(this.now(), id); }
  renamePseudo(id: string, pseudo: string) { this.db.prepare("UPDATE players SET pseudo=? WHERE id=?").run(sanitizePseudo(pseudo), id); }
  adjustBalance(id: string, delta: number): PlayerRecord {
    if (!Number.isSafeInteger(delta)) throw new Error("Montant invalide.");
    this.credit(id);
    const row = this.db.prepare("UPDATE players SET balance=balance+? WHERE id=? AND balance+?>=0 RETURNING *").get(delta, id, delta);
    if (!row) throw new Error("Solde insuffisant ou compte introuvable.");
    return row as unknown as PlayerRecord;
  }
  reserveBet(playerId: string, id: string, amount: number) {
    this.credit(playerId);
    this.transaction(() => {
      const row = this.db.prepare("UPDATE players SET balance=balance-? WHERE id=? AND balance>=? RETURNING id").get(amount, playerId, amount);
      if (!row) throw new Error("Solde insuffisant.");
      this.db.prepare("INSERT INTO pending_bets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET amount=amount+excluded.amount").run(id, playerId, amount);
    });
  }
  refundBet(playerId: string, id: string) {
    this.transaction(() => {
      const row = this.db.prepare("SELECT amount FROM pending_bets WHERE id=? AND playerId=?").get(id, playerId);
      if (!row) return;
      this.db.prepare("UPDATE players SET balance=balance+? WHERE id=?").run(row.amount, playerId);
      this.db.prepare("DELETE FROM pending_bets WHERE id=? AND playerId=?").run(id, playerId);
    });
  }
  settleBet(playerId: string, id: string, payout: number) {
    this.transaction(() => {
      const row = this.db.prepare("SELECT id FROM pending_bets WHERE id=? AND playerId=?").get(id, playerId);
      if (!row) throw new Error("Mise déjà réglée ou introuvable.");
      this.db.prepare("UPDATE players SET balance=balance+? WHERE id=?").run(payout, playerId);
      this.db.prepare("DELETE FROM pending_bets WHERE id=? AND playerId=?").run(id, playerId);
    });
  }
  recordHandResult(id: string, outcome: "win" | "lose" | "blackjack" | "push") {
    this.db.prepare("UPDATE players SET totalWins=totalWins+?,totalLosses=totalLosses+?,totalBlackjacks=totalBlackjacks+? WHERE id=?")
      .run(outcome === "win" || outcome === "blackjack" ? 1 : 0, outcome === "lose" ? 1 : 0, outcome === "blackjack" ? 1 : 0, id);
  }
  runBonusSweep() { for (const row of this.db.prepare("SELECT id FROM players WHERE lastBonusAt<=?").all(this.now() - HOURLY_BONUS_INTERVAL_MS)) this.credit(String(row.id)); }
  nextBonusAt(id: string): number { return (this.getById(id)?.lastBonusAt ?? this.now()) + HOURLY_BONUS_INTERVAL_MS; }
  bonusHistory(id: string): BonusCreditLog[] {
    return this.db.prepare("SELECT * FROM bonus_credits WHERE playerId=? ORDER BY creditedAt DESC LIMIT 50").all(id) as unknown as BonusCreditLog[];
  }
  close() { this.db.close(); }
}
function sanitizePseudo(raw: string) { return raw.trim().slice(0, 16) || "JOUEUR"; }
export const store = new PlayerStore(process.env.TABLE21_DATABASE_PATH || resolve("data/table21.sqlite"));
setInterval(() => store.runBonusSweep(), 60_000).unref();
