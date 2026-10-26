import { TEAM_COLORS, TEAM_COLOR_NAMES } from "./game/const.js";
import { WEAPONS, CATEGORIES } from "./game/weapons.js";
import { normalizeSettings, AMMO_PRESETS } from "./game/settings.js";
import { randomWormNames } from "./names.js";

const $ = (id) => document.getElementById(id);

const SETTINGS_UI = [
  { key: "worms", label: "Würmer pro Team", options: [1, 2, 3, 4, 5, 6, 7, 8] },
  { key: "hp", label: "Lebenspunkte", options: [50, 100, 150, 200] },
  { key: "turnTime", label: "Zugzeit", options: [15, 20, 30, 45, 60, 90].map((s) => [s, `${s} s`]) },
  { key: "retreat", label: "Rückzugszeit", options: [0, 2, 3, 5].map((s) => [s, `${s} s`]) },
  { key: "mapSize", label: "Kartengröße", options: [["small", "Klein"], ["medium", "Mittel"], ["large", "Groß"]] },
  { key: "theme", label: "Landschaft", options: [["zufall", "Zufall"], ["wiese", "Wiese"], ["wueste", "Wüste"], ["schnee", "Schnee"], ["suess", "Süßkram"], ["vulkan", "Vulkan"]] },
  { key: "mines", label: "Minen", options: [0, 3, 6, 10, 15, 20] },
  { key: "barrels", label: "Ölfässer", options: [0, 3, 5, 8, 12] },
  { key: "crates", label: "Kisten", options: [["aus", "Aus"], ["selten", "Selten"], ["normal", "Normal"], ["oft", "Oft"]] },
  { key: "crateHealth", label: "Gesundheitskiste", options: [10, 25, 50].map((v) => [v, `+${v} HP`]) },
  { key: "sdMinutes", label: "Sudden Death nach", options: [[0, "Nie"], ...[5, 10, 15, 20, 30].map((m) => [m, `${m} min`])] },
  { key: "waterRise", label: "Wasseranstieg (SD)", options: [["langsam", "Langsam"], ["normal", "Normal"], ["schnell", "Schnell"]] },
  { key: "wind", label: "Wind", check: true },
  { key: "fallDamage", label: "Fallschaden", check: true },
  { key: "dudMines", label: "Blindgänger-Minen", check: true },
  { key: "sdOneHp", label: "Sudden Death: alle auf 1 HP", check: true },
];

const AMMO_OPTIONS = [[0, "–"], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, String(n)]), [-1, "∞"]];

function option(value, label) {
  const o = document.createElement("option");
  o.value = String(value);
  o.textContent = label;
  return o;
}

export class Lobby {
  constructor(app) {
    this.app = app;
    this.room = null;
    this.controls = new Map();
    this.ammoControls = new Map();
    this.teamTimer = 0;
    this.buildSettings();
    this.buildAmmo();
    this.bindTeamEditor();

    $("btn-start").onclick = () => app.startGame();
    $("btn-copy").onclick = () => {
      navigator.clipboard?.writeText(location.href).then(() => app.toast("Link kopiert – schick ihn deinen Freunden!"));
    };
    $("btn-leave").onclick = () => app.leaveRoom(true);
    $("lobby-chat-form").onsubmit = (e) => {
      e.preventDefault();
      const input = e.target.querySelector("input");
      if (input.value.trim()) app.net?.send({ t: "chat", text: input.value });
      input.value = "";
    };
  }

  get settings() {
    return normalizeSettings(this.room?.settings);
  }

  isHost() {
    return this.room?.host === this.app.me;
  }

  sendSettings(patch) {
    if (!this.isHost()) return;
    const settings = { ...this.settings, ...patch };
    this.room.settings = settings;
    this.app.net.send({ t: "settings", settings });
    this.render(this.room);
  }

  buildSettings() {
    const box = $("settings");
    for (const def of SETTINGS_UI) {
      const label = document.createElement("label");
      let ctl;
      if (def.check) {
        label.className = "check";
        ctl = document.createElement("input");
        ctl.type = "checkbox";
        label.append(ctl, def.label);
        ctl.onchange = () => this.sendSettings({ [def.key]: ctl.checked });
      } else {
        ctl = document.createElement("select");
        for (const opt of def.options) {
          const [v, l] = Array.isArray(opt) ? opt : [opt, String(opt)];
          ctl.append(option(v, l));
        }
        label.append(def.label, ctl);
        ctl.onchange = () => {
          const raw = ctl.value;
          const value = typeof (Array.isArray(def.options[0]) ? def.options[0][0] : def.options[0]) === "number" ? Number(raw) : raw;
          this.sendSettings({ [def.key]: value });
        };
      }
      this.controls.set(def.key, ctl);
      box.append(label);
    }
  }

  buildAmmo() {
    const presets = $("ammo-presets");
    for (const [key, preset] of Object.entries(AMMO_PRESETS)) {
      const b = document.createElement("button");
      b.className = "btn tiny";
      b.textContent = preset.name;
      b.onclick = () => this.sendSettings({ ammo: preset.ammo() });
      presets.append(b);
      b.dataset.preset = key;
    }
    const grid = $("ammo-grid");
    for (const wp of WEAPONS) {
      if (wp.id === "skip") continue;
      const row = document.createElement("div");
      row.className = "ammo-item";
      row.title = `${CATEGORIES[wp.cat]}: ${wp.hint}`;
      const ico = document.createElement("span");
      ico.className = "ico";
      ico.textContent = wp.icon;
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = wp.name;
      const sel = document.createElement("select");
      for (const [v, l] of AMMO_OPTIONS) sel.append(option(v, l));
      sel.onchange = () => this.sendSettings({ ammo: { ...this.settings.ammo, [wp.id]: Number(sel.value) } });
      row.append(ico, nm, sel);
      grid.append(row);
      this.ammoControls.set(wp.id, sel);
    }
  }

  bindTeamEditor() {
    const profile = this.app.profile;
    const teamName = $("team-name");
    teamName.value = profile.team.name;
    teamName.oninput = () => {
      profile.team.name = teamName.value;
      this.queueTeamUpdate();
    };
    $("btn-random-names").onclick = () => {
      profile.team.worms = randomWormNames(8);
      this.renderWormInputs(true);
      this.queueTeamUpdate();
    };
  }

  queueTeamUpdate() {
    this.app.saveProfile();
    clearTimeout(this.teamTimer);
    this.teamTimer = setTimeout(() => this.app.sendTeam(), 250);
  }

  renderWormInputs(force = false) {
    const box = $("worm-names");
    const profile = this.app.profile;
    const count = this.settings.worms;
    if (!force && box.childElementCount === count) return;
    box.replaceChildren();
    for (let i = 0; i < count; i++) {
      const input = document.createElement("input");
      input.maxLength = 16;
      input.value = profile.team.worms[i] ?? "";
      input.placeholder = `Wurm ${i + 1}`;
      input.oninput = () => {
        profile.team.worms[i] = input.value;
        this.queueTeamUpdate();
      };
      box.append(input);
    }
  }

  render(room) {
    this.room = room;
    const me = this.app.me;
    const host = this.isHost();
    const settings = this.settings;
    const players = room.players;

    $("lobby-code").textContent = this.app.roomCode;
    $("lobby-count").textContent = `${players.length}/6${room.spectators ? ` · ${room.spectators} schauen zu` : ""}`;

    const list = $("player-list");
    list.replaceChildren();
    for (const p of players) {
      const li = document.createElement("li");
      li.className = "player" + (p.on ? "" : " offline");
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = TEAM_COLORS[p.color] ?? "#999";
      const info = document.createElement("div");
      info.className = "info";
      const name = document.createElement("div");
      name.className = "pname";
      name.textContent = p.name + (p.id === me ? " (du)" : "");
      const team = document.createElement("div");
      team.className = "tname";
      team.textContent = (p.team?.name || "Team ohne Namen") + " · " + (p.team?.worms ?? []).slice(0, settings.worms).filter(Boolean).join(", ");
      info.append(name, team);
      li.append(sw, info);
      if (p.id === room.host) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "👑 Host";
        li.append(tag);
      } else if (host) {
        const kick = document.createElement("button");
        kick.className = "btn tiny";
        kick.textContent = "✕";
        kick.title = "Aus dem Raum werfen";
        kick.onclick = () => this.app.net.send({ t: "kick", pid: p.id });
        li.append(kick);
      }
      list.append(li);
    }
    for (let i = players.length; i < Math.min(6, players.length + 1); i++) {
      const li = document.createElement("li");
      li.className = "player empty";
      li.textContent = "Freier Platz – Link teilen!";
      list.append(li);
    }

    // Farbauswahl
    const mine = players.find((p) => p.id === me);
    const picker = $("color-picker");
    picker.replaceChildren();
    TEAM_COLORS.forEach((c, i) => {
      const b = document.createElement("button");
      b.style.background = c;
      b.title = TEAM_COLOR_NAMES[i];
      b.className = mine?.color === i ? "active" : "";
      b.disabled = players.some((p) => p.id !== me && p.color === i);
      b.onclick = () => {
        this.app.profile.color = i;
        this.app.saveProfile();
        this.app.sendTeam();
      };
      picker.append(b);
    });
    this.renderWormInputs();

    // Einstellungen
    $("settings-note").textContent = host ? "du bist Host" : "nur der Host kann ändern";
    for (const def of SETTINGS_UI) {
      const ctl = this.controls.get(def.key);
      ctl.disabled = !host;
      if (document.activeElement === ctl) continue;
      if (def.check) ctl.checked = !!settings[def.key];
      else ctl.value = String(settings[def.key]);
    }
    for (const [id, sel] of this.ammoControls) {
      sel.disabled = !host;
      sel.value = String(settings.ammo[id] ?? 0);
    }
    for (const b of $("ammo-presets").children) b.disabled = !host;

    const start = $("btn-start");
    start.disabled = !host || players.length < 1;
    start.textContent = players.length === 1 ? "Übungsspiel starten" : "Spiel starten";
    $("start-note").textContent = host
      ? (players.length === 1 ? "Allein? Du kannst schon mal üben – oder warte auf Freunde." : `${players.length} Teams bereit.`) +
        " Du bist Gastgeber: Der Raum läuft in diesem Tab, also bitte offen lassen."
      : "Warte, bis der Host das Spiel startet…";
  }

  addChat(name, color, text, system = false) {
    const log = $("lobby-chat");
    const line = document.createElement("div");
    if (system) {
      line.className = "sys";
      line.textContent = text;
    } else {
      const who = document.createElement("b");
      who.textContent = name + ": ";
      who.style.color = TEAM_COLORS[color] ?? "inherit";
      line.append(who, text);
    }
    log.append(line);
    log.scrollTop = log.scrollHeight;
  }
}
