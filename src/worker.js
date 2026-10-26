import { DurableObject } from "cloudflare:workers";

// Ein Raum = ein Durable Object. Es verwaltet die Lobby, leitet die Spiel-Updates
// des gerade aktiven Spielers ("Authority") an alle anderen weiter und hält einen
// Checkpoint vom letzten Zugbeginn bereit, damit Spieler nach einem Reload wieder
// einsteigen können. Die Spielphysik selbst läuft komplett im Browser.

const MAX_PLAYERS = 6;
const COLOR_COUNT = 6;
const ROOM_PATH = /^\/ws\/([A-Z0-9]{4,8})$/;
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;
const MAX_LOG = 20000;
const MAX_NAME = 16;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(ROOM_PATH);
    if (!match) return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    if (request.method !== "GET") return new Response("Expected GET", { status: 400 });
    return env.ROOMS.getByName(match[1]).fetch(request);
  },
};

function newRoom() {
  return { phase: "lobby", host: null, players: [], settings: null, auth: null, game: 0 };
}

function cleanText(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

function cleanTeam(team) {
  if (!team || typeof team !== "object") return null;
  const worms = Array.isArray(team.worms) ? team.worms.slice(0, 8).map((w) => cleanText(w, MAX_NAME)) : [];
  return { name: cleanText(team.name, 20), worms };
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = newRoom();
    this.cp = null;
    this.log = [];
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get("room")) ?? newRoom();
      this.cp = (await ctx.storage.get("cp")) ?? null;
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null });
    await this.ctx.storage.deleteAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string") return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;
    if (msg.t === "hello") return this.onHello(ws, msg);

    const pid = ws.deserializeAttachment()?.pid;
    if (!pid) return;
    const room = this.room;
    const player = room.players.find((p) => p.id === pid);
    const isHost = room.host === pid;

    switch (msg.t) {
      case "s": // Zustands-Update des aktiven Spielers
        if (room.phase !== "game" || room.auth !== pid) return;
        if (this.log.length < MAX_LOG) this.log.push(raw);
        this.broadcast(raw, ws);
        return;

      case "turn": {
        // Zugwechsel: neuer Checkpoint + neue Authority
        if (room.phase !== "game" || room.auth !== pid || !msg.cp) return;
        const online = this.onlinePids();
        let next = room.players.some((p) => p.id === msg.auth) && online.has(msg.auth) ? msg.auth : pid;
        room.auth = next;
        this.cp = msg.cp;
        this.log = [];
        this.save(true);
        this.broadcast(JSON.stringify({ t: "turn", cp: msg.cp, auth: next, from: pid }));
        return;
      }

      case "team":
        if (!player) return;
        if (msg.name !== undefined) player.name = cleanText(msg.name, MAX_NAME) || player.name;
        if (room.phase === "lobby") {
          const team = cleanTeam(msg.team);
          if (team) player.team = team;
          if (Number.isInteger(msg.color) && msg.color >= 0 && msg.color < COLOR_COUNT &&
              !room.players.some((p) => p !== player && p.color === msg.color)) {
            player.color = msg.color;
          }
        }
        this.save();
        this.broadcastRoom();
        return;

      case "settings":
        if (!isHost || room.phase !== "lobby") return;
        if (!msg.settings || typeof msg.settings !== "object" || JSON.stringify(msg.settings).length > 20000) return;
        room.settings = msg.settings;
        this.save();
        this.broadcastRoom();
        return;

      case "start":
        if (!isHost || room.phase !== "lobby" || !msg.cp) return;
        if (!room.players.some((p) => p.id === msg.auth)) return;
        room.phase = "game";
        room.game += 1;
        room.auth = msg.auth;
        this.cp = msg.cp;
        this.log = [];
        this.save(true);
        this.broadcastRoom();
        this.broadcast(JSON.stringify({ t: "start", cp: msg.cp, auth: msg.auth, game: room.game }));
        return;

      case "lobby": // Host bricht ab / kehrt nach Spielende zurück
        if (!isHost || room.phase !== "game") return;
        this.backToLobby();
        return;

      case "kick": {
        if (!isHost || room.phase !== "lobby" || msg.pid === pid) return;
        room.players = room.players.filter((p) => p.id !== msg.pid);
        for (const other of this.ctx.getWebSockets()) {
          if (other.deserializeAttachment()?.pid === msg.pid) {
            other.serializeAttachment({ pid: null });
            this.safeSend(other, JSON.stringify({ t: "kicked" }));
            try { other.close(4001, "kicked"); } catch {}
          }
        }
        this.save();
        this.broadcastRoom();
        return;
      }

      case "chat": {
        const text = cleanText(msg.text, 200);
        if (!text) return;
        const name = player?.name ?? "Zuschauer";
        this.broadcast(JSON.stringify({ t: "chat", name, color: player?.color ?? -1, text }));
        return;
      }
    }
  }

  onHello(ws, msg) {
    const pid = cleanText(msg.pid, 40);
    if (!pid) return;
    // Alte Verbindung desselben Spielers (z. B. zweiter Tab) ersetzen
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && other.deserializeAttachment()?.pid === pid) {
        other.serializeAttachment({ pid: null });
        this.safeSend(other, JSON.stringify({ t: "replaced" }));
        try { other.close(4000, "replaced"); } catch {}
      }
    }
    ws.serializeAttachment({ pid });

    const room = this.room;
    const name = cleanText(msg.name, MAX_NAME) || "Wurm";
    let player = room.players.find((p) => p.id === pid);
    if (!player && room.phase === "lobby" && room.players.length < MAX_PLAYERS) {
      const used = new Set(room.players.map((p) => p.color));
      let color = Number.isInteger(msg.color) && !used.has(msg.color) && msg.color >= 0 && msg.color < COLOR_COUNT ? msg.color : -1;
      for (let c = 0; color < 0 && c < COLOR_COUNT; c++) if (!used.has(c)) color = c;
      player = { id: pid, name, color, team: cleanTeam(msg.team) ?? { name: "", worms: [] } };
      room.players.push(player);
    } else if (player && room.phase === "lobby") {
      player.name = name;
      const team = cleanTeam(msg.team);
      if (team) player.team = team;
    }
    if (!room.host || !room.players.some((p) => p.id === room.host)) {
      room.host = room.players[0]?.id ?? null;
    }
    this.save();

    this.safeSend(ws, JSON.stringify({ t: "welcome", you: pid, room: this.publicRoom() }));
    this.broadcastRoom();

    if (room.phase === "game" && this.cp) {
      if (player && !room.auth) {
        room.auth = pid;
        this.save();
      }
      this.safeSend(ws, JSON.stringify({ t: "sync", cp: this.cp, auth: room.auth, game: room.game }));
      for (const entry of this.log) this.safeSend(ws, entry);
      this.safeSend(ws, JSON.stringify({ t: "synced" }));
      if (player && room.auth === pid) this.broadcast(JSON.stringify({ t: "auth", auth: pid }), ws);
    }
  }

  async webSocketClose(ws) {
    this.onLeave(ws);
  }

  async webSocketError(ws) {
    this.onLeave(ws);
  }

  onLeave(ws) {
    const pid = ws.deserializeAttachment()?.pid;
    try {
      ws.serializeAttachment({ pid: null });
      ws.close(1000, "bye");
    } catch {}
    const online = this.onlinePids(ws);
    if (pid && !online.has(pid)) {
      const room = this.room;
      if (room.phase === "lobby") {
        room.players = room.players.filter((p) => p.id !== pid);
      } else if (room.auth === pid) {
        // Aktiver Spieler weg: der erste verbundene Spieler übernimmt die Simulation
        room.auth = room.players.find((p) => online.has(p.id))?.id ?? null;
        if (room.auth) this.broadcast(JSON.stringify({ t: "auth", auth: room.auth, lost: pid }), ws);
      }
      if (room.host === pid) {
        room.host = room.players.find((p) => online.has(p.id))?.id ?? room.players[0]?.id ?? null;
      }
      this.save();
      this.broadcastRoom(ws);
    }
    if (online.size === 0) this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_TTL_MS);
  }

  async alarm() {
    if (this.onlinePids().size === 0) {
      await this.ctx.storage.deleteAll();
      this.room = newRoom();
      this.cp = null;
      this.log = [];
    }
  }

  backToLobby() {
    const room = this.room;
    const online = this.onlinePids();
    room.phase = "lobby";
    room.auth = null;
    room.players = room.players.filter((p) => online.has(p.id));
    if (!room.players.some((p) => p.id === room.host)) room.host = room.players[0]?.id ?? null;
    this.cp = null;
    this.log = [];
    this.ctx.storage.delete("cp");
    this.save();
    this.broadcastRoom();
  }

  onlinePids(exclude) {
    const set = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      const pid = ws.deserializeAttachment()?.pid;
      if (pid) set.add(pid);
    }
    return set;
  }

  publicRoom(exclude) {
    const online = this.onlinePids(exclude);
    const { phase, host, settings, auth, game } = this.room;
    const players = this.room.players.map((p) => ({ ...p, on: online.has(p.id) }));
    const spectators = [...online].filter((id) => !this.room.players.some((p) => p.id === id)).length;
    return { phase, host, settings, auth, game, players, spectators };
  }

  save(withCheckpoint = false) {
    this.ctx.storage.put("room", this.room);
    if (withCheckpoint && this.cp) this.ctx.storage.put("cp", this.cp);
  }

  // `leaving` ist eine gerade geschlossene Verbindung, die nicht mehr als online zählt
  broadcastRoom(leaving) {
    this.broadcast(JSON.stringify({ t: "room", room: this.publicRoom(leaving) }), leaving);
  }

  broadcast(text, except) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except) this.safeSend(ws, text);
    }
  }

  safeSend(ws, text) {
    try {
      ws.send(text);
    } catch {}
  }
}
