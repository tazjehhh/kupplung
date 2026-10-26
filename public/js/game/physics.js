import { GRAVITY, WIND_FORCE, WORM_R, MAX_STEP } from "./const.js";

// Bewegt einen runden Körper einen Tick weiter. Optionen:
//   r        Kollisionsradius
//   bounce   Rückprall (0..1), friction Reibung entlang der Oberfläche (1 = keine)
//   wind     vom Wind beeinflusst
//   impact   bei Berührung sofort melden statt abprallen
//   worms    Würmer treffen (Projektile), objects  Fässer/Kisten/Minen treffen
// Rückgabe: null oder { kind: "terrain" | "worm" | "object" | "bounce", ent?, n? }
export function stepBody(world, e, o) {
  const terrain = world.terrain;
  const r = o.r;
  if (e.rest) {
    if (terrain.circleHits(e.x, e.y + 1.5, r)) return null;
    e.rest = false;
  }
  if (terrain.circleHits(e.x, e.y, Math.max(1, r - 1))) {
    // Steckt im Boden (z. B. nach dem Spawnen): nach außen schieben
    const n = terrain.normal(e.x, e.y, r + 3);
    e.x += n.x * 1.5;
    e.y += n.y * 1.5;
    if (o.impact) return { kind: "terrain" };
  }
  e.vy += GRAVITY * (o.grav ?? 1);
  if (o.wind) e.vx += world.wind * WIND_FORCE;
  const max = o.maxSpeed ?? 20;
  const sp = Math.hypot(e.vx, e.vy);
  if (sp > max) {
    e.vx *= max / sp;
    e.vy *= max / sp;
  }
  const stepLen = Math.max(1, Math.min(2, r));
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(e.vx), Math.abs(e.vy)) / stepLen));
  for (let i = 0; i < steps; i++) {
    const nx = e.x + e.vx / steps;
    const ny = e.y + e.vy / steps;
    if (o.worms) {
      const worm = world.wormAt(nx, ny, r, (e.age ?? 99) < 10 ? e.own : 0);
      if (worm) {
        e.x = nx;
        e.y = ny;
        return { kind: "worm", ent: worm };
      }
    }
    if (o.objects) {
      const obj = world.objectAt(nx, ny, r);
      if (obj) {
        e.x = nx;
        e.y = ny;
        return { kind: "object", ent: obj };
      }
    }
    if (terrain.circleHits(nx, ny, r)) {
      if (o.impact) {
        e.x = nx;
        e.y = ny;
        return { kind: "terrain" };
      }
      const n = terrain.normal(nx, ny, r + 3);
      bounceOff(e, n, o.bounce ?? 0.4, o.friction ?? 0.8);
      if (Math.hypot(e.vx, e.vy) < 0.4 && n.y < -0.4) {
        e.vx = 0;
        e.vy = 0;
        e.rest = true;
      }
      return { kind: "bounce", n };
    }
    e.x = nx;
    e.y = ny;
  }
  return null;
}

export function bounceOff(e, n, bounce, friction) {
  const vn = e.vx * n.x + e.vy * n.y;
  if (vn < 0) {
    const tx = -n.y;
    const ty = n.x;
    const vt = e.vx * tx + e.vy * ty;
    e.vx = tx * vt * friction - n.x * vn * bounce;
    e.vy = ty * vt * friction - n.y * vn * bounce;
  }
  e.lastImpact = -vn;
}

export function grounded(world, e, r = WORM_R) {
  return world.terrain.circleHits(e.x, e.y + 1, r);
}

// Einen Pixel seitwärts laufen, dabei Stufen bis maxStep hochsteigen und Gefälle folgen.
// Rückgabe: "ok", "blocked" oder "fall" (keine Kante mehr unter den Füßen).
export function walkStep(world, e, dir, r = WORM_R, maxStep = MAX_STEP) {
  const terrain = world.terrain;
  let moved = false;
  for (let up = 0; up <= maxStep; up++) {
    if (!terrain.circleHits(e.x + dir, e.y - up, r)) {
      e.x += dir;
      e.y -= up;
      moved = true;
      break;
    }
  }
  if (!moved) return "blocked";
  for (let d = 0; d <= maxStep + 1; d++) {
    if (terrain.circleHits(e.x, e.y + 1, r)) return "ok";
    e.y += 1;
  }
  return "fall";
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
