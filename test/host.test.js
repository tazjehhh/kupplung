import { test } from "node:test";
import assert from "node:assert/strict";
import { HostRoom } from "../public/js/host.js";

// Verbindung, die alle empfangenen Nachrichten mitschreibt
function fakeConn() {
  return {
    msgs: [],
    closed: false,
    send(text) {
      this.msgs.push(JSON.parse(text));
    },
    close() {
      this.closed = true;
    },
    last(t) {
      return [...this.msgs].reverse().find((m) => m.t === t);
    },
  };
}

function join(room, pid, name = pid) {
  const conn = fakeConn();
  room.attach(conn);
  room.receive(conn, JSON.stringify({ t: "hello", pid, name, team: { name: `Team ${name}`, worms: ["a", "b"] } }));
  return conn;
}

test("Lobby: Spieler kommen dazu, bekommen eigene Farben und der Gastgeber bleibt Host", () => {
  const room = new HostRoom("host");
  const h = join(room, "host");
  const a = join(room, "a");
  const r = a.last("room").room;
  assert.equal(r.host, "host");
  assert.equal(r.players.length, 2);
  assert.notEqual(r.players[0].color, r.players[1].color);
  assert.ok(h.last("room").room.players.every((p) => p.on));
});

test("Nur der Host darf Einstellungen ändern und starten", () => {
  const room = new HostRoom("host");
  const h = join(room, "host");
  const a = join(room, "a");
  room.receive(a, JSON.stringify({ t: "settings", settings: { worms: 1 } }));
  assert.equal(room.room.settings, null);
  room.receive(h, JSON.stringify({ t: "settings", settings: { worms: 2 } }));
  assert.equal(room.room.settings.worms, 2);
  room.receive(a, JSON.stringify({ t: "start", cp: { x: 1 }, auth: "a" }));
  assert.equal(room.room.phase, "lobby");
  room.receive(h, JSON.stringify({ t: "start", cp: { x: 1 }, auth: "a" }));
  assert.equal(room.room.phase, "game");
  assert.equal(a.last("start").auth, "a");
});

test("Spiel: nur die Authority darf Updates schicken, Zugwechsel setzt neue Authority", () => {
  const room = new HostRoom("host");
  const h = join(room, "host");
  const a = join(room, "a");
  room.receive(h, JSON.stringify({ t: "start", cp: { n: 0 }, auth: "host" }));
  room.receive(a, JSON.stringify({ t: "s", k: 1 }));
  assert.equal(h.msgs.filter((m) => m.t === "s").length, 0);
  room.receive(h, JSON.stringify({ t: "s", k: 2 }));
  assert.equal(a.last("s").k, 2);
  assert.equal(h.msgs.filter((m) => m.t === "s").length, 0, "Absender bekommt sein Update nicht zurück");
  room.receive(h, JSON.stringify({ t: "turn", auth: "a", cp: { n: 1 } }));
  assert.equal(room.room.auth, "a");
  assert.equal(a.last("turn").auth, "a");
  assert.equal(h.last("turn").from, "host");
});

test("Wiedereinstieg bekommt Checkpoint plus alle Updates seit Zugbeginn", () => {
  const room = new HostRoom("host");
  const h = join(room, "host");
  let a = join(room, "a");
  room.receive(h, JSON.stringify({ t: "start", cp: { n: 0 }, auth: "host" }));
  room.receive(h, JSON.stringify({ t: "s", k: 1 }));
  room.receive(h, JSON.stringify({ t: "s", k: 2 }));
  room.detach(a);
  a = join(room, "a");
  const types = a.msgs.map((m) => m.t);
  assert.deepEqual(types.slice(types.indexOf("sync")), ["sync", "s", "s", "synced"]);
});

test("Verlässt die Authority das Spiel, übernimmt ein anderer Spieler", () => {
  const room = new HostRoom("host");
  const h = join(room, "host");
  const a = join(room, "a");
  room.receive(h, JSON.stringify({ t: "start", cp: { n: 0 }, auth: "a" }));
  room.detach(a);
  assert.equal(room.room.auth, "host");
  assert.equal(h.last("auth").lost, "a");
});

test("Nach Spielende rücken Zuschauer in die Lobby auf, Getrennte fliegen raus", () => {
  const room = new HostRoom("host");
  const h = join(room, "host");
  const a = join(room, "a");
  room.receive(h, JSON.stringify({ t: "start", cp: { n: 0 }, auth: "host" }));
  const spectator = join(room, "z", "Zoe");
  assert.equal(spectator.last("sync").auth, "host");
  room.detach(a);
  room.receive(h, JSON.stringify({ t: "lobby" }));
  const ids = room.room.players.map((p) => p.id);
  assert.deepEqual(ids.sort(), ["host", "z"]);
});

test("Gastgeber-Reload: Lobby wird wiederhergestellt, fehlende Authority wird ersetzt", () => {
  const first = new HostRoom("host");
  let saved;
  first.onSave = (state) => (saved = JSON.parse(JSON.stringify(state)));
  const h = join(first, "host");
  join(first, "a");
  first.receive(h, JSON.stringify({ t: "start", cp: { n: 0 }, auth: "a" }));
  const room = new HostRoom("host", saved);
  const h2 = join(room, "host");
  assert.equal(h2.last("sync").auth, "a");
  room.checkAuth();
  assert.equal(room.room.auth, "host");
});

test("Kick und doppelte Verbindung", () => {
  const room = new HostRoom("host");
  const h = join(room, "host");
  const a = join(room, "a");
  const a2 = join(room, "a");
  assert.equal(a.last("replaced")?.t, "replaced");
  assert.equal(a.closed, true);
  room.receive(h, JSON.stringify({ t: "kick", pid: "a" }));
  assert.equal(a2.last("kicked")?.t, "kicked");
  assert.deepEqual(room.room.players.map((p) => p.id), ["host"]);
});
