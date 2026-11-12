import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlayerStore } from "../src/server/store";
const HOUR = 3600000;

test("hourly credit is exact, automatic and never duplicated", () => {
  let now = 1000000;
  const db = new PlayerStore(":memory:", () => now);
  const player = db.createPlayer("Horloge", randomUUID());
  now += HOUR - 1;
  db.runBonusSweep();
  assert.equal(db.getById(player.id)!.balance, 3000);
  now++;
  db.runBonusSweep(); db.runBonusSweep();
  assert.equal(db.getById(player.id)!.balance, 6000);
  assert.equal(db.bonusHistory(player.id).length, 1);
  assert.equal(db.nextBonusAt(player.id), 1000000 + 2 * HOUR);
  db.close();
});

test("three offline hours are caught up once and keep the original hourly anchor", () => {
  let now = 1000000;
  const db = new PlayerStore(":memory:", () => now);
  const token = randomUUID(), player = db.createPlayer("Absence", token);
  now += 3 * HOUR + 10000;
  assert.equal(db.getByDeviceToken(token)!.balance, 12000);
  assert.equal(db.getByDeviceToken(token)!.balance, 12000);
  assert.equal(db.nextBonusAt(player.id), 1000000 + 4 * HOUR);
  assert.equal(db.bonusHistory(player.id)[0].amount, 9000);
  db.close();
});

test("gains, statistics and device account survive a database restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "table21-account-"));
  const path = join(dir, "wallet.sqlite"); let now = 1000000;
  const token = randomUUID();
  try {
    let db = new PlayerStore(path, () => now);
    const player = db.createPlayer("Mickael", token);
    db.reserveBet(player.id, "test-hand", 100);
    db.settleBet(player.id, "test-hand", 250);
    db.recordHandResult(player.id, "blackjack");
    assert.equal(db.getById(player.id)!.balance, 3150);
    db.close(); now += 2 * HOUR;
    db = new PlayerStore(path, () => now);
    const restored = db.getByDeviceToken(token)!;
    assert.equal(restored.id, player.id);
    assert.equal(restored.balance, 9150);
    assert.equal(restored.totalBlackjacks, 1);
    assert.equal(restored.totalWins, 1);
    assert.equal(db.getByDeviceToken(token)!.balance, 9150);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("interrupted bets are refunded once after a restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "table21-bets-")), path = join(dir, "wallet.sqlite");
  try {
    let db = new PlayerStore(path); const token = randomUUID(), player = db.createPlayer("Retour", token);
    db.reserveBet(player.id, "unfinished", 500);
    assert.equal(db.getById(player.id)!.balance, 2500); db.close();
    db = new PlayerStore(path);
    assert.equal(db.getByDeviceToken(token)!.balance, 3000); db.close();
    db = new PlayerStore(path);
    assert.equal(db.getByDeviceToken(token)!.balance, 3000); db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a bet cannot be paid twice and bonuses do not interfere with an active bet", () => {
  let now = 1000000; const db = new PlayerStore(":memory:", () => now), player = db.createPlayer("Partie", randomUUID());
  db.reserveBet(player.id, "active", 200); now += HOUR;
  db.runBonusSweep(); assert.equal(db.getById(player.id)!.balance, 5800);
  db.settleBet(player.id, "active", 400); assert.equal(db.getById(player.id)!.balance, 6200);
  assert.throws(() => db.settleBet(player.id, "active", 400));
  assert.equal(db.getById(player.id)!.balance, 6200);
  db.close();
});
