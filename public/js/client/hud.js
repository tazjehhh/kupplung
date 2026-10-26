import { TEAM_COLORS } from "../game/const.js";
import { WEAPONS, WEAPON, CATEGORIES } from "../game/weapons.js";

const $ = (id) => document.getElementById(id);

// DOM-Oberfläche über dem Spielfeld. Aktualisiert nur, was sich geändert hat.
export class Hud {
  constructor(client) {
    this.client = client;
    this.cache = {};
    this.bannerTimer = 0;
    this.buildWeaponMenu();
    $("hud-weapon").onclick = () => client.toggleWeaponMenu();
  }

  set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  buildWeaponMenu() {
    const menu = $("weapon-menu");
    menu.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = "Waffen";
    menu.append(title);
    this.wbuttons = new Map();
    CATEGORIES.forEach((cat, ci) => {
      const box = document.createElement("div");
      box.className = "cat";
      const h = document.createElement("h3");
      h.textContent = cat;
      const row = document.createElement("div");
      row.className = "row";
      for (const wp of WEAPONS.filter((w) => w.cat === ci)) {
        const b = document.createElement("button");
        b.className = "wbtn";
        b.innerHTML = `<span>${wp.icon}</span><span class="ammo"></span>`;
        b.onmouseenter = () => this.showInfo(wp);
        b.onfocus = () => this.showInfo(wp);
        b.onclick = () => this.client.selectWeapon(wp.id);
        row.append(b);
        this.wbuttons.set(wp.id, b);
      }
      box.append(h, row);
      menu.append(box);
    });
    this.info = document.createElement("div");
    this.info.className = "info";
    menu.append(this.info);
  }

  showInfo(wp) {
    this.info.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = `${wp.icon} ${wp.name}`;
    this.info.append(b, wp.hint);
  }

  refreshWeaponMenu(world, mine) {
    const t = world.turn;
    const ammo = world.teams[t.team]?.ammo ?? {};
    for (const [id, b] of this.wbuttons) {
      const n = ammo[id] ?? 0;
      b.querySelector(".ammo").textContent = n < 0 ? "∞" : String(n);
      b.disabled = !mine || !world.canSelect(id);
      b.classList.toggle("active", t.weapon === id);
    }
    this.showInfo(WEAPON[t.weapon] ?? WEAPONS[0]);
  }

  banner(text, big = false, ms = 2600) {
    const el = $("hud-banner");
    el.textContent = text;
    el.classList.toggle("big", big);
    el.classList.add("show");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  chat(name, color, text) {
    const box = $("hud-chat");
    const line = document.createElement("div");
    const who = document.createElement("b");
    who.textContent = name + ": ";
    who.style.color = TEAM_COLORS[color] ?? "#ffd23d";
    line.append(who, text);
    box.append(line);
    while (box.childElementCount > 6) box.firstElementChild.remove();
    setTimeout(() => (line.style.opacity = "0"), 9000);
    setTimeout(() => line.remove(), 10000);
  }

  update(world, mine) {
    const t = world.turn;

    // Zeit
    let timer = "";
    let cls = "timer";
    if (t.phase === "play") {
      const sec = Math.max(0, Math.ceil(t.time / 60));
      timer = String(sec);
      if (sec <= 5) cls += " warn";
    } else if (t.phase === "retreat") {
      timer = String(Math.max(0, Math.ceil(t.retreat / 60)));
      cls += " retreat";
    } else if (t.phase === "settle") {
      timer = "…";
      cls += " idle";
    }
    const teamColor = TEAM_COLORS[world.teams[t.team]?.color] ?? "#fff";
    this.set("timer", timer + cls + teamColor, () => {
      const el = $("hud-timer");
      el.textContent = timer;
      el.className = cls;
      el.style.borderColor = t.phase === "play" ? teamColor : "";
    });

    // Wind
    this.set("wind", world.wind, (wind) => {
      const el = $("hud-wind");
      const pct = Math.abs(wind) * 50;
      el.style.left = wind < 0 ? `${50 - pct}%` : "50%";
      el.style.width = `${pct}%`;
    });
    this.set("sd", world.sd, (sd) => $("hud-sd").classList.toggle("hidden", !sd));

    // Waffe
    const wp = WEAPON[t.weapon];
    const ammo = world.ammoOf(t.team, t.weapon);
    const wkey = `${t.weapon}|${ammo}|${t.fuse}|${mine}|${t.phase}`;
    this.set("weapon", wkey, () => {
      const el = $("hud-weapon");
      el.classList.toggle("disabled", !mine);
      if (!wp) return el.replaceChildren();
      const extra = wp.fuse ? `Zünder ${t.fuse} s` : wp.shots ? `${wp.shots} Schüsse` : wp.target ? "Ziel anklicken" : "";
      el.innerHTML = `<span class="ico"></span><span class="meta"><span class="nm"></span><small></small></span>`;
      el.querySelector(".ico").textContent = wp.icon;
      el.querySelector(".nm").textContent = wp.name;
      el.querySelector("small").textContent = [ammo < 0 ? "∞" : `${ammo}×`, extra].filter(Boolean).join(" · ");
    });

    // Teams
    const teams = world.teams.map((team, i) => ({ i, team, hp: world.teamHp(i), alive: world.teamAlive(i) }));
    const max = Math.max(1, ...teams.map((x) => x.hp));
    const tkey = teams.map((x) => `${x.hp}${x.alive}`).join(",") + t.team;
    this.set("teams", tkey, () => {
      const box = $("hud-teams");
      box.replaceChildren();
      for (const x of [...teams].sort((a, b) => b.hp - a.hp)) {
        const row = document.createElement("div");
        row.className = "team-bar" + (x.i === t.team ? " active" : "") + (x.alive ? "" : " out");
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = x.team.name;
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.width = `${Math.round((x.hp / max) * 220)}px`;
        bar.style.background = TEAM_COLORS[x.team.color] ?? "#888";
        row.append(name, bar);
        box.append(row);
      }
    });

    if (!$("weapon-menu").classList.contains("hidden")) {
      this.set("menu", wkey + JSON.stringify(world.teams[t.team]?.ammo) + world.canSelect(t.weapon), () => this.refreshWeaponMenu(world, mine));
    }

    // Spielende
    this.set("over", t.phase === "over" ? `${t.winner}` : "", (v) => {
      const panel = $("game-over");
      if (!v) return panel.classList.add("hidden");
      const team = world.teams[t.winner];
      $("over-title").textContent = team ? `${team.name} gewinnt!` : "Unentschieden!";
      $("over-title").style.color = team ? TEAM_COLORS[team.color] : "";
      $("over-text").textContent = team ? `Glückwunsch an ${team.player}! 🎉` : "Keiner hat überlebt. Typisch.";
      const host = this.client.isHost();
      $("btn-over-lobby").classList.toggle("hidden", !host);
      $("over-wait").classList.toggle("hidden", host);
      panel.classList.remove("hidden");
    });
  }
}
