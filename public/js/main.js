import { Net } from "./net.js";
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
    this.net = null;
    this.room = null;
    this.game = null;
    this.roomCode = null;
    this.lobby = new Lobby(this);

    $("menu-name").value = this.profile.name;
    $("btn-create").onclick = () => this.enter(makeCode());
    $("btn-join").onclick = () => this.enter($("menu-code").value);
    $("menu-code").onkeydown = (e) => e.key === "Enter" && this.enter($("menu-code").value);
    for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => this.sound.unlock());

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

  enter(rawCode) {
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
    history.replaceState(null, "", `?r=${code}`);
    this.loading("Verbinde…");
    this.net = new Net(code, () => this.hello(), (m) => this.onMessage(m));
  }

  hello() {
    return { t: "hello", pid: this.me, name: this.profile.name, team: this.profile.team, color: this.profile.color };
  }

  sendTeam() {
    this.net?.send({ t: "team", name: this.profile.name, team: this.profile.team, color: this.profile.color });
  }

  leaveRoom() {
    this.net?.close();
    this.net = null;
    this.game?.destroy();
    this.game = null;
    this.room = null;
    history.replaceState(null, "", location.pathname);
    this.loading(null);
    this.show("menu");
  }

  onMessage(m) {
    switch (m.t) {
      case "welcome":
        this.room = m.room;
        if (m.room.host === this.me && !m.room.settings) this.net.send({ t: "settings", settings: DEFAULT_SETTINGS });
        this.onRoom();
        if (m.room.phase === "lobby" && !m.room.players.some((p) => p.id === this.me)) this.toast("Der Raum ist voll – du schaust zu.");
        break;
      case "room": {
        const before = new Set((this.room?.players ?? []).filter((p) => p.on).map((p) => p.id));
        this.room = m.room;
        for (const p of m.room.players) {
          if (p.on && !before.has(p.id) && this.room && p.id !== this.me && before.size) this.lobby.addChat("", 0, `${p.name} ist da.`, true);
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
      case "_closed":
        if (this.net) this.toast("Verbindung unterbrochen – verbinde neu…", 2000);
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
