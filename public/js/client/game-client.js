import { World } from "../game/world.js";
import { PROJECTILES, TEAM_COLORS } from "../game/const.js";
import { WEAPON } from "../game/weapons.js";
import { Renderer } from "./renderer.js";
import { Effects } from "./effects.js";
import { Input } from "./input.js";
import { Hud } from "./hud.js";

const STEP = 1 / 60;
const OUCH = ["Autsch!", "Aua!", "Hey!", "Das gibt Rache!", "Uff!", "Nicht nett!"];
const $ = (id) => document.getElementById(id);

// Verbindet Simulation, Netzwerk, Eingabe und Darstellung.
// Wer am Zug ist ("Authority"), simuliert und verschickt Updates; alle anderen spielen sie nur ab.
export class GameClient {
  constructor(app, msg) {
    this.app = app;
    this.me = app.me;
    this.sound = app.sound;
    this.canvas = $("canvas");
    this.renderer = new Renderer(this.canvas);
    this.fx = new Effects();
    this.hud = new Hud(this);
    this.input = new Input(this, this.canvas);
    this.cam = { x: 0, y: 0, zoom: 1, tzoom: 1, manualUntil: 0 };
    this.rpos = new Map();
    this.online = new Set();
    this.acc = 0;
    this.cache = { ents: new Map() };
    this.focusId = 0;
    this.arrowUntil = 0;
    this.lastTick = 0;
    this.lastSecond = -1;
    this.running = true;

    this.load(msg.cp);
    this.auth = msg.auth;
    this.syncing = msg.t === "sync";
    this.lastSeq = this.world.turn.seq;
    this.setRoom(app.room);
    this.announceTurn();
    this.centerOn(this.world.activeWorm(), true);

    this.onResize = () => this.renderer.resize();
    window.addEventListener("resize", this.onResize);
    this.bindUi();
    if (!localStorage.getItem("wk.helpSeen")) {
      localStorage.setItem("wk.helpSeen", "1");
      this.toggleHelp(true);
    }
    this.last = performance.now();
    requestAnimationFrame((ts) => this.frame(ts));
    // Im Hintergrund-Tab pausiert requestAnimationFrame. Damit das Spiel für die anderen
    // nicht einfriert, wenn der aktive Spieler den Tab wechselt, weiter simulieren.
    this.bgTimer = setInterval(() => this.background(), 250);
  }

  destroy() {
    this.running = false;
    clearInterval(this.bgTimer);
    this.input.destroy();
    window.removeEventListener("resize", this.onResize);
    this.sound.stopAll();
    for (const id of ["weapon-menu", "help", "game-menu", "game-over"]) $(id).classList.add("hidden");
    $("hud-chat").replaceChildren();
  }

  bindUi() {
    $("btn-mute").onclick = () => this.toggleMute();
    $("btn-help").onclick = () => this.toggleHelp();
    $("btn-menu").onclick = () => this.toggleGameMenu();
    $("help").querySelector("[data-close]").onclick = () => this.toggleHelp(false);
    $("btn-resume").onclick = () => this.toggleGameMenu(false);
    $("btn-abort").onclick = () => {
      if (confirm("Spiel für alle abbrechen und zurück zur Lobby?")) this.app.net.send({ t: "lobby" });
    };
    $("btn-quit").onclick = () => this.app.leaveRoom();
    $("btn-over-lobby").onclick = () => this.app.net.send({ t: "lobby" });
    $("btn-mute").textContent = this.sound.muted ? "🔇" : "🔊";
    const form = $("hud-chat-form");
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      if (input.value.trim()) this.app.net.send({ t: "chat", text: input.value });
      input.value = "";
      input.blur();
      form.classList.add("hidden");
    };
    form.querySelector("input").onkeydown = (e) => {
      if (e.code === "Escape") {
        e.target.value = "";
        e.target.blur();
        form.classList.add("hidden");
      }
    };
  }

  load(cp) {
    this.world = World.fromCheckpoint(cp);
    this.renderer.setWorld(this.world);
    this.rpos.clear();
  }

  // Checkpoint übernehmen, Gelände nur neu malen, wenn es wirklich anders ist
  applyCheckpoint(cp) {
    if (cp.mask === this.world.terrain.encode() && cp.w === this.world.w) {
      this.world.loadCheckpoint(cp, this.world.terrain);
    } else {
      this.world.loadCheckpoint(cp);
      this.renderer.setWorld(this.world);
    }
  }

  setRoom(room) {
    if (!room) return;
    this.room = room;
    this.online = new Set(room.players.filter((p) => p.on).map((p) => p.id));
  }

  isHost() {
    return this.app.room?.host === this.me;
  }

  isAuth() {
    return this.auth === this.me && !this.syncing;
  }

  myTeam() {
    return this.world.teams[this.world.turn.team]?.pid === this.me;
  }

  myTurn() {
    const p = this.world.turn.phase;
    return this.myTeam() && (p === "play" || p === "retreat");
  }

  // ---------- Netzwerk ----------

  onMessage(m) {
    switch (m.t) {
      case "s":
        if (!this.isAuth()) this.world.applyDelta(m);
        break;
      case "turn": {
        const wasAuth = this.isAuth();
        this.auth = m.auth;
        if (m.from !== this.me) {
          this.applyCheckpoint(m.cp);
          this.lastSeq = this.world.turn.seq;
        }
        if (this.isAuth() && !wasAuth) this.becomeAuth();
        break;
      }
      case "auth": {
        const wasAuth = this.isAuth();
        this.auth = m.auth;
        if (m.lost) {
          const name = this.room?.players.find((p) => p.id === m.lost)?.name ?? "Ein Spieler";
          this.app.toast(`${name} ist weg – das Spiel läuft weiter.`);
        }
        if (this.isAuth() && !wasAuth) this.becomeAuth();
        break;
      }
      case "synced":
        this.syncing = false;
        if (this.isAuth()) this.becomeAuth();
        break;
    }
  }

  becomeAuth() {
    this.cache = { ents: new Map() };
    this.acc = 0;
    this.world.outbox.length = 0;
    this.lastSeq = this.world.turn.seq;
  }

  flush() {
    const msg = this.world.makeDelta(this.cache);
    if (msg) this.app.net.sendRaw(msg);
  }

  handoff() {
    this.lastSeq = this.world.turn.seq;
    this.flush();
    const next = this.world.teams[this.world.turn.team].pid;
    this.app.net.send({ t: "turn", auth: next, cp: this.world.toCheckpoint() });
    this.auth = next;
  }

  simulate(dt, maxSteps = 6) {
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < maxSteps) {
      this.acc -= STEP;
      steps++;
      const w = this.world;
      w.online = this.online;
      const t = w.turn;
      const owner = w.teams[t.team]?.pid;
      if ((t.phase === "play" || t.phase === "retreat") && owner !== this.me && !this.online.has(owner)) w.forfeitTurn();
      const inp = this.input.consume();
      w.step(this.myTurn() ? inp : null);
      if (w.tick % 2 === 0) this.flush();
      if (w.turn.seq !== this.lastSeq) {
        this.handoff();
        if (!this.isAuth()) break;
      }
    }
    if (steps >= maxSteps) this.acc = 0;
  }

  background() {
    if (!document.hidden || !this.running) return;
    const now = performance.now();
    const dt = Math.min(1.5, (now - this.last) / 1000);
    this.last = now;
    if (this.isAuth()) this.simulate(dt, 100);
    this.processEvents(true);
  }

  // ---------- Hauptschleife ----------

  frame(ts) {
    if (!this.running) return;
    const dt = Math.min(0.1, (ts - this.last) / 1000);
    this.last = ts;
    if (this.isAuth()) this.simulate(dt);
    else this.input.consume();

    if (this.world.turn.seq !== this.shownSeq) this.announceTurn();
    this.processEvents();
    this.continuousEffects(dt);
    this.fx.update(dt);
    this.updatePositions(dt);
    this.updateCamera(dt);

    const wp = WEAPON[this.world.turn.weapon];
    let target = null;
    if (this.myTurn() && this.world.turn.phase === "play" && wp?.target && this.input.mouse && !this.world.turn.fired) {
      target = this.renderer.toWorld(this.cam, this.input.mouse.x, this.input.mouse.y);
      if (wp.id === "airstrike") target.dir = this.world.activeWorm()?.face;
    }
    this.renderer.draw({
      world: this.world, cam: this.cam, fx: this.fx, dt, target,
      pos: (e) => this.rpos.get(e.id) ?? e,
      moving: (e) => performance.now() - (this.rpos.get(e.id)?.movedAt ?? 0) < 150,
      showArrow: performance.now() < this.arrowUntil,
    });
    this.hud.update(this.world, this.myTurn());
    this.timerTick();
    requestAnimationFrame((t) => this.frame(t));
  }

  announceTurn() {
    const w = this.world;
    this.shownSeq = w.turn.seq;
    if (w.turn.phase !== "play") return;
    const team = w.teams[w.turn.team];
    const worm = w.activeWorm();
    this.arrowUntil = performance.now() + 3000;
    this.cam.manualUntil = 0;
    if (team?.pid === this.me) {
      this.hud.banner(`Du bist dran! ${worm?.name ?? ""} wartet auf Befehle`);
      this.sound.play("myturn");
    } else {
      this.hud.banner(`${team?.name ?? "?"}: ${worm?.name ?? ""} ist dran`);
      this.sound.play("turn");
    }
  }

  timerTick() {
    const t = this.world.turn;
    if (t.phase !== "play" || !this.myTeam()) return;
    const sec = Math.ceil(t.time / 60);
    if (sec !== this.lastSecond) {
      this.lastSecond = sec;
      if (sec <= 5 && sec > 0) this.sound.play("tick");
    }
  }

  // quiet: nur das Gelände aktualisieren (Tab im Hintergrund), keine Effekte oder Sounds
  processEvents(quiet = false) {
    const world = this.world;
    if (!world.events.length) return;
    const events = world.events;
    world.events = [];
    for (const ev of events) {
      if (quiet) {
        if (ev[0] === "x") this.renderer.terrain.carve(ev[1], ev[2], ev[3]);
        continue;
      }
      switch (ev[0]) {
        case "x": {
          const [, x, y, r, dmg] = ev;
          this.renderer.terrain.carve(x, y, r);
          if (dmg > 0) {
            this.fx.explosion(x, y, r, this.renderer.dirtColor);
            this.sound.explosion(r);
          } else if (r > 6) {
            this.fx.puff(x, y, 5, 170);
            this.sound.play("small");
          } else {
            this.fx.puff(x, y, 2, 90);
          }
          break;
        }
        case "dmg": {
          const w = world.ents.get(ev[1]);
          if (!w) break;
          const color = TEAM_COLORS[world.teams[w.team]?.color] ?? "#fff";
          this.fx.floatText(w.x, w.y, `-${ev[2]}`, color, 20);
          if (ev[2] >= 5 && w.hp > 0 && Math.random() < 0.35) this.fx.say(w.id, OUCH[Math.floor(Math.random() * OUCH.length)]);
          this.sound.play("hurt");
          break;
        }
        case "heal": {
          const w = world.ents.get(ev[1]);
          if (w) this.fx.floatText(w.x, w.y, `+${ev[2]}`, "#5dff7a", 20);
          break;
        }
        case "say":
          this.fx.say(ev[1], ev[2]);
          break;
        case "snd":
          this.sound.play(ev[1]);
          break;
        case "fx":
          this.visual(ev);
          break;
        case "msg":
          this.hud.banner(ev[1], true, 3500);
          break;
        case "over":
          this.sound.play("victory");
          break;
      }
    }
  }

  visual(ev) {
    const [, kind, a, b, c, d] = ev;
    switch (kind) {
      case "tracer":
        this.fx.tracer(a, b, c, d);
        break;
      case "ropemiss":
        this.fx.tracer(a, b, c, d);
        break;
      case "plane":
        this.fx.plane(a, b);
        break;
      case "tele":
        this.fx.sparkle(a, b);
        this.fx.sparkle(c, d);
        break;
      case "splash":
        this.fx.splash(a, b, c);
        this.sound.play("splash");
        break;
      case "fizzle":
        this.fx.puff(a, b, 8, 120);
        break;
      case "hit":
        this.fx.texts.push({ x: a, y: b - 10, text: "POW!", color: "#fff", age: 0, life: 0.7, size: 22, comic: true });
        break;
      case "punch": {
        const w = this.world.ents.get(a);
        if (w) this.fx.texts.push({ x: w.x + w.face * 14, y: w.y - 14, text: "ZONK!", color: "#ffd23d", age: 0, life: 0.7, size: 22, comic: true });
        break;
      }
    }
  }

  continuousEffects(dt) {
    let jet = false;
    for (const e of this.world.ents.values()) {
      const p = this.rpos.get(e.id) ?? e;
      if ((e.type === "missile" || e.type === "airmissile") && Math.random() < 0.9) this.fx.trail(p.x - e.vx * 0.5, p.y - e.vy * 0.5);
      else if (e.type === "fire" && Math.random() < dt * 20) this.fx.flame(p.x, p.y - 3, (Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.6);
      else if (e.type === "worm" && e.mode === "jet" && e.thr) {
        jet = true;
        this.fx.flame(p.x - e.face * 9, p.y + 8, (Math.random() - 0.5) * 0.6, 1.5 + Math.random());
      } else if (e.type === "supersheep" && e.mode === "fly" && Math.random() < 0.5) this.fx.sparkle(p.x, p.y, "#ffd23d");
      else if (e.type === "holy" && Math.random() < dt * 8) this.fx.add({ kind: "spark", x: p.x, y: p.y, vx: 0, vy: -0.5, size: 2, life: 0.5, color: "#fff6b0" });
    }
    this.sound.loop("jet", jet);
  }

  updatePositions(dt) {
    const auth = this.isAuth();
    const k = 1 - Math.exp(-dt * 22);
    const now = performance.now();
    for (const e of this.world.ents.values()) {
      let r = this.rpos.get(e.id);
      if (!r) {
        this.rpos.set(e.id, { x: e.x, y: e.y, px: e.x, movedAt: 0 });
        continue;
      }
      const dx = e.x - r.x;
      const dy = e.y - r.y;
      if (auth || dx * dx + dy * dy > 90 * 90) {
        r.x = e.x;
        r.y = e.y;
      } else {
        r.x += dx * k;
        r.y += dy * k;
      }
      if (Math.abs(e.x - r.px) > 0.05) r.movedAt = now;
      r.px = e.x;
    }
    if (this.rpos.size > this.world.ents.size + 50) {
      for (const id of this.rpos.keys()) if (!this.world.ents.has(id)) this.rpos.delete(id);
    }
  }

  // ---------- Kamera ----------

  focus() {
    const w = this.world;
    const t = w.turn;
    let best = null;
    if (t.ctrl && w.ents.has(t.ctrl)) best = w.ents.get(t.ctrl);
    else {
      for (const e of w.ents.values()) if (PROJECTILES.has(e.type) && (!best || e.id > best.id)) best = e;
    }
    if (!best) {
      for (const e of w.ents.values()) {
        if (e.type === "worm" && !e.dead && (e.mode === "fly" || e.drown) && (!best || Math.abs(e.vy) > Math.abs(best.vy))) best = e;
      }
    }
    if (!best && t.phase === "settle" && t.sub === "dying") best = w.ents.get(t.dying);
    if (!best) for (const e of w.ents.values()) if (e.type === "crate" && e.chute) best = e;
    if (!best) {
      const worm = w.activeWorm();
      if (worm && !worm.dead) best = worm;
    }
    return best;
  }

  updateCamera(dt) {
    const cam = this.cam;
    const target = this.focus();
    const now = performance.now();
    if (target && target.id !== this.focusId) {
      this.focusId = target.id;
      if (target.type !== "worm") cam.manualUntil = 0;
    }
    if (target && now > cam.manualUntil) {
      const p = this.rpos.get(target.id) ?? target;
      const k = 1 - Math.exp(-dt * (PROJECTILES.has(target.type) ? 6 : 3.5));
      cam.x += (p.x - cam.x) * k;
      cam.y += (p.y - 40 / cam.zoom - cam.y) * k;
    }
    cam.zoom += (cam.tzoom - cam.zoom) * (1 - Math.exp(-dt * 10));
    this.clampCamera();
  }

  clampCamera() {
    const cam = this.cam;
    const w = this.world;
    const hw = this.renderer.width / 2 / cam.zoom;
    const hh = this.renderer.height / 2 / cam.zoom;
    cam.x = hw * 2 > w.w + 400 ? w.w / 2 : Math.max(hw - 200, Math.min(w.w + 200 - hw, cam.x));
    cam.y = Math.max(-300 + hh, Math.min(w.h + 60 - hh, cam.y));
  }

  centerOn(e, instant = false) {
    if (!e) return;
    this.cam.manualUntil = 0;
    if (instant) {
      this.cam.x = e.x;
      this.cam.y = e.y - 40;
      this.clampCamera();
    }
  }

  recenter() {
    this.cam.manualUntil = 0;
  }

  pan(x, y) {
    this.cam.x = x;
    this.cam.y = y;
    this.cam.manualUntil = performance.now() + 5000;
    this.clampCamera();
  }

  zoom(factor) {
    const min = Math.max(0.35, Math.min(1, this.renderer.width / (this.world.w + 300)));
    this.cam.tzoom = Math.max(min, Math.min(2.2, this.cam.tzoom * factor));
  }

  // ---------- Bedienung ----------

  clickAt(sx, sy) {
    const wp = WEAPON[this.world.turn.weapon];
    if (!this.myTurn() || !wp?.target || this.world.turn.fired) return;
    const p = this.renderer.toWorld(this.cam, sx, sy);
    this.input.click = { x: Math.round(p.x), y: Math.round(p.y) };
  }

  selectWeapon(id) {
    if (!this.myTurn()) return;
    this.input.select = id;
    this.toggleWeaponMenu(false);
    this.sound.play("click");
  }

  panelOpen() {
    return ["weapon-menu", "help", "game-menu"].some((id) => !$(id).classList.contains("hidden"));
  }

  toggleWeaponMenu(force) {
    const el = $("weapon-menu");
    const show = force ?? el.classList.contains("hidden");
    if (show) {
      $("help").classList.add("hidden");
      $("game-menu").classList.add("hidden");
      this.hud.cache.menu = null;
      this.hud.refreshWeaponMenu(this.world, this.myTurn());
    }
    el.classList.toggle("hidden", !show);
  }

  toggleHelp(force) {
    const el = $("help");
    const show = force ?? el.classList.contains("hidden");
    if (show) {
      $("weapon-menu").classList.add("hidden");
      $("game-menu").classList.add("hidden");
    }
    el.classList.toggle("hidden", !show);
  }

  toggleGameMenu(force) {
    const el = $("game-menu");
    const show = force ?? el.classList.contains("hidden");
    if (show) {
      $("weapon-menu").classList.add("hidden");
      $("help").classList.add("hidden");
      $("btn-abort").classList.toggle("hidden", !this.isHost());
    }
    el.classList.toggle("hidden", !show);
  }

  escape() {
    if (this.panelOpen()) {
      for (const id of ["weapon-menu", "help", "game-menu"]) $(id).classList.add("hidden");
    } else this.toggleGameMenu(true);
  }

  toggleMute() {
    const muted = this.sound.toggleMute();
    $("btn-mute").textContent = muted ? "🔇" : "🔊";
  }

  openChat() {
    const form = $("hud-chat-form");
    form.classList.remove("hidden");
    form.querySelector("input").focus();
  }

  chat(name, color, text) {
    this.hud.chat(name, color, text);
  }
}
