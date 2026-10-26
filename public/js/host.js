// Der Raum läuft im Browser des Raum-Erstellers ("Gastgeber"). Diese Klasse verwaltet die
// Lobby, leitet die Spiel-Updates des gerade aktiven Spielers ("Authority") an alle anderen
// weiter und hält einen Checkpoint vom letzten Zugbeginn bereit, damit Spieler nach einem
// Reload wieder einsteigen können. Die Spielphysik selbst läuft beim jeweils aktiven Spieler.
//
// Eine Verbindung (conn) ist ein Objekt mit send(text), close() und den Feldern pid/info,
// egal ob es der Gastgeber selbst ist oder ein Mitspieler über WebRTC.

const MAX_PLAYERS = 6;
const COLOR_COUNT = 6;
const MAX_LOG = 20000;
const MAX_NAME = 16;

function cleanText(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

function cleanTeam(team) {
  if (!team || typeof team !== "object") return null;
  const worms = Array.isArray(team.worms) ? team.worms.slice(0, 8).map((w) => cleanText(w, MAX_NAME)) : [];
  return { name: cleanText(team.name, 20), worms, voice: cleanText(team.voice, 20) };
}

export class HostRoom {
  constructor(hostPid, saved) {
    this.hostPid = hostPid;
    this.room = saved?.room ?? { phase: "lobby", host: hostPid, players: [], settings: null, auth: null, game: 0 };
    this.room.host = hostPid;
    this.cp = saved?.cp ?? null;
    this.log = [];
    this.conns = new Set();
    this.onSave = null;
    // Nach einem Reload des Gastgebers ist noch niemand verbunden
    if (this.room.phase === "lobby") this.room.players = this.room.players.filter((p) => p.id === hostPid);
  }

  attach(conn) {
    conn.pid = null;
    this.conns.add(conn);
  }

  detach(conn) {
    if (!this.conns.delete(conn)) return;
    const pid = conn.pid;
    conn.pid = null;
    this.onLeave(pid);
  }

  receive(conn, raw) {
    if (typeof raw !== "string" || !this.conns.has(conn)) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;
    if (msg.t === "hello") return this.onHello(conn, msg);

    const pid = conn.pid;
    if (!pid) return;
    const room = this.room;
    const player = room.players.find((p) => p.id === pid);
    const isHost = room.host === pid;

    switch (msg.t) {
      case "s": // Zustands-Update des aktiven Spielers
        if (room.phase !== "game" || room.auth !== pid) return;
        if (this.log.length < MAX_LOG) this.log.push(raw);
        this.broadcast(raw, conn);
        return;

      case "turn": {
        // Zugwechsel: neuer Checkpoint + neue Authority
        if (room.phase !== "game" || room.auth !== pid || !msg.cp) return;
        const online = this.onlinePids();
        const next = room.players.some((p) => p.id === msg.auth) && online.has(msg.auth) ? msg.auth : pid;
        room.auth = next;
        this.cp = msg.cp;
        this.log = [];
        this.save();
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
        conn.info = { name: player.name, team: player.team, color: player.color };
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
        this.save();
        this.broadcastRoom();
        this.broadcast(JSON.stringify({ t: "start", cp: msg.cp, auth: msg.auth, game: room.game }));
        return;

      case "lobby": // Gastgeber bricht ab / kehrt nach Spielende zurück
        if (!isHost || room.phase !== "game") return;
        this.backToLobby();
        return;

      case "kick":
        if (!isHost || room.phase !== "lobby" || msg.pid === pid) return;
        room.players = room.players.filter((p) => p.id !== msg.pid);
        for (const other of [...this.conns]) {
          if (other.pid !== msg.pid) continue;
          this.conns.delete(other);
          other.pid = null;
          other.send(JSON.stringify({ t: "kicked" }));
          other.close();
        }
        this.save();
        this.broadcastRoom();
        return;

      case "chat": {
        const text = cleanText(msg.text, 200);
        if (!text) return;
        this.broadcast(JSON.stringify({ t: "chat", name: player?.name ?? "Zuschauer", color: player?.color ?? -1, text }));
        return;
      }
    }
  }

  onHello(conn, msg) {
    const pid = cleanText(msg.pid, 40);
    if (!pid) return;
    // Alte Verbindung desselben Spielers (z. B. zweiter Tab) ersetzen
    for (const other of [...this.conns]) {
      if (other !== conn && other.pid === pid) {
        this.conns.delete(other);
        other.pid = null;
        other.send(JSON.stringify({ t: "replaced" }));
        other.close();
      }
    }
    const room = this.room;
    const name = cleanText(msg.name, MAX_NAME) || "Wurm";
    conn.pid = pid;
    // Name und Team merken, damit Zuschauer nach dem Spiel in die Lobby aufrücken können
    conn.info = { name, team: cleanTeam(msg.team), color: msg.color };
    let player = room.players.find((p) => p.id === pid);
    if (!player && room.phase === "lobby" && room.players.length < MAX_PLAYERS) {
      player = this.addPlayer(pid, name, cleanTeam(msg.team), msg.color);
    } else if (player && room.phase === "lobby") {
      player.name = name;
      const team = cleanTeam(msg.team);
      if (team) player.team = team;
    }
    this.save();

    conn.send(JSON.stringify({ t: "welcome", you: pid, room: this.publicRoom() }));
    this.broadcastRoom();

    if (room.phase === "game" && this.cp) {
      if (player && !room.auth) room.auth = pid;
      conn.send(JSON.stringify({ t: "sync", cp: this.cp, auth: room.auth, game: room.game }));
      for (const entry of this.log) conn.send(entry);
      conn.send(JSON.stringify({ t: "synced" }));
      if (player && room.auth === pid) this.broadcast(JSON.stringify({ t: "auth", auth: pid }), conn);
    }
  }

  onLeave(pid) {
    if (!pid) return;
    const online = this.onlinePids();
    if (online.has(pid)) return;
    const room = this.room;
    if (room.phase === "lobby") {
      room.players = room.players.filter((p) => p.id !== pid);
    } else if (room.auth === pid) {
      // Aktiver Spieler weg: der erste verbundene Spieler übernimmt die Simulation
      room.auth = room.players.find((p) => online.has(p.id))?.id ?? null;
      if (room.auth) this.broadcast(JSON.stringify({ t: "auth", auth: room.auth, lost: pid }));
    }
    this.save();
    this.broadcastRoom();
  }

  // Nach einem Reload des Gastgebers: Ist der aktive Spieler nicht zurückgekommen,
  // übernimmt der erste verbundene Spieler die Simulation.
  checkAuth() {
    const room = this.room;
    if (room.phase !== "game") return;
    const online = this.onlinePids();
    if (room.auth && online.has(room.auth)) return;
    const lost = room.auth;
    room.auth = room.players.find((p) => online.has(p.id))?.id ?? null;
    if (!room.auth) return;
    this.save();
    this.broadcast(JSON.stringify({ t: "auth", auth: room.auth, lost }));
  }

  addPlayer(pid, name, team, preferredColor) {
    const used = new Set(this.room.players.map((p) => p.color));
    let color = Number.isInteger(preferredColor) && preferredColor >= 0 && preferredColor < COLOR_COUNT && !used.has(preferredColor) ? preferredColor : -1;
    for (let c = 0; color < 0 && c < COLOR_COUNT; c++) if (!used.has(c)) color = c;
    const player = { id: pid, name, color, team: team ?? { name: "", worms: [] } };
    this.room.players.push(player);
    return player;
  }

  backToLobby() {
    const room = this.room;
    const online = this.onlinePids();
    room.phase = "lobby";
    room.auth = null;
    room.players = room.players.filter((p) => online.has(p.id));
    for (const conn of this.conns) {
      if (!conn.pid || room.players.length >= MAX_PLAYERS || room.players.some((p) => p.id === conn.pid)) continue;
      this.addPlayer(conn.pid, conn.info?.name || "Wurm", conn.info?.team, conn.info?.color);
    }
    this.cp = null;
    this.log = [];
    this.save();
    this.broadcastRoom();
  }

  onlinePids() {
    const set = new Set();
    for (const conn of this.conns) if (conn.pid) set.add(conn.pid);
    return set;
  }

  publicRoom() {
    const online = this.onlinePids();
    const { phase, host, settings, auth, game } = this.room;
    const players = this.room.players.map((p) => ({ ...p, on: online.has(p.id) }));
    const spectators = [...online].filter((id) => !this.room.players.some((p) => p.id === id)).length;
    return { phase, host, settings, auth, game, players, spectators };
  }

  save() {
    this.onSave?.({ room: this.room, cp: this.cp });
  }

  broadcastRoom() {
    this.broadcast(JSON.stringify({ t: "room", room: this.publicRoom() }));
  }

  broadcast(text, except) {
    for (const conn of this.conns) if (conn !== except) conn.send(text);
  }

  // Raum schließen: alle Mitspieler informieren und trennen
  closeAll() {
    for (const conn of [...this.conns]) {
      conn.send(JSON.stringify({ t: "roomclosed" }));
      conn.close();
    }
    this.conns.clear();
  }
}
