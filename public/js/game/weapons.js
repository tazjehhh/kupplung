import { MAX_THROW, ROPE_MAX, WORM_R, JET_FUEL, GRAVITY } from "./const.js";
import { stepBody, grounded, walkStep } from "./physics.js";

export const CATEGORIES = ["Basis", "Klassiker", "Bewegung", "Verrücktes", "Sonstiges"];

// charge: Leertaste gedrückt halten, fuse: Zünder 1–5 einstellbar,
// target: Ziel per Mausklick, noAim: kein Fadenkreuz, util: beendet den Zug nicht
export const WEAPONS = [
  { id: "bazooka", name: "Bazooka", icon: "🚀", cat: 0, charge: true, ammo: -1, hint: "Leertaste halten zum Aufladen. Wind lenkt die Rakete ab." },
  { id: "grenade", name: "Granate", icon: "💣", cat: 0, charge: true, fuse: true, ammo: -1, hint: "Zünder mit 1–5 einstellen, Leertaste halten zum Werfen." },
  { id: "shotgun", name: "Schrotflinte", icon: "🔫", cat: 0, shots: 2, ammo: -1, hint: "Zwei Schüsse pro Zug." },
  { id: "bat", name: "Baseballschläger", icon: "🏏", cat: 0, ammo: 1, hint: "Haut Würmer in Zielrichtung davon." },
  { id: "punch", name: "Feuerschlag", icon: "👊", cat: 0, noAim: true, ammo: -1, hint: "Kinnhaken – schleudert Würmer vor dir nach oben." },
  { id: "cluster", name: "Clustergranate", icon: "🎇", cat: 1, charge: true, fuse: true, ammo: 3, hint: "Zerplatzt in fünf kleine Bomben." },
  { id: "banana", name: "Bananenbombe", icon: "🍌", cat: 1, charge: true, fuse: true, ammo: 1, hint: "Hüpft wild und zerplatzt in explosive Bananen." },
  { id: "holy", name: "Heilige Handgranate", icon: "👼", cat: 1, charge: true, ammo: 1, hint: "Halleluja! Riesige Explosion nach 3 Sekunden." },
  { id: "dynamite", name: "Dynamit", icon: "🧨", cat: 1, noAim: true, ammo: 1, hint: "Fallen lassen und weglaufen! 5 Sekunden Zünder." },
  { id: "airstrike", name: "Luftschlag", icon: "✈️", cat: 1, target: true, ammo: 1, hint: "Ziel anklicken. Blickrichtung des Wurms = Flugrichtung." },
  { id: "rope", name: "Ninja-Seil", icon: "🧗", cat: 2, util: true, ammo: 5, hint: "Leertaste schießt/löst das Seil. ←/→ schwingen, ↑/↓ Länge." },
  { id: "teleport", name: "Teleport", icon: "🌀", cat: 2, target: true, ammo: 2, hint: "Zielort anklicken. Beendet den Zug." },
  { id: "jetpack", name: "Jetpack", icon: "🎒", cat: 2, noAim: true, util: true, ammo: 1, hint: "↑ Schub, ←/→ lenken. Leertaste schaltet ab." },
  { id: "bungee", name: "Bungee", icon: "🪀", cat: 2, noAim: true, util: true, ammo: 2, hint: "Leertaste aktiviert, dann über eine Kante laufen. ↑/↓ Länge, Leertaste löst." },
  { id: "sheep", name: "Schaf", icon: "🐑", cat: 3, noAim: true, ammo: 1, hint: "Läuft los und explodiert. Leertaste zündet vorzeitig." },
  { id: "supersheep", name: "Super-Schaf", icon: "🦸", cat: 3, noAim: true, ammo: 1, hint: "Leertaste: abheben, ←/→ lenken, Leertaste: Bumm!" },
  { id: "oldwoman", name: "Alte Frau", icon: "👵", cat: 3, noAim: true, ammo: 1, hint: "Schlurft meckernd los und explodiert nach 7 Sekunden." },
  { id: "donkey", name: "Betonesel", icon: "🐴", cat: 3, target: true, ammo: 1, hint: "Ziel anklicken. Kracht von oben durch alles durch." },
  { id: "skip", name: "Zug aussetzen", icon: "⏭️", cat: 4, noAim: true, ammo: -1, hint: "Beendet deinen Zug sofort." },
];

export const WEAPON = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

// Gewichte für Waffenkisten
export const CRATE_WEAPONS = {
  cluster: 10, banana: 5, holy: 3, dynamite: 8, airstrike: 6, bat: 5, sheep: 8, supersheep: 4,
  oldwoman: 5, donkey: 2, rope: 6, teleport: 6, jetpack: 5, bungee: 3,
};

// [Radius, Schaden]
export const BLAST = {
  missile: [46, 50], airmissile: [32, 30], grenade: [46, 50], cluster: [26, 25], clusterlet: [22, 26],
  banana: [60, 70], bananalet: [46, 55], holy: [105, 100], dynamite: [72, 75], sheep: [68, 70],
  supersheep: [68, 70], oldwoman: [68, 70], donkey: [50, 50],
};

export function aimDir(w) {
  return { x: Math.cos(w.aim) * w.face, y: Math.sin(w.aim) };
}

function launchPoint(world, w, dir) {
  const off = WORM_R + 7;
  const x = w.x + dir.x * off;
  const y = w.y - 2 + dir.y * off;
  if (world.terrain.circleHits(x, y, 3)) return { x: w.x, y: w.y - 2 };
  return { x, y };
}

function throwProjectile(world, w, type, power, extra = {}) {
  const dir = aimDir(w);
  const p = launchPoint(world, w, dir);
  const speed = Math.max(0.15, power) * MAX_THROW;
  return world.spawn({ type, x: p.x, y: p.y, vx: dir.x * speed, vy: dir.y * speed, own: w.id, age: 0, ...extra });
}

// Führt die Waffe aus. Rückgabe: { ok, end } mit end ∈ "retreat" | "settle" | "none" | "ctrl"
export function useWeapon(world, w, id, opts) {
  const t = world.turn;
  switch (id) {
    case "bazooka":
      throwProjectile(world, w, "missile", opts.power);
      world.emit(["snd", "launch"]);
      world.voice(w.id, "fire", 0.4);
      return { ok: true, end: "retreat" };
    case "grenade":
    case "cluster":
    case "banana":
      throwProjectile(world, w, id, opts.power, { fuse: t.fuse * 60 });
      world.emit(["snd", "throw"]);
      world.voice(w.id, id === "banana" ? "cover" : "grenade", 0.5);
      return { ok: true, end: "retreat" };
    case "holy":
      throwProjectile(world, w, "holy", opts.power, { fuse: 180 });
      world.emit(["snd", "throw"]);
      world.voice(w.id, "cover", 0.7);
      return { ok: true, end: "retreat" };
    case "dynamite":
      world.spawn({ type: "dynamite", x: w.x + w.face * 6, y: w.y, vx: w.face * 0.6, vy: -1.5, fuse: 300, own: w.id, age: 0 });
      world.emit(["snd", "fuse"]);
      world.voice(w.id, "cover", 0.7);
      return { ok: true, end: "retreat" };
    case "shotgun":
      if (!t.shots) world.voice(w.id, "fire", 0.25);
      shotgun(world, w);
      return { ok: true, end: "shot" };
    case "bat":
      bat(world, w);
      return { ok: true, end: "retreat" };
    case "punch":
      punch(world, w);
      return { ok: true, end: "retreat" };
    case "airstrike":
      if (!opts.target) return { ok: false };
      airstrike(world, w, opts.target);
      warnNearest(world, w, opts.target);
      return { ok: true, end: "retreat" };
    case "donkey":
      if (!opts.target) return { ok: false };
      world.spawn({ type: "donkey", x: clampX(world, opts.target.x), y: -60, vx: 0, vy: 2, hits: 0, age: 0 });
      world.emit(["snd", "donkey"]);
      warnNearest(world, w, opts.target);
      return { ok: true, end: "retreat" };
    case "teleport":
      if (!opts.target) return { ok: false };
      return teleport(world, w, opts.target) ? { ok: true, end: "settle" } : { ok: false };
    case "rope":
      shootRope(world, w);
      return { ok: true, end: "none" };
    case "jetpack":
      w.mode = "jet";
      w.jumpY = null;
      w.fuel = JET_FUEL;
      w.jetT = 0;
      w.vy = -1.8;
      world.emit(["snd", "jet"]);
      return { ok: true, end: "none" };
    case "bungee":
      t.bungee = true;
      world.emit(["say", w.id, "Bungee bereit!"]);
      return { ok: true, end: "none" };
    case "sheep":
    case "supersheep":
    case "oldwoman": {
      const p = world.spawn({
        type: id, x: w.x + w.face * 8, y: w.y, vx: 0, vy: 0, dir: w.face, mode: "walk", acc: 0,
        fuse: id === "sheep" ? 480 : id === "oldwoman" ? 420 : 900, own: w.id, age: 0, blocked: 0, walked: 0,
      });
      if (world.terrain.circleHits(p.x, p.y, 5)) p.x = w.x;
      world.emit(["snd", id === "oldwoman" ? "granny" : "baa"]);
      world.voice(w.id, "cover", 0.4);
      return { ok: true, end: "ctrl", ctrl: p.id };
    }
    case "skip":
      world.emit(["snd", "skip"]);
      world.voice(world.randomWorm((o) => o.team !== w.team)?.id, "coward", 0.8);
      return { ok: true, end: "settle" };
  }
  return { ok: false };
}

// Der gegnerische Wurm, der dem Ziel am nächsten ist, ruft "Incoming!"
function warnNearest(world, w, target) {
  let best = null;
  for (const o of world.worms()) {
    if (o.team === w.team || o.dead || o.drown) continue;
    const d = Math.abs(o.x - target.x);
    if (d < 160 && (!best || d < Math.abs(best.x - target.x))) best = o;
  }
  if (best) world.voice(best.id, "incoming", 0.8);
}

function clampX(world, x) {
  return Math.max(20, Math.min(world.w - 20, x));
}

function shotgun(world, w) {
  const dir = aimDir(w);
  const sx = w.x + dir.x * 6;
  const sy = w.y - 2 + dir.y * 6;
  world.emit(["snd", "shotgun"]);
  let ex = sx;
  let ey = sy;
  for (let i = 0; i < 1000; i += 2) {
    const px = sx + dir.x * i;
    const py = sy + dir.y * i;
    ex = px;
    ey = py;
    const worm = world.wormAt(px, py, 1, w.id);
    if (worm) {
      world.damage(worm, 25);
      world.knock(worm, dir.x * 3.2, dir.y * 3.2 - 1.2);
      world.explode(px, py, 9, 0);
      break;
    }
    const obj = world.objectAt(px, py, 1);
    if (obj) {
      world.hitObject(obj, 25, dir.x * 2.5, dir.y * 2.5 - 1);
      break;
    }
    if (world.terrain.solid(px, py)) {
      world.explode(px, py, 13, 0);
      break;
    }
    if (py > world.water || px < -50 || px > world.w + 50 || py < -500) break;
  }
  world.emit(["fx", "tracer", Math.round(sx), Math.round(sy), Math.round(ex), Math.round(ey)]);
}

function bat(world, w) {
  const dir = aimDir(w);
  const hx = w.x + w.face * 11;
  const hy = w.y - 2;
  world.emit(["snd", "bat"]);
  for (const e of world.ents.values()) {
    if (e === w || e.dead || e.drown) continue;
    if (Math.hypot(e.x - hx, e.y - hy) > 22) continue;
    if (e.type === "worm") {
      world.damage(e, 30);
      world.knock(e, dir.x * 9.5, dir.y * 9.5 - 1.5, true);
      e.batHit = world.tick;
      world.emit(["fx", "hit", Math.round(e.x), Math.round(e.y)]);
    } else if (world.isKnockable(e)) {
      world.knock(e, dir.x * 8, dir.y * 8 - 1.5, true);
    }
  }
}

function punch(world, w) {
  const x0 = Math.min(w.x + w.face * 2, w.x + w.face * 28);
  const x1 = Math.max(w.x + w.face * 2, w.x + w.face * 28);
  world.emit(["snd", "punch"]);
  world.voice(w.id, "punch");
  for (const e of world.ents.values()) {
    if (e === w || e.dead || e.drown) continue;
    if (e.x < x0 || e.x > x1 || e.y < w.y - 40 || e.y > w.y + 10) continue;
    if (e.type === "worm") {
      world.damage(e, 30);
      world.knock(e, w.face * 2.4, -8, true);
      world.emit(["fx", "hit", Math.round(e.x), Math.round(e.y)]);
    } else if (world.isKnockable(e)) {
      world.knock(e, w.face * 2, -6, true);
    }
  }
  w.mode = "air";
  w.vx = w.face * 0.8;
  w.vy = -6.6;
  world.emit(["fx", "punch", w.id]);
}

function airstrike(world, w, target) {
  const dir = w.face;
  const vx = dir * 2.6;
  const vy = 1;
  const y0 = -40;
  const h = Math.max(50, target.y - y0);
  const time = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * h)) / GRAVITY;
  const x0 = target.x - vx * time;
  for (let k = 0; k < 5; k++) {
    world.spawn({ type: "airmissile", x: x0 + (k - 2) * 30, y: y0 - k * 3, vx, vy, age: 20 });
  }
  world.emit(["fx", "plane", Math.round(target.x), dir]);
  world.emit(["snd", "plane"]);
}

function teleport(world, w, target) {
  const { x, y } = target;
  const ok = x > 12 && x < world.w - 12 && y > 12 && y < world.water - 20 && !world.terrain.circleHits(x, y, WORM_R + 1);
  if (!ok) {
    world.emit(["say", w.id, "Da pass ich nicht hin!"]);
    world.emit(["snd", "denied"]);
    return false;
  }
  world.emit(["fx", "tele", Math.round(w.x), Math.round(w.y), Math.round(x), Math.round(y)]);
  world.emit(["snd", "tele"]);
  w.x = x;
  w.y = y;
  w.vx = 0;
  w.vy = 0;
  w.mode = "air";
  return true;
}

export function shootRope(world, w) {
  const dir = aimDir(w);
  const sx = w.x;
  const sy = w.y - 3;
  const hit = world.terrain.raycast(sx, sy, sx + dir.x * ROPE_MAX, sy + dir.y * ROPE_MAX);
  world.emit(["snd", "rope"]);
  if (!hit || hit.dist < 6) {
    world.emit(["fx", "ropemiss", Math.round(sx), Math.round(sy), Math.round(sx + dir.x * ROPE_MAX * 0.6), Math.round(sy + dir.y * ROPE_MAX * 0.6)]);
    return false;
  }
  w.mode = "rope";
  w.jumpY = null;
  const len = Math.hypot(w.x - hit.px, w.y - hit.py);
  // Vom Boden aus etwas straffen, damit der Wurm frei hängt
  w.rope = { p: [[hit.px, hit.py, 0]], len: Math.max(10, grounded(world, w) ? len - 10 : len) };
  world.emit(["snd", "ropeattach"]);
  return true;
}

// Steuerung ferngelenkter Projektile (Schafe)
export function controlProjectile(world, p, inp) {
  if (p.type === "sheep" && inp.pressed.fire) p.fuse = 0;
  if (p.type === "supersheep") {
    if (p.mode !== "fly" && inp.pressed.fire) {
      p.mode = "fly";
      p.ang = -Math.PI / 2 + p.dir * 0.5;
      p.rest = false;
      world.emit(["snd", "supersheep"]);
    } else if (p.mode === "fly") {
      if (inp.pressed.fire) p.fuse = 0;
      if (inp.left) p.ang -= 0.065;
      if (inp.right) p.ang += 0.065;
    }
  }
}

function explodeProjectile(world, p) {
  const [r, dmg] = BLAST[p.type];
  world.remove(p);
  world.explode(p.x, p.y, r, dmg);
  if (p.type === "cluster") {
    for (let i = 0; i < 5; i++) {
      world.spawn({ type: "clusterlet", x: p.x, y: p.y - 4, vx: world.rng.range(-2.8, 2.8), vy: world.rng.range(-5.5, -2.5), age: 0 });
    }
  } else if (p.type === "banana") {
    for (let i = 0; i < 5; i++) {
      world.spawn({ type: "bananalet", x: p.x, y: p.y - 4, vx: world.rng.range(-3.8, 3.8), vy: world.rng.range(-9, -5.5), age: 0 });
    }
  }
}

function drownProjectile(world, p) {
  if (p.y > world.water + 4) {
    world.remove(p);
    world.emit(["fx", "splash", Math.round(p.x), Math.round(world.water), 1]);
    if (p.type === "sheep" || p.type === "supersheep") world.emit(["snd", "baa"]);
    return true;
  }
  return false;
}

const IMPACT = { r: 3, impact: true, worms: true, objects: true };

function walker(world, p, speed, r) {
  const isSheep = p.type !== "oldwoman";
  if (p.mode === "walk") {
    if (!grounded(world, p, r)) {
      p.mode = "air";
      p.vx = p.dir * speed;
      p.vy = 0;
      return;
    }
    p.acc += speed;
    while (p.acc >= 1) {
      p.acc -= 1;
      const res = walkStep(world, p, p.dir, r, 6);
      if (res === "blocked") {
        if (isSheep) {
          p.mode = "air";
          p.vx = p.dir * 1.6;
          p.vy = -4.4;
          p.blocked += 1;
          if (p.blocked > 2) {
            p.dir = -p.dir;
            p.blocked = 0;
          }
        } else {
          p.dir = -p.dir;
        }
        break;
      }
      if (res === "fall") {
        p.mode = "air";
        p.vx = p.dir * speed;
        p.vy = 0;
        break;
      }
      if (++p.walked > 40) {
        p.walked = 0;
        p.blocked = 0;
      }
    }
    if (isSheep && p.mode === "walk" && world.rng.next() < 0.006) {
      p.mode = "air";
      p.vx = p.dir * 1.4;
      p.vy = -3.6;
    }
  } else {
    const hit = stepBody(world, p, { r, bounce: 0.1, friction: 0.5 });
    if (p.rest || (hit && hit.kind === "bounce" && hit.n.y < -0.5)) {
      p.mode = "walk";
      p.rest = false;
      p.vx = 0;
      p.vy = 0;
    }
  }
}

function superSheepFly(world, p) {
  const speed = 4.4;
  let vx = Math.cos(p.ang) * speed;
  let vy = Math.sin(p.ang) * speed;
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const nx = p.x + vx / steps;
    const ny = p.y + vy / steps;
    const worm = world.wormAt(nx, ny, 6, p.age < 30 ? p.own : 0);
    if (worm || world.objectAt(nx, ny, 6)) {
      p.fuse = 0;
      break;
    }
    if (world.terrain.circleHits(nx, ny, 6)) {
      const n = world.terrain.normal(nx, ny, 9);
      const vn = vx * n.x + vy * n.y;
      if (vn < 0) {
        vx -= 2 * vn * n.x;
        vy -= 2 * vn * n.y;
        p.ang = Math.atan2(vy, vx);
        world.emit(["snd", "bounce"]);
      }
      break;
    }
    p.x = nx;
    p.y = ny;
  }
  p.vx = vx;
  p.vy = vy;
}

export const PROJECTILE_UPDATE = {
  missile(world, p) {
    const hit = stepBody(world, p, { ...IMPACT, wind: true, maxSpeed: 18 });
    if (hit) explodeProjectile(world, p);
    else drownProjectile(world, p);
  },
  airmissile(world, p) {
    const hit = stepBody(world, p, { ...IMPACT, wind: true, maxSpeed: 18 });
    if (hit) explodeProjectile(world, p);
    else drownProjectile(world, p);
  },
  clusterlet(world, p) {
    const hit = stepBody(world, p, { r: 2, impact: true, worms: p.age > 6, objects: true });
    if (hit) explodeProjectile(world, p);
    else drownProjectile(world, p);
  },
  bananalet(world, p) {
    const hit = stepBody(world, p, { r: 4, impact: true, worms: p.age > 6, objects: true });
    if (hit) explodeProjectile(world, p);
    else drownProjectile(world, p);
  },
  grenade(world, p) {
    fused(world, p, { r: 4, bounce: 0.42, friction: 0.8 });
  },
  cluster(world, p) {
    fused(world, p, { r: 4, bounce: 0.42, friction: 0.8 });
  },
  banana(world, p) {
    fused(world, p, { r: 5, bounce: 0.68, friction: 0.92 });
  },
  holy(world, p) {
    if (p.fuse === 50) world.emit(["snd", "holy"]);
    fused(world, p, { r: 5, bounce: 0.25, friction: 0.5 });
  },
  dynamite(world, p) {
    fused(world, p, { r: 4, bounce: 0.05, friction: 0.3 });
  },
  sheep(world, p) {
    if (--p.fuse <= 0) return explodeProjectile(world, p);
    walker(world, p, 1.5, 6);
    drownProjectile(world, p);
  },
  oldwoman(world, p) {
    if (--p.fuse <= 0) return explodeProjectile(world, p);
    if (p.age % 70 === 0) world.emit(["say", p.id, world.rng.pick(["Früher war alles besser!", "Diese Jugend!", "Wo ist mein Gebiss?", "Ruhe da hinten!"])]);
    walker(world, p, 0.45, 6);
    drownProjectile(world, p);
  },
  supersheep(world, p) {
    if (--p.fuse <= 0) return explodeProjectile(world, p);
    if (p.mode === "fly") superSheepFly(world, p);
    else walker(world, p, 1.5, 6);
    drownProjectile(world, p);
  },
  donkey(world, p) {
    const hit = stepBody(world, p, { r: 15, impact: true, worms: true, objects: true, maxSpeed: 9 });
    if (hit) {
      world.explode(p.x, p.y + 10, BLAST.donkey[0], BLAST.donkey[1]);
      world.emit(["snd", "donkey"]);
      p.hits += 1;
      p.vy = -1.2;
      p.vx = 0;
      if (p.hits >= 7) world.remove(p);
    }
    if (!p.removed) drownProjectile(world, p);
  },
};

function fused(world, p, opts) {
  if (--p.fuse <= 0) return explodeProjectile(world, p);
  const hit = stepBody(world, p, opts);
  if (hit && hit.kind === "bounce" && Math.abs(p.lastImpact ?? 0) > 1.2) world.emit(["snd", "bounce"]);
  drownProjectile(world, p);
}
