import { MAP_SIZES, THEMES, PROJECTILES, WORM_R, WALK_SPEED, ROPE_MAX, JUMP_PREP } from "./const.js";
import { Rng } from "./rng.js";
import { Terrain } from "./terrain.js";
import { generateMap } from "./mapgen.js";
import { walkStep } from "./physics.js";
import { WEAPON, WEAPONS, CRATE_WEAPONS, PROJECTILE_UPDATE, useWeapon, shootRope, controlProjectile } from "./weapons.js";
import { updateWorm, startBungee, OBJECT_UPDATE, surfaceSpots, pickSpot } from "./entities.js";
import { normalizeSettings, CRATE_CHANCE, WATER_RISE } from "./settings.js";

const KNOCKABLE = new Set(["worm", "grenade", "cluster", "banana", "holy", "dynamite", "sheep", "oldwoman", "supersheep", "mine", "barrel", "crate", "grave"]);

const DEATH_LINES = ["Tschüss!", "Ich komme wieder…", "Mama?", "Das war's wohl.", "Rächt mich!", "Autsch…"];
const START_LINES = ["Los geht's!", "Jetzt bin ich dran!", "Auf sie mit Gebrüll!", "Mal sehen…", "Zeit für Rache!", "Hehehe…"];

// Rundet Fließkommazahlen beim Serialisieren auf zwei Nachkommastellen.
export function roundReplacer(key, value) {
  return typeof value === "number" && !Number.isInteger(value) ? Math.round(value * 100) / 100 : value;
}

export class World {
  constructor() {
    this.ents = new Map();
    this.events = []; // für Effekte/Sound im eigenen Client
    this.outbox = []; // für das Netzwerk (nur Authority)
    this.online = null; // Set der verbundenen Spieler-IDs (nur Authority)
  }

  static create({ settings, players, seed }) {
    const s = normalizeSettings(settings);
    const world = new World();
    const rng = new Rng(seed);
    world.rng = rng;
    const size = MAP_SIZES[s.mapSize] ?? MAP_SIZES.medium;
    world.w = size.w;
    world.h = size.h;
    world.theme = THEMES.includes(s.theme) ? s.theme : rng.pick(THEMES);
    world.water = size.h - 42;
    const { terrain, style } = generateMap(size.w, size.h, rng.int(1, 2 ** 31), world.water);
    world.terrain = terrain;
    world.style = style;
    world.orig = terrain.encode();
    world.settings = s;
    world.tick = 0;
    world.nextId = 1;
    world.wind = 0;
    world.gameTime = 0;
    world.sd = false;
    world.turn = { seq: 0, fuse: 3 };
    world.teams = players.map((p) => ({
      pid: p.id,
      player: p.name,
      name: p.team?.name || `Team ${p.name}`,
      color: p.color,
      ammo: { ...s.ammo },
      next: 0,
      last: "bazooka",
    }));
    world.practice = world.teams.length < 2;

    const spots = surfaceSpots(world, WORM_R);
    const taken = [];
    for (let k = 0; k < s.worms; k++) {
      players.forEach((p, ti) => {
        const spot = pickSpot(world, spots, taken, 55);
        if (!spot) return;
        taken.push(spot);
        world.spawn({
          type: "worm", team: ti, idx: k, name: p.team?.worms?.[k] || `Wurm ${k + 1}`, hp: s.hp,
          x: spot.x, y: spot.y, vx: 0, vy: 0, face: spot.x < world.w / 2 ? 1 : -1, aim: -0.3,
          mode: "stand", dead: false, drown: false,
        });
      });
    }
    const objSpots = surfaceSpots(world, 8, 5);
    for (let i = 0; i < s.mines; i++) {
      const spot = pickSpot(world, objSpots, taken, 45);
      if (!spot) break;
      taken.push(spot);
      world.spawn({ type: "mine", x: spot.x, y: spot.y + 4, vx: 0, vy: 0, fuse: -1, dud: s.dudMines && rng.next() < 0.15, rest: true });
    }
    for (let i = 0; i < s.barrels; i++) {
      const spot = pickSpot(world, objSpots, taken, 40);
      if (!spot) break;
      taken.push(spot);
      world.spawn({ type: "barrel", x: spot.x, y: spot.y, vx: 0, vy: 0, hp: 40, rest: true });
    }
    world.beginTurn(rng.int(0, world.teams.length - 1));
    return world;
  }

  static fromCheckpoint(cp) {
    const world = new World();
    world.loadCheckpoint(cp);
    return world;
  }

  loadCheckpoint(cp, terrain) {
    this.w = cp.w;
    this.h = cp.h;
    this.theme = cp.theme;
    this.style = cp.style;
    this.orig = cp.orig;
    this.terrain = terrain ?? Terrain.decode(cp.w, cp.h, cp.mask);
    this.tick = cp.tick;
    this.nextId = cp.nextId;
    this.rng = new Rng(1);
    this.rng.s = cp.rng >>> 0;
    this.wind = cp.wind;
    this.water = cp.water;
    this.gameTime = cp.gameTime;
    this.sd = cp.sd;
    this.practice = cp.practice;
    this.settings = normalizeSettings(cp.settings);
    this.teams = cp.teams.map((t) => ({ ...t, ammo: { ...t.ammo } }));
    this.turn = { ...cp.turn };
    this.ents = new Map(cp.ents.map((e) => [e.id, structuredClone(e)]));
  }

  toCheckpoint() {
    return {
      v: 1, w: this.w, h: this.h, theme: this.theme, style: this.style, orig: this.orig,
      mask: this.terrain.encode(), tick: this.tick, nextId: this.nextId, rng: this.rng.s,
      wind: this.wind, water: this.water, gameTime: this.gameTime, sd: this.sd, practice: this.practice,
      settings: this.settings, teams: this.teams, turn: this.turn, ents: [...this.ents.values()],
    };
  }

  // ---------- Entitäten ----------

  spawn(obj) {
    obj.id = this.nextId++;
    this.ents.set(obj.id, obj);
    return obj;
  }

  remove(e) {
    e.removed = true;
    this.ents.delete(e.id);
  }

  emit(ev) {
    this.events.push(ev);
    this.outbox.push(ev);
  }

  worms() {
    const list = [];
    for (const e of this.ents.values()) if (e.type === "worm") list.push(e);
    return list;
  }

  teamWorms(team) {
    return this.worms().filter((w) => w.team === team).sort((a, b) => a.idx - b.idx);
  }

  teamAlive(team) {
    return this.worms().some((w) => w.team === team && !w.dead && !w.drown && w.hp > 0);
  }

  teamHp(team) {
    return this.worms().reduce((sum, w) => sum + (w.team === team && !w.dead ? w.hp : 0), 0);
  }

  activeWorm() {
    return this.ents.get(this.turn.worm);
  }

  ammoOf(team, id) {
    return this.teams[team]?.ammo?.[id] ?? 0;
  }

  useAmmo(team, id) {
    const ammo = this.teams[team].ammo;
    if (ammo[id] > 0) ammo[id] -= 1;
  }

  wormAt(x, y, r, ignoreId = 0) {
    for (const e of this.ents.values()) {
      if (e.type !== "worm" || e.dead || e.drown || e.id === ignoreId) continue;
      if (Math.hypot(e.x - x, e.y - 1 - y) < r + WORM_R + 1) return e;
    }
    return null;
  }

  objectAt(x, y, r) {
    for (const e of this.ents.values()) {
      const reach = e.type === "barrel" ? 8 : e.type === "crate" ? 9 : e.type === "mine" ? 4 : -1;
      if (reach > 0 && Math.hypot(e.x - x, e.y - y) < r + reach) return e;
    }
    return null;
  }

  isKnockable(e) {
    return KNOCKABLE.has(e.type) && !(e.type === "supersheep" && e.mode === "fly");
  }

  knock(e, vx, vy, set = false) {
    if (set) {
      e.vx = vx;
      e.vy = vy;
    } else {
      e.vx += vx;
      e.vy += vy;
    }
    e.rest = false;
    if (e.type === "worm") {
      e.jumpY = null;
      e.jumpPrep = 0;
      e.rope = null;
      e.bng = null;
      e.thr = false;
      e.mode = "fly";
    } else if (e.type === "sheep" || e.type === "oldwoman" || e.type === "supersheep") {
      e.mode = "air";
    }
  }

  hitObject(obj, dmg, vx, vy) {
    if (obj.type === "barrel") {
      obj.hp -= dmg;
      this.knock(obj, vx, vy);
    } else if (obj.type === "mine") {
      this.knock(obj, vx, vy);
      if (obj.fuse === -1) obj.fuse = 20;
    } else if (obj.type === "crate") {
      obj.boom = true;
    }
  }

  damage(w, amount) {
    if (amount <= 0 || w.dead) return;
    const real = Math.min(w.hp, Math.round(amount));
    w.hp -= real;
    if (real > 0) this.emit(["dmg", w.id, real]);
    const t = this.turn;
    if (t.worm === w.id && (t.phase === "play" || t.phase === "retreat")) this.endTurn();
  }

  explode(x, y, r, dmg) {
    x = Math.round(x);
    y = Math.round(y);
    r = Math.round(r);
    this.terrain.carve(x, y, r);
    this.emit(["x", x, y, r, dmg]);
    if (dmg <= 0) return;
    const reach = r + 12;
    for (const e of [...this.ents.values()]) {
      if (e.removed || e.dead) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy);
      if (d >= reach) continue;
      const f = 1 - d / reach;
      const ux = d > 0.5 ? dx / d : 0;
      const uy = d > 0.5 ? dy / d : -1;
      const power = (dmg / 9) * f + 0.8;
      switch (e.type) {
        case "worm":
          if (e.drown) break;
          this.damage(e, Math.max(1, Math.round(dmg * (0.25 + 0.75 * f))));
          this.knock(e, ux * power, uy * power - power * 0.45);
          break;
        case "barrel":
          e.hp -= dmg * f + 5;
          this.knock(e, ux * power * 0.7, uy * power * 0.7 - 1);
          break;
        case "mine":
          this.knock(e, ux * power, uy * power - 1);
          if (e.fuse === -1) e.fuse = 25 + Math.floor(this.rng.next() * 25);
          break;
        case "crate":
          e.boom = true;
          break;
        default:
          if (this.isKnockable(e)) this.knock(e, ux * power * 0.8, uy * power * 0.8 - 0.8);
      }
    }
  }

  // ---------- Simulation ----------

  step(inp) {
    this.tick++;
    const t = this.turn;
    if (inp) this.control(inp);
    for (const e of [...this.ents.values()]) {
      if (e.removed) continue;
      if (e.type === "worm") updateWorm(this, e);
      else if (PROJECTILE_UPDATE[e.type]) {
        e.age = (e.age ?? 0) + 1;
        PROJECTILE_UPDATE[e.type](this, e);
      } else OBJECT_UPDATE[e.type]?.(this, e);
    }
    if (t.phase === "play" || t.phase === "retreat") {
      const w = this.activeWorm();
      if (w && !w.dead && !w.drown) {
        for (const c of [...this.ents.values()]) {
          if (c.type === "crate" && Math.hypot(c.x - w.x, c.y - w.y) < 18) this.collect(w, c);
        }
      }
    }
    if (t.ctrl && !this.ents.has(t.ctrl)) {
      t.ctrl = 0;
      if (t.phase === "play") this.startRetreat();
    }
    if (t.phase === "play") {
      // Kurze Orientierungszeit: Die Uhr läuft erst los, wenn der Spieler etwas tut
      if (t.ready > 0 && inp && (inp.left || inp.right || inp.up || inp.down || inp.fire || inp.pressed.jump || inp.pressed.back || inp.click)) t.ready = 0;
      if (t.ready > 0) t.ready--;
      else {
        this.gameTime++;
        if (--t.time <= 0) this.endTurn();
      }
    } else if (t.phase === "retreat") {
      this.gameTime++;
      if (--t.retreat <= 0) this.endTurn();
    } else if (t.phase === "settle") {
      this.settle();
    }
  }

  control(inp) {
    const t = this.turn;
    if (t.phase !== "play" && t.phase !== "retreat") return;
    const w = this.activeWorm();
    if (!w || w.dead || w.drown || w.hp <= 0) return;

    if (inp.fuse) t.fuse = inp.fuse;
    if (inp.select && this.canSelect(inp.select)) {
      t.weapon = inp.select;
      this.teams[t.team].last = inp.select;
    }

    if (t.ctrl) {
      const p = this.ents.get(t.ctrl);
      if (p) return controlProjectile(this, p, inp);
    }

    switch (w.mode) {
      case "rope":
        if (inp.left) { w.vx -= 0.09; w.face = -1; }
        if (inp.right) { w.vx += 0.09; w.face = 1; }
        if (inp.up) w.rope.len = Math.max(8, w.rope.len - 2.2);
        if (inp.down) w.rope.len = Math.min(ROPE_MAX, w.rope.len + 2.2);
        if (inp.pressed.fire || inp.pressed.jump) {
          w.mode = "air";
          w.rope = null;
        }
        return;
      case "jet": {
        let thr = false;
        if (w.fuel > 0) {
          if (inp.up) { w.vy -= 0.34; thr = true; }
          if (inp.left) { w.vx -= 0.13; w.face = -1; thr = true; }
          if (inp.right) { w.vx += 0.13; w.face = 1; thr = true; }
          if (thr) w.fuel -= 1;
        }
        w.thr = thr;
        if (inp.pressed.fire) {
          w.mode = "air";
          w.thr = false;
        }
        return;
      }
      case "bungee":
        if (inp.left) { w.vx -= 0.08; w.face = -1; }
        if (inp.right) { w.vx += 0.08; w.face = 1; }
        if (inp.up) w.bng.len = Math.max(6, w.bng.len - 1.5);
        if (inp.down) w.bng.len = Math.min(320, w.bng.len + 1.5);
        if (inp.pressed.fire || inp.pressed.jump) {
          w.mode = "air";
          w.bng = null;
        }
        return;
      case "air":
      case "fly":
        this.aim(w, inp);
        // Ninja-Seil im Flug erneut schießen
        if (t.ropeLock && t.weapon === "rope" && inp.pressed.fire && t.phase === "play") shootRope(this, w);
        return;
    }

    this.aim(w, inp);
    if (w.jumpPrep > 0) {
      // Wurm holt aus; zweites Enter (oder Backspace) macht daraus einen Rückwärtssalto
      if (inp.pressed.jump || inp.pressed.back) w.jumpKind = "back";
      if (--w.jumpPrep === 0) this.jump(w, w.jumpKind);
    } else if (!t.charging && !t.shots) {
      const dir = inp.left ? -1 : inp.right ? 1 : 0;
      if (dir) {
        w.face = dir;
        w.walkAcc = (w.walkAcc ?? 0) + WALK_SPEED;
        while (w.walkAcc >= 1) {
          w.walkAcc -= 1;
          const res = walkStep(this, w, dir);
          if (res === "blocked") {
            w.walkAcc = 0;
            break;
          }
          if (res === "fall") {
            if (t.bungee) startBungee(this, w);
            else {
              w.mode = "air";
              w.vx = dir * 0.5;
              w.vy = 0;
            }
            break;
          }
        }
      } else w.walkAcc = 0;
      if (w.mode === "stand" && (inp.pressed.jump || inp.pressed.back)) {
        w.jumpPrep = JUMP_PREP;
        w.jumpKind = inp.pressed.jump ? "fwd" : "back";
      }
    }
    if (t.phase === "play" && !t.fired && w.mode === "stand" && !w.jumpPrep) this.handleFire(w, inp);
  }

  jump(w, kind) {
    w.mode = "air";
    w.jumpY = w.y;
    if (kind === "back") {
      w.vx = -w.face * 0.9;
      w.vy = -6.1;
    } else {
      w.vx = w.face * 2.1;
      w.vy = -4;
    }
    this.emit(["snd", kind === "back" ? "flip" : "jump"]);
    if (this.turn.bungee) startBungee(this, w);
  }

  canSelect(id) {
    const t = this.turn;
    const w = this.activeWorm();
    return !!WEAPON[id] && t.phase === "play" && !t.fired && !t.shots && !t.charging && !t.ctrl &&
      this.ammoOf(t.team, id) !== 0 && w && (w.mode === "stand" || w.mode === "air");
  }

  aim(w, inp) {
    if (inp.up) w.aim = Math.max(-1.55, w.aim - 0.028);
    if (inp.down) w.aim = Math.min(1.55, w.aim + 0.028);
  }

  handleFire(w, inp) {
    const t = this.turn;
    const wp = WEAPON[t.weapon];
    if (!wp) return;
    if (this.ammoOf(t.team, wp.id) === 0 && !t.shots) return;
    if (wp.target) {
      if (inp.click) this.fire(w, wp, { target: inp.click });
      return;
    }
    if (wp.charge) {
      if (inp.pressed.fire && !t.charging) {
        t.charging = true;
        t.power = 0;
      }
      if (t.charging) {
        if (inp.fire) t.power = Math.min(1, t.power + 1 / 66);
        if (!inp.fire || t.power >= 1) {
          t.charging = false;
          this.fire(w, wp, { power: t.power });
          t.power = 0;
        }
      }
      return;
    }
    if (inp.pressed.fire) this.fire(w, wp, {});
  }

  fire(w, wp, opts) {
    const t = this.turn;
    if (wp.id === "rope" && t.ropeLock) {
      shootRope(this, w);
      return;
    }
    const res = useWeapon(this, w, wp.id, opts);
    if (!res.ok) return;
    const firstShot = !(wp.shots && t.shots > 0);
    if (firstShot) this.useAmmo(t.team, wp.id);
    if (wp.id === "rope") t.ropeLock = true;
    switch (res.end) {
      case "retreat":
        t.fired = true;
        this.startRetreat();
        break;
      case "settle":
        t.fired = true;
        this.endTurn();
        break;
      case "shot":
        if (firstShot) t.shots = wp.shots;
        t.shots -= 1;
        if (t.shots <= 0) {
          t.fired = true;
          this.startRetreat();
        }
        break;
      case "ctrl":
        t.fired = true;
        t.ctrl = res.ctrl;
        break;
    }
  }

  startRetreat() {
    const t = this.turn;
    if (t.phase !== "play") return;
    t.phase = "retreat";
    t.retreat = this.settings.retreat * 60;
    if (t.retreat <= 0) this.endTurn();
  }

  endTurn() {
    const t = this.turn;
    if (t.phase === "settle" || t.phase === "over") return;
    t.phase = "settle";
    t.sub = "wait";
    t.subT = 0;
    t.charging = false;
    t.bungee = false;
    t.shots = 0;
    const w = this.activeWorm();
    if (w) w.jumpPrep = 0;
    if (w && (w.mode === "rope" || w.mode === "jet" || w.mode === "bungee")) {
      w.mode = "air";
      w.rope = null;
      w.bng = null;
      w.thr = false;
    }
  }

  collect(w, c) {
    this.remove(c);
    if (c.kind === "health") {
      const amount = this.settings.crateHealth;
      w.hp += amount;
      this.emit(["heal", w.id, amount]);
    } else {
      const team = this.teams[w.team];
      const options = Object.entries(CRATE_WEAPONS).filter(([id]) => team.ammo[id] !== -1);
      if (options.length) {
        let roll = this.rng.next() * options.reduce((s, [, wgt]) => s + wgt, 0);
        let id = options[0][0];
        for (const [wid, wgt] of options) {
          roll -= wgt;
          if (roll <= 0) {
            id = wid;
            break;
          }
        }
        team.ammo[id] = (team.ammo[id] ?? 0) + 1;
        this.emit(["say", w.id, `${WEAPON[id].icon} ${WEAPON[id].name}!`]);
      }
    }
    this.emit(["snd", "collect"]);
  }

  spawnCrate() {
    for (let tries = 0; tries < 40; tries++) {
      const x = Math.round(this.rng.range(80, this.w - 80));
      for (let y = 0; y < this.water - 30; y += 4) {
        if (this.terrain.solid(x, y)) {
          const startY = Math.max(-30, y - 420);
          this.spawn({ type: "crate", kind: this.rng.next() < 0.4 ? "health" : "weapon", x, y: startY, vx: 0, vy: 0, chute: true });
          this.emit(["snd", "crate"]);
          return true;
        }
      }
    }
    return false;
  }

  quiet() {
    for (const e of this.ents.values()) {
      if (PROJECTILES.has(e.type) || e.type === "fire") return false;
      if (e.type === "worm") {
        if (!e.dead && (e.drown || e.mode !== "stand")) return false;
      } else if (e.type === "mine") {
        if (e.fuse > 0 || !e.rest) return false;
      } else if (e.type === "crate") {
        if (e.chute || e.boom || !e.rest) return false;
      } else if (!e.rest) return false;
    }
    return true;
  }

  settle() {
    const t = this.turn;
    t.subT = (t.subT ?? 0) + 1;
    switch (t.sub) {
      case "wait":
        if ((t.subT > 25 && this.quiet()) || t.subT > 1200) {
          t.sub = "deaths";
          t.subT = 0;
        }
        break;
      case "deaths": {
        const dying = this.worms().find((w) => !w.dead && !w.drown && w.hp <= 0);
        if (dying) {
          t.sub = "dying";
          t.dying = dying.id;
          t.subT = 0;
          this.emit(["say", dying.id, this.rng.pick(DEATH_LINES)]);
        } else t.sub = "win";
        break;
      }
      case "dying":
        if (t.subT >= 50) {
          const w = this.ents.get(t.dying);
          if (w && !w.dead) {
            w.dead = true;
            w.mode = "stand";
            this.spawn({ type: "grave", x: w.x, y: w.y - 4, vx: 0, vy: -1.5, team: w.team });
            this.explode(w.x, w.y, 24, 20);
          }
          t.sub = "wait";
          t.subT = 0;
        }
        break;
      case "win": {
        const alive = this.teams.map((_, i) => i).filter((i) => this.teamAlive(i));
        if (alive.length === 0 || (!this.practice && alive.length === 1)) {
          t.phase = "over";
          t.winner = alive.length === 1 ? alive[0] : -1;
          this.emit(["over", t.winner]);
          return;
        }
        t.sub = "sd";
        break;
      }
      case "sd":
        if (!t.sdDone) {
          t.sdDone = true;
          const s = this.settings;
          if (!this.sd && s.sdMinutes > 0 && this.gameTime >= s.sdMinutes * 3600) {
            this.sd = true;
            this.emit(["msg", "SUDDEN DEATH!"]);
            this.emit(["snd", "suddendeath"]);
            if (s.sdOneHp) for (const w of this.worms()) if (!w.dead && w.hp > 1) w.hp = 1;
          }
          if (this.sd) {
            t.waterTo = this.water - (WATER_RISE[s.waterRise] ?? 30);
            t.sub = "water";
            break;
          }
        }
        t.sub = "crate";
        break;
      case "water":
        this.water = Math.max(t.waterTo, this.water - 0.5);
        if (this.water <= t.waterTo) {
          t.sub = "wait";
          t.subT = 0;
        }
        break;
      case "crate":
        if (!t.crateDone) {
          t.crateDone = true;
          if (this.rng.next() < (CRATE_CHANCE[this.settings.crates] ?? 0) && this.spawnCrate()) {
            t.sub = "wait";
            t.subT = 0;
            break;
          }
        }
        t.sub = "next";
        break;
      case "next": {
        const next = this.nextTeam();
        if (next < 0) {
          t.phase = "over";
          t.winner = -1;
          this.emit(["over", -1]);
          return;
        }
        this.beginTurn(next);
        break;
      }
    }
  }

  nextTeam() {
    const n = this.teams.length;
    const cur = this.turn.team ?? -1;
    const online = (i) => !this.online || this.online.has(this.teams[i].pid);
    for (let k = 1; k <= n; k++) {
      const i = (((cur + k) % n) + n) % n;
      if (this.teamAlive(i) && online(i)) return i;
    }
    for (let k = 1; k <= n; k++) {
      const i = (((cur + k) % n) + n) % n;
      if (this.teamAlive(i)) return i;
    }
    return -1;
  }

  beginTurn(ti) {
    const team = this.teams[ti];
    const alive = this.teamWorms(ti).filter((w) => !w.dead && !w.drown && w.hp > 0);
    const worm = alive.find((w) => w.idx >= team.next) ?? alive[0];
    team.next = worm.idx + 1;
    const prev = this.turn;
    let weapon = team.last;
    if (!WEAPON[weapon] || team.ammo[weapon] === 0) weapon = WEAPONS.find((wp) => team.ammo[wp.id] !== 0)?.id ?? "skip";
    this.turn = {
      seq: (prev?.seq ?? 0) + 1, team: ti, worm: worm.id, phase: "play",
      time: this.settings.turnTime * 60, ready: 180, retreat: 0, weapon, fuse: prev?.fuse ?? 3,
      power: 0, charging: false, shots: 0, ctrl: 0, fired: false, ropeLock: false, bungee: false,
      sub: "", subT: 0, sdDone: false, crateDone: false, winner: -1,
    };
    this.wind = this.settings.wind ? Math.round(this.rng.range(-1, 1) * 20) / 20 : 0;
    this.emit(["turn", ti, worm.id]);
    if (this.rng.next() < 0.5) this.emit(["say", worm.id, this.rng.pick(START_LINES)]);
  }

  // Aktiven Zug sofort beenden (z. B. wenn der Spieler das Spiel verlassen hat)
  forfeitTurn() {
    if (this.turn.phase === "play" || this.turn.phase === "retreat") this.endTurn();
  }

  // ---------- Netzwerk ----------

  turnView() {
    const { subT, ready, ...rest } = this.turn;
    rest.time = Math.ceil(rest.time / 60) * 60;
    rest.retreat = Math.ceil(rest.retreat / 60) * 60;
    return rest;
  }

  // Änderungen seit dem letzten Aufruf als fertiger JSON-String (oder null)
  makeDelta(cache) {
    const ents = [];
    const seen = new Set();
    for (const e of this.ents.values()) {
      seen.add(e.id);
      const s = JSON.stringify(e, roundReplacer);
      if (cache.ents.get(e.id) !== s) {
        cache.ents.set(e.id, s);
        ents.push(s);
      }
    }
    const rm = [];
    for (const id of cache.ents.keys()) {
      if (!seen.has(id)) {
        cache.ents.delete(id);
        rm.push(id);
      }
    }
    let msg = `{"t":"s","k":${this.tick}`;
    let changed = false;
    if (ents.length) {
      msg += `,"e":[${ents.join(",")}]`;
      changed = true;
    }
    if (rm.length) {
      msg += `,"rm":${JSON.stringify(rm)}`;
      changed = true;
    }
    const tu = JSON.stringify(this.turnView(), roundReplacer);
    if (tu !== cache.tu) {
      cache.tu = tu;
      msg += `,"tu":${tu}`;
      changed = true;
    }
    const tm = JSON.stringify(this.teams);
    if (tm !== cache.tm) {
      cache.tm = tm;
      msg += `,"tm":${tm}`;
      changed = true;
    }
    const g = JSON.stringify([this.wind, Math.round(this.water * 10) / 10, Math.floor(this.gameTime / 60), this.sd]);
    if (g !== cache.g) {
      cache.g = g;
      msg += `,"g":${g}`;
      changed = true;
    }
    if (this.outbox.length) {
      msg += `,"ev":${JSON.stringify(this.outbox, roundReplacer)}`;
      this.outbox.length = 0;
      changed = true;
    }
    return changed ? msg + "}" : null;
  }

  applyDelta(m) {
    this.tick = m.k;
    if (m.e) for (const e of m.e) this.ents.set(e.id, e);
    if (m.rm) for (const id of m.rm) this.ents.delete(id);
    if (m.tu) this.turn = { ...m.tu, subT: 0, ready: 0 };
    if (m.tm) this.teams = m.tm;
    if (m.g) {
      this.wind = m.g[0];
      this.water = m.g[1];
      this.gameTime = m.g[2] * 60;
      this.sd = m.g[3];
    }
    if (m.ev) {
      for (const ev of m.ev) {
        if (ev[0] === "x") this.terrain.carve(ev[1], ev[2], ev[3]);
        this.events.push(ev);
      }
    }
  }
}
