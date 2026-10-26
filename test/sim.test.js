import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/js/game/world.js";
import { Terrain } from "../public/js/game/terrain.js";
import { DEFAULT_SETTINGS } from "../public/js/game/settings.js";
import { WORM_R } from "../public/js/game/const.js";

const players = [
  { id: "a", name: "Anna", color: 0, team: { name: "Rot", worms: ["A1", "A2"] } },
  { id: "b", name: "Ben", color: 1, team: { name: "Blau", worms: ["B1", "B2"] } },
];

function idle() {
  return { pressed: {} };
}

function makeWorld(overrides = {}) {
  return World.create({ settings: { ...DEFAULT_SETTINGS, worms: 2, mines: 0, barrels: 0, crates: "aus", ...overrides }, players, seed: 1234 });
}

function runUntil(world, cond, max = 6000, input = idle) {
  for (let i = 0; i < max; i++) {
    if (cond()) return i;
    world.step(input(i));
  }
  throw new Error("Bedingung nicht erreicht");
}

test("Terrain-Kodierung ist verlustfrei", () => {
  const t = new Terrain(50, 30);
  for (let i = 0; i < t.mask.length; i++) t.mask[i] = (i * 7919) % 13 < 5 ? 1 : 0;
  const back = Terrain.decode(50, 30, t.encode());
  assert.deepEqual(back.mask, t.mask);
});

test("Würmer stehen nach dem Start auf festem Boden", () => {
  const world = makeWorld();
  const worms = world.worms();
  assert.equal(worms.length, 4);
  for (const w of worms) {
    assert.equal(world.terrain.circleHits(w.x, w.y, WORM_R), false, "Wurm steckt im Boden");
    assert.equal(world.terrain.circleHits(w.x, w.y + 2, WORM_R), true, "Wurm schwebt");
  }
  for (let i = 0; i < 120; i++) world.step(null);
  for (const w of world.worms()) assert.equal(w.mode, "stand");
});

test("Zug endet nach Ablauf der Zeit und das andere Team ist dran", () => {
  const world = makeWorld({ turnTime: 2 });
  const first = world.turn.team;
  runUntil(world, () => world.turn.seq === 2);
  assert.notEqual(world.turn.team, first);
  assert.equal(world.turn.phase, "play");
});

test("Bazooka-Treffer verursacht Schaden und beendet den Zug", () => {
  const world = makeWorld();
  const me = world.activeWorm();
  const enemy = world.worms().find((w) => w.team !== me.team);
  // Gegner direkt neben den aktiven Wurm stellen, dazwischen freie Luft
  me.x = 400; me.y = 300; enemy.x = 470; enemy.y = 300;
  world.terrain.mask.fill(0);
  for (let y = 308; y < 330; y++) for (let x = 300; x < 600; x++) world.terrain.mask[y * world.w + x] = 1;
  me.y = 300; enemy.y = 300;
  me.face = 1; me.aim = 0;
  world.turn.weapon = "bazooka";
  const hp = enemy.hp;
  let i = 0;
  runUntil(world, () => world.turn.phase !== "play", 300, () => {
    i++;
    if (i === 1) return { fire: true, pressed: { fire: true } };
    if (i < 30) return { fire: true, pressed: {} };
    return idle();
  });
  runUntil(world, () => enemy.hp < hp, 300);
  assert.ok(enemy.hp < hp, "Gegner hat keinen Schaden genommen");
});

test("Checkpoint und Delta-Updates ergeben denselben Zustand", () => {
  const world = makeWorld();
  const copy = World.fromCheckpoint(JSON.parse(JSON.stringify(world.toCheckpoint())));
  const cache = { ents: new Map() };
  let i = 0;
  const input = () => {
    i++;
    if (i === 10) return { fire: true, pressed: { fire: true } };
    if (i < 40) return { fire: true, right: true, pressed: {} };
    return idle();
  };
  for (let k = 0; k < 900; k++) {
    world.step(input());
    if (k % 2 === 0) {
      const msg = world.makeDelta(cache);
      if (msg) copy.applyDelta(JSON.parse(msg));
    }
  }
  const msg = world.makeDelta(cache);
  if (msg) copy.applyDelta(JSON.parse(msg));
  assert.equal(copy.terrain.encode(), world.terrain.encode());
  assert.equal(copy.turn.seq, world.turn.seq);
  for (const e of world.ents.values()) {
    const c = copy.ents.get(e.id);
    assert.ok(c, `Entität ${e.id} fehlt`);
    assert.ok(Math.abs(c.x - e.x) < 0.01 && Math.abs(c.y - e.y) < 0.01);
  }
});

test("Spiel endet, wenn nur noch ein Team lebt", () => {
  const world = makeWorld();
  for (const w of world.worms()) if (w.team === 1) w.hp = 0;
  world.endTurn();
  runUntil(world, () => world.turn.phase === "over", 3000);
  assert.equal(world.turn.winner, 0);
  assert.equal(world.worms().filter((w) => w.dead).length, 2);
});

test("Alle Waffen lassen sich abfeuern, ohne dass etwas abstürzt", async () => {
  const { WEAPONS } = await import("../public/js/game/weapons.js");
  for (const wp of WEAPONS) {
    const world = makeWorld({ turnTime: 10, ammo: Object.fromEntries(WEAPONS.map((w) => [w.id, -1])) });
    world.turn.weapon = wp.id;
    const me = world.activeWorm();
    let i = 0;
    const input = () => {
      i++;
      const click = wp.target && i === 2 ? { x: me.x + 60, y: me.y - 80 } : null;
      if (i === 2) return { fire: true, pressed: { fire: true }, click, up: true };
      if (i < 25) return { fire: true, pressed: {}, right: wp.util, up: wp.id === "jetpack" };
      if (i === 40 || i === 80) return { pressed: { fire: true } };
      return idle();
    };
    for (let k = 0; k < 2400; k++) world.step(input());
    assert.ok(world.turn.seq >= 2 || world.turn.phase === "over", `${wp.id}: Zug ist nicht weitergegangen`);
  }
});

test("Sudden Death lässt das Wasser steigen", () => {
  const world = makeWorld({ sdMinutes: 5, waterRise: "schnell" });
  world.gameTime = 5 * 3600;
  const water = world.water;
  world.endTurn();
  runUntil(world, () => world.turn.seq === 2, 3000);
  assert.equal(world.sd, true);
  assert.ok(world.water <= water - 50, `Wasser ist nicht gestiegen (${water} → ${world.water})`);
});

test("Ölfass explodiert bei Treffer und hinterlässt Feuer", () => {
  const world = makeWorld();
  const barrel = world.spawn({ type: "barrel", x: 600, y: 300, vx: 0, vy: 0, hp: 40, rest: true });
  world.terrain.mask.fill(0);
  for (let y = 308; y < 330; y++) for (let x = 500; x < 700; x++) world.terrain.mask[y * world.w + x] = 1;
  world.explode(610, 300, 30, 50);
  world.step(null);
  assert.equal(world.ents.has(barrel.id), false);
  assert.ok([...world.ents.values()].some((e) => e.type === "fire"));
});

test("Kiste wird vom aktiven Wurm eingesammelt", () => {
  const world = makeWorld();
  const w = world.activeWorm();
  const hp = w.hp;
  world.spawn({ type: "crate", kind: "health", x: w.x + 5, y: w.y, vx: 0, vy: 0, chute: false });
  world.step(null);
  assert.equal(w.hp, hp + world.settings.crateHealth);
});

test("Bungee fängt den Wurm an einer Kante auf", () => {
  const world = makeWorld({ fallDamage: true });
  const t = world.terrain;
  t.mask.fill(0);
  for (let y = 300; y < 320; y++) for (let x = 300; x < 500; x++) t.mask[y * world.w + x] = 1;
  const w = world.activeWorm();
  w.x = 490; w.y = 300 - WORM_R - 0.5; w.mode = "stand"; w.face = 1;
  world.turn.weapon = "bungee";
  world.teams[world.turn.team].ammo.bungee = 1;
  world.step({ fire: true, pressed: { fire: true } });
  assert.equal(world.turn.bungee, true);
  for (let i = 0; i < 60 && w.mode !== "bungee"; i++) world.step({ right: true, pressed: {} });
  assert.equal(w.mode, "bungee");
  for (let i = 0; i < 300; i++) world.step({ pressed: {} });
  assert.equal(w.hp, world.settings.hp, "Bungee-Wurm hat Schaden genommen");
  assert.ok(w.y < 420, "Wurm hängt nicht am Seil");
});
