import { GRAVITY, WORM_R, FALL_DAMAGE_SPEED, ROPE_MAX } from "./const.js";
import { stepBody, bounceOff, grounded } from "./physics.js";

// ---------- Würmer ----------

export function updateWorm(world, w) {
  if (w.dead) return;
  if (w.drown) {
    w.y += 0.7;
    w.x += w.vx;
    w.vx *= 0.9;
    if (w.y > world.water + 70) w.dead = true;
    return;
  }
  if (w.y - 4 > world.water) {
    w.drown = true;
    w.mode = "air";
    w.rope = null;
    w.bng = null;
    w.vy = 0;
    world.emit(["fx", "splash", Math.round(w.x), Math.round(world.water), 2]);
    world.emit(["snd", "splash"]);
    world.emit(["say", w.id, world.rng.pick(["Blubb!", "Ich kann nicht schwimmen!", "Gluck gluck…"])]);
    if (w.hp > 0) world.damage(w, w.hp, true);
    return;
  }
  switch (w.mode) {
    case "stand":
      if (!grounded(world, w)) {
        const t = world.turn;
        if (t.bungee && t.worm === w.id && (t.phase === "play" || t.phase === "retreat")) startBungee(world, w);
        else w.mode = "air";
      }
      break;
    case "air":
    case "fly":
      airPhysics(world, w);
      break;
    case "rope":
      ropePhysics(world, w);
      break;
    case "jet":
      jetPhysics(world, w);
      break;
    case "bungee":
      bungeePhysics(world, w);
      break;
  }
}

export function startBungee(world, w) {
  world.turn.bungee = false;
  w.mode = "bungee";
  w.bng = { ax: Math.round(w.x), ay: Math.round(w.y - 4), len: 24 };
  world.emit(["snd", "rope"]);
}

function land(world, w) {
  w.vx = 0;
  w.vy = 0;
  w.mode = "stand";
  w.rope = null;
  w.bng = null;
  for (let k = 0; k < 8 && world.terrain.circleHits(w.x, w.y, WORM_R); k++) w.y -= 1;
}

// Bewegt einen Wurm in Teilschritten; ruft onHit(n) bei Geländekontakt auf.
// Mit slide gleitet er nach dem Abprall mit der neuen Geschwindigkeit weiter.
function moveWorm(world, w, onHit, slide = false) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(w.vx), Math.abs(w.vy))));
  let hits = 0;
  for (let i = 0; i < steps; i++) {
    const nx = w.x + w.vx / steps;
    const ny = w.y + w.vy / steps;
    if (!world.terrain.circleHits(nx, ny, WORM_R)) {
      w.x = nx;
      w.y = ny;
      continue;
    }
    onHit(world.terrain.normal(nx, ny, WORM_R + 3));
    if (!slide || ++hits > 2) return true;
  }
  return hits > 0;
}

function airPhysics(world, w) {
  w.vy = Math.min(w.vy + GRAVITY, 16);
  moveWorm(world, w, (n) => {
    const impact = -(w.vx * n.x + w.vy * n.y);
    if (n.y < -0.5) {
      if (impact > FALL_DAMAGE_SPEED && world.settings.fallDamage) {
        world.damage(w, Math.round((impact - FALL_DAMAGE_SPEED) * 5 + 3));
        world.emit(["snd", "thud"]);
      }
      if (w.mode === "fly" && impact > 2.6) bounceOff(w, n, 0.3, 0.75);
      else land(world, w);
    } else {
      bounceOff(w, n, 0.3, 0.9);
      if (Math.hypot(w.vx, w.vy) < 0.5 && grounded(world, w)) land(world, w);
    }
  });
}

function ropePhysics(world, w) {
  const rope = w.rope;
  w.vy += GRAVITY;
  w.vx *= 0.998;
  w.vy *= 0.998;
  moveWorm(world, w, (n) => bounceOff(w, n, 0.35, 0.95), true);

  let piv = rope.p[rope.p.length - 1];
  const dx = w.x - piv[0];
  const dy = w.y - piv[1];
  const d = Math.hypot(dx, dy);
  if (d > rope.len && d > 0.01) {
    const ux = dx / d;
    const uy = dy / d;
    const tx = piv[0] + ux * rope.len;
    const ty = piv[1] + uy * rope.len;
    if (!world.terrain.circleHits(tx, ty, WORM_R)) {
      w.x = tx;
      w.y = ty;
    }
    const vr = w.vx * ux + w.vy * uy;
    if (vr > 0) {
      w.vx -= vr * ux;
      w.vy -= vr * uy;
    }
  }

  // Seil wickelt sich um Kanten …
  const hit = world.terrain.raycast(piv[0], piv[1], w.x, w.y);
  if (hit && hit.dist > 3 && rope.p.length < 40) {
    const seg = Math.hypot(hit.px - piv[0], hit.py - piv[1]);
    if (seg > 2) {
      const side = Math.sign((hit.px - piv[0]) * (w.y - hit.py) - (hit.py - piv[1]) * (w.x - hit.px)) || 1;
      rope.p.push([hit.px, hit.py, side]);
      rope.len = Math.max(6, rope.len - seg);
      piv = rope.p[rope.p.length - 1];
    }
  }
  // … und wieder ab, sobald der Wurm zurückschwingt
  if (rope.p.length >= 2) {
    const a = rope.p[rope.p.length - 2];
    const b = rope.p[rope.p.length - 1];
    const cross = (b[0] - a[0]) * (w.y - b[1]) - (b[1] - a[1]) * (w.x - b[0]);
    if (cross !== 0 && Math.sign(cross) !== b[2]) {
      rope.p.pop();
      rope.len = Math.min(ROPE_MAX, rope.len + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
  }
}

function jetPhysics(world, w) {
  w.jetT = (w.jetT ?? 0) + 1;
  w.vy = Math.max(-4.5, Math.min(w.vy + GRAVITY * 0.85, 10));
  w.vx = Math.max(-4, Math.min(4, w.vx * 0.99));
  moveWorm(world, w, (n) => {
    if (n.y < -0.5 && w.vy >= 0 && w.jetT > 20) {
      land(world, w);
      w.thr = false;
    } else bounceOff(w, n, 0.2, 0.8);
  }, true);
  if (w.mode === "jet" && w.fuel <= 0) {
    w.mode = "air";
    w.thr = false;
  }
}

function bungeePhysics(world, w) {
  const b = w.bng;
  w.vy += GRAVITY;
  const dx = w.x - b.ax;
  const dy = w.y - b.ay;
  const d = Math.hypot(dx, dy);
  if (d > b.len) {
    const f = (d - b.len) * 0.035;
    w.vx -= (dx / d) * f;
    w.vy -= (dy / d) * f;
  }
  w.vx *= 0.993;
  w.vy *= 0.993;
  moveWorm(world, w, (n) => {
    bounceOff(w, n, 0.3, 0.9);
    if (n.y < -0.5 && Math.hypot(w.vx, w.vy) < 0.6) land(world, w);
  }, true);
}

// ---------- Minen, Fässer, Kisten, Feuer, Grabsteine ----------

export const OBJECT_UPDATE = {
  mine(world, m) {
    stepBody(world, m, { r: 4, bounce: 0.3, friction: 0.6 });
    if (m.y > world.water + 4) return sink(world, m);
    if (m.fuse < 0 && m.fuse !== -2) {
      for (const w of world.worms()) {
        if (!w.dead && !w.drown && Math.hypot(w.x - m.x, w.y - m.y) < 34) {
          m.fuse = 120;
          world.emit(["snd", "beep"]);
          break;
        }
      }
    } else if (m.fuse > 0) {
      m.fuse -= 1;
      if (m.fuse % 30 === 0 && m.fuse > 0) world.emit(["snd", "beep"]);
      if (m.fuse === 0) {
        if (m.dud) {
          m.fuse = -2;
          world.emit(["fx", "fizzle", Math.round(m.x), Math.round(m.y)]);
          world.emit(["snd", "fizzle"]);
        } else {
          world.remove(m);
          world.explode(m.x, m.y, 44, 45);
        }
      }
    }
  },

  barrel(world, b) {
    if (b.hp <= 0) {
      world.remove(b);
      world.explode(b.x, b.y, 48, 40);
      for (let i = 0; i < 9; i++) {
        world.spawn({ type: "fire", x: b.x, y: b.y - 4, vx: world.rng.range(-3, 3), vy: world.rng.range(-5, -1.5), life: world.rng.int(200, 340) });
      }
      world.emit(["snd", "fire"]);
      return;
    }
    stepBody(world, b, { r: 8, bounce: 0.15, friction: 0.6 });
    if (b.y > world.water + 6) sink(world, b);
  },

  crate(world, c) {
    if (c.boom) {
      world.remove(c);
      world.explode(c.x, c.y, 36, 30);
      return;
    }
    if (c.chute) {
      c.vy = Math.min(c.vy + 0.08, 2.4);
      c.vx = world.wind * 0.9;
      const hit = stepBody(world, c, { r: 8, bounce: 0, friction: 0.3, grav: 0 });
      if (hit || c.rest) {
        c.chute = false;
        world.emit(["snd", "thud"]);
      }
    } else {
      stepBody(world, c, { r: 8, bounce: 0.1, friction: 0.5 });
    }
    if (c.y > world.water + 6) sink(world, c);
  },

  fire(world, f) {
    if (--f.life <= 0) return world.remove(f);
    if (!f.rest) {
      if (!f.rest) f.vx += world.wind * 0.01;
      stepBody(world, f, { r: 2, bounce: 0, friction: 0.2 });
    }
    if (f.y > world.water) return world.remove(f);
    if (f.life % 20 === 0) {
      for (const w of world.worms()) {
        if (!w.dead && !w.drown && Math.hypot(w.x - f.x, w.y - f.y) < 13) {
          world.damage(w, 3);
          if (w.mode === "stand") world.knock(w, (w.x - f.x) * 0.1, -1.4);
        }
      }
    }
    if (f.life % 45 === 0 && f.rest) {
      world.terrain.carve(Math.round(f.x), Math.round(f.y + 3), 4);
      world.emit(["x", Math.round(f.x), Math.round(f.y + 3), 4, 0]);
      f.rest = false;
    }
  },

  grave(world, g) {
    stepBody(world, g, { r: 5, bounce: 0.2, friction: 0.6 });
    if (g.y > world.water + 6) world.remove(g);
  },
};

function sink(world, e) {
  world.remove(e);
  world.emit(["fx", "splash", Math.round(e.x), Math.round(world.water), 1]);
}

// ---------- Startaufstellung ----------

// Freie Standplätze auf Oberflächen, an denen ein Körper mit Radius r Platz hat.
export function surfaceSpots(world, r, step = 3) {
  const t = world.terrain;
  const spots = [];
  const margin = 30;
  for (let x = margin; x < world.w - margin; x += step) {
    for (let y = 20; y < world.water - 20; y++) {
      if (t.solid(x, y + 1) && !t.solid(x, y) && !t.solid(x, y - 2 * r - 6)) {
        const cy = y - r;
        if (!t.circleHits(x, cy, r) && t.circleHits(x, cy + 2, r) && !t.circleHits(x, cy - 12, r)) {
          spots.push({ x, y: cy });
        }
      }
    }
  }
  return spots;
}

export function pickSpot(world, spots, taken, minDist) {
  for (let tries = 0; tries < 400 && spots.length; tries++) {
    const i = Math.floor(world.rng.next() * spots.length);
    const s = spots[i];
    if (taken.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= minDist)) {
      spots.splice(i, 1);
      return s;
    }
  }
  return spots.length ? spots.splice(Math.floor(world.rng.next() * spots.length), 1)[0] : null;
}
