import { HostNet, GuestNet, hostedRoom } from "./net.js";
import { Lobby } from "./lobby.js";
import { GameClient } from "./client/game-client.js";
import { Sound } from "./client/audio.js";
import { World } from "./game/world.js";
import { randomSeed } from "./game/rng.js";
import { DEFAULT_SETTINGS, normalizeSettings } from "./game/settings.js";
import { randomWormNames, randomTeamName } from "./names.js";

const $ = (id) => document.getElementById(id);
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  let code = "";
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function setRoomInUrl(code) {
  const params = new URLSearchParams(location.search);
  if (code) params.set("r", code);
  else params.delete("r");
  const query = params.toString();
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
}

function makeId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

class App {
  constructor() {
    // Spieler-ID pro Tab: übersteht ein Neuladen, zwei Tabs sind aber zwei Spieler
    this.me = sessionStorage.getItem("wk.pid") ?? makeId();
    sessionStorage.setItem("wk.pid", this.me);
    this.profile = this.loadProfile();
    this.sound = new Sound();
    this.sound.preload();
    this.net = null;
    this.room = null;
    this.game = null;
    this.roomCode = null;
    this.everConnected = false;
    this.lastWarning = 0;
    this.lobby = new Lobby(this);

    $("menu-name").value = this.profile.name;
    $("btn-create").onclick = () => this.enter(makeCode(), true);
    $("btn-join").onclick = () => this.enter($("menu-code").value);
    // Nicht als onkeydown-Rückgabewert: "false" würde jeden Tastendruck im Feld blockieren
    $("menu-code").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.enter($("menu-code").value);
    });
    for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => this.sound.unlock());
    // Der Raum läuft im Tab des Gastgebers: versehentliches Schließen abfangen
    window.addEventListener("beforeunload", (e) => {
      if (this.net?.isHost && this.net.guestCount() > 0) e.preventDefault();
    });

    const code = new URLSearchParams(location.search).get("r");
    if (code) {
      $("menu-code").value = code.toUpperCase();
      if (this.profile.name) this.enter(code);
      else $("menu-name").focus();
    }
  }

  loadProfile() {
    let p = {};
    try {
      p = JSON.parse(localStorage.getItem("wk.profile") ?? "{}");
    } catch {}
    const worms = Array.isArray(p.team?.worms) ? p.team.worms : [];
    return {
      name: typeof p.name === "string" ? p.name : "",
      color: Number.isInteger(p.color) ? p.color : -1,
      team: {
        voice: typeof p.team?.voice === "string" ? p.team.voice : "",
        name: p.team?.name || randomTeamName(),
        worms: worms.length >= 8 ? worms.slice(0, 8) : [...worms, ...randomWormNames(8)].slice(0, 8),
      },
    };
  }

  saveProfile() {
    localStorage.setItem("wk.profile", JSON.stringify(this.profile));
  }

  show(screen) {
    for (const id of ["menu", "lobby", "game"]) $(id).classList.toggle("hidden", id !== screen);
  }

  loading(text) {
    $("loading").classList.toggle("hidden", !text);
    if (text) $("loading-text").textContent = text;
  }

  toast(text, ms = 3500) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    $("toasts").append(el);
    setTimeout(() => (el.style.opacity = "0"), ms);
    setTimeout(() => el.remove(), ms + 500);
  }

  enter(rawCode, create = false) {
    const code = String(rawCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const name = $("menu-name").value.trim();
    if (!name) {
      $("menu-error").textContent = "Bitte gib zuerst einen Namen ein.";
      $("menu-name").focus();
      return;
    }
    if (code.length < 4) {
      $("menu-error").textContent = "Der Raumcode hat mindestens 4 Zeichen.";
      return;
    }
    $("menu-error").textContent = "";
    this.profile.name = name.slice(0, 16);
    this.saveProfile();
    this.roomCode = code;
    this.everConnected = false;
    setRoomInUrl(code);
    const onMessage = (m) => this.onMessage(m);
    if (create || hostedRoom() === code) {
      this.loading("Raum wird eröffnet…");
      this.net = new HostNet(code, this.me, () => this.hello(), onMessage);
    } else {
      this.loading("Verbinde mit dem Gastgeber…");
      this.net = new GuestNet(code, () => this.hello(), onMessage);
    }
  }

  hello() {
    return { t: "hello", pid: this.me, name: this.profile.name, team: this.profile.team, color: this.profile.color };
  }

  sendTeam() {
    this.net?.send({ t: "team", name: this.profile.name, team: this.profile.team, color: this.profile.color });
  }

  leaveRoom(ask = false) {
    if (ask && this.net?.isHost && this.net.guestCount() > 0 &&
        !confirm("Du bist Gastgeber: Wenn du gehst, endet der Raum für alle. Wirklich verlassen?")) return;
    this.net?.close();
    this.net = null;
    this.game?.destroy();
    this.game = null;
    this.room = null;
    setRoomInUrl(null);
    this.loading(null);
    this.show("menu");
  }

  // Hinweise bei Verbindungsproblemen nicht im Sekundentakt wiederholen
  warn(text) {
    if (Date.now() - this.lastWarning < 10000) return;
    this.lastWarning = Date.now();
    this.toast(text, 4000);
  }

  connectionError(error) {
    const code = this.roomCode;
    if (error === "taken") {
      this.leaveRoom();
      $("menu-error").textContent = `Der Raumcode ${code} ist gerade belegt. Erstell einfach einen neuen Raum.`;
    } else if (error === "notfound") {
      if (this.everConnected) return this.warn("Gastgeber nicht erreichbar – versuche es weiter…");
      this.leaveRoom();
      $("menu-code").value = code;
      $("menu-error").textContent = `Raum ${code} nicht gefunden. Ist der Gastgeber online und der Code richtig?`;
    } else if (error === "signal") {
      if (!this.everConnected && !this.net?.isHost) {
        this.leaveRoom();
        $("menu-error").textContent = "Keine Verbindung zum Vermittlungsserver. Bitte Internet prüfen und nochmal versuchen.";
      } else if (this.net?.isHost) {
        this.warn("Vermittlungsserver nicht erreichbar – neue Mitspieler können gerade nicht beitreten.");
      }
    }
  }

  onMessage(m) {
    switch (m.t) {
      case "welcome":
        this.everConnected = true;
        this.room = m.room;
        if (m.room.host === this.me && !m.room.settings) this.net.send({ t: "settings", settings: DEFAULT_SETTINGS });
        this.onRoom();
        if (m.room.phase === "lobby" && !m.room.players.some((p) => p.id === this.me)) this.toast("Der Raum ist voll – du schaust zu.");
        break;
      case "room": {
        const prev = this.room?.players ?? [];
        const before = new Set(prev.filter((p) => p.on).map((p) => p.id));
        this.room = m.room;
        if (before.size) {
          const now = new Set(m.room.players.filter((p) => p.on).map((p) => p.id));
          for (const p of m.room.players) {
            if (now.has(p.id) && !before.has(p.id) && p.id !== this.me) this.lobby.addChat("", 0, `${p.name} ist da.`, true);
          }
          for (const p of prev) {
            if (before.has(p.id) && !now.has(p.id)) this.lobby.addChat("", 0, `${p.name} ist gegangen.`, true);
          }
        }
        this.onRoom();
        break;
      }
      case "start":
      case "sync":
        this.startClient(m);
        break;
      case "s":
      case "turn":
      case "auth":
      case "synced":
        this.game?.onMessage(m);
        break;
      case "chat":
        this.lobby.addChat(m.name, m.color, m.text);
        this.game?.chat(m.name, m.color, m.text);
        break;
      case "kicked":
        this.leaveRoom();
        this.toast("Du wurdest aus dem Raum entfernt.");
        break;
      case "replaced":
        this.leaveRoom();
        this.toast("Der Raum wurde in einem anderen Tab geöffnet.");
        break;
      case "roomclosed":
        this.leaveRoom();
        this.toast("Der Gastgeber hat den Raum geschlossen.");
        break;
      case "_closed":
        if (this.net) this.warn("Verbindung zum Gastgeber unterbrochen – verbinde neu…");
        break;
      case "_error":
        this.connectionError(m.error);
        break;
    }
  }

  onRoom() {
    const room = this.room;
    if (room.phase === "lobby") {
      if (this.game) {
        this.game.destroy();
        this.game = null;
      }
      this.loading(null);
      this.show("lobby");
      this.lobby.render(room);
    } else if (this.game) {
      this.game.setRoom(room);
    } else {
      this.loading("Spiel läuft – lade Spielstand…");
    }
  }

  startGame() {
    const room = this.room;
    if (!room || room.host !== this.me) return;
    this.loading("Karte wird gebaut…");
    // Kurz warten, damit der Ladebildschirm sichtbar wird, bevor die Kartengenerierung rechnet
    setTimeout(() => {
      try {
        const world = World.create({ settings: normalizeSettings(room.settings), players: room.players, seed: randomSeed() });
        const auth = world.teams[world.turn.team].pid;
        this.net.send({ t: "start", cp: world.toCheckpoint(), auth });
      } catch (err) {
        console.error(err);
        this.loading(null);
        this.toast("Karte konnte nicht erstellt werden – nochmal versuchen.");
      }
    }, 40);
  }

  startClient(m) {
    this.game?.destroy();
    this.show("game");
    this.game = new GameClient(this, m);
    this.loading(null);
  }
}

window.app = new App();
