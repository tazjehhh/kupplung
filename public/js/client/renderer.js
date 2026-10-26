import { TEAM_COLORS, JET_FUEL } from "../game/const.js";
import { WEAPON } from "../game/weapons.js";
import { TerrainRenderer, THEMES } from "./terrain-render.js";

const BODY = "#ffb4c6";
const BODY_DARK = "#f28aa6";
const OUTLINE = "#5b2338";
const INK = "#2b2340";
const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Weiche Hügel-Silhouette für den Parallax-Hintergrund
function ridge(seed, x) {
  return Math.sin(x * 0.004 + seed) * 0.5 + Math.sin(x * 0.011 + seed * 2.3) * 0.3 + Math.sin(x * 0.027 + seed * 5.1) * 0.15;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.terrain = new TerrainRenderer();
    this.time = 0;
    this.clouds = Array.from({ length: 14 }, (_, i) => ({ x: i * 420 + Math.random() * 300, y: 40 + Math.random() * 220, s: 0.6 + Math.random() * 0.9 }));
    this.flakes = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() }));
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
  }

  setWorld(world) {
    this.world = world;
    this.theme = THEMES[world.theme] ?? THEMES.wiese;
    this.terrain.build(world);
    const [r, g, b] = this.theme.dirt;
    this.dirtColor = `rgb(${r},${g},${b})`;
  }

  toScreen(cam, x, y) {
    return { x: (x - cam.x) * cam.zoom + this.width / 2, y: (y - cam.y) * cam.zoom + this.height / 2 };
  }

  toWorld(cam, sx, sy) {
    return { x: (sx - this.width / 2) / cam.zoom + cam.x, y: (sy - this.height / 2) / cam.zoom + cam.y };
  }

  draw(s) {
    const { world, cam, fx } = s;
    const ctx = this.ctx;
    this.time += s.dt;
    const W = this.width;
    const H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(ctx, cam, W, H, world);

    const shakeX = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
    const shakeY = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
    const z = cam.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, this.dpr * (W / 2 - cam.x * cam.zoom + shakeX), this.dpr * (H / 2 - cam.y * cam.zoom + shakeY));
    const view = {
      x0: cam.x - W / 2 / cam.zoom - 50, x1: cam.x + W / 2 / cam.zoom + 50,
      y0: cam.y - H / 2 / cam.zoom - 50, y1: cam.y + H / 2 / cam.zoom + 50,
    };

    this.drawWater(ctx, world, view, true);
    ctx.imageSmoothingEnabled = cam.zoom < 1;
    ctx.drawImage(this.terrain.canvas, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const t = world.turn;
    for (const e of world.ents.values()) {
      if (e.type === "worm" && e.mode === "rope" && e.rope) this.drawRope(ctx, e, s.pos(e));
      if (e.type === "worm" && e.mode === "bungee" && e.bng) this.drawBungee(ctx, e, s.pos(e));
    }
    for (const e of world.ents.values()) {
      if (e.type === "worm") continue;
      const p = s.pos(e);
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 - 200 || p.y > view.y1) continue;
      this.drawObject(ctx, e, p, world);
    }
    for (const e of world.ents.values()) {
      if (e.type !== "worm" || e.dead) continue;
      const p = s.pos(e);
      this.drawWorm(ctx, e, p, world, e.id === t.worm && t.phase !== "settle" && t.phase !== "over", s);
    }
    this.drawAim(ctx, world, s);
    fx.draw(ctx, cam);
    for (const pl of fx.planes) this.drawPlane(ctx, pl, view);
    this.drawWater(ctx, world, view, false);

    // Bildschirmkoordinaten: Beschriftungen, Sprechblasen, Zahlen
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawLabels(ctx, s);
    if (this.theme.snow) this.drawSnow(ctx, W, H, s.dt, world.wind);
  }

  // ---------- Hintergrund ----------

  drawSky(ctx, cam, W, H, world) {
    const th = this.theme;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky[0]);
    g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const horizon = (world.water - cam.y) * cam.zoom * 0.35 + H * 0.62;
    if (th.lava) {
      const glow = ctx.createRadialGradient(W / 2, H, 10, W / 2, H, H);
      glow.addColorStop(0, "rgba(255,120,40,0.35)");
      glow.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Wolken treiben mit dem Wind
      for (const c of this.clouds) {
        c.x += (world.wind * 0.6 + 0.08) * c.s;
        const span = 14 * 420;
        const sx = ((((c.x - cam.x * 0.25) % span) + span) % span) - 300;
        if (sx > W + 200) continue;
        const sy = c.y + (horizon - H * 0.62) * 0.3 - 40;
        this.drawCloud(ctx, sx, sy, c.s);
      }
    }
    this.drawRidge(ctx, W, H, cam, th.far, 0.12, horizon - 90, 120, 1.7);
    this.drawRidge(ctx, W, H, cam, th.mid, 0.3, horizon - 20, 90, 4.2);
  }

  drawCloud(ctx, x, y, s) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, TAU);
    ctx.arc(x + 30 * s, y - 12 * s, 32 * s, 0, TAU);
    ctx.arc(x + 64 * s, y, 24 * s, 0, TAU);
    ctx.arc(x + 30 * s, y + 8 * s, 26 * s, 0, TAU);
    ctx.fill();
  }

  drawRidge(ctx, W, H, cam, color, factor, base, amp, seed) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 16; sx += 16) {
      const wx = sx + cam.x * factor;
      ctx.lineTo(sx, base - ridge(seed, wx) * amp);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  drawSnow(ctx, W, H, dt, wind) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (const f of this.flakes) {
      f.y += dt * 0.05 * f.s;
      f.x += dt * (0.01 + wind * 0.05) * f.s;
      if (f.y > 1) f.y -= 1;
      f.x = ((f.x % 1) + 1) % 1;
      ctx.beginPath();
      ctx.arc(f.x * W, f.y * H, 1.5 * f.s, 0, TAU);
      ctx.fill();
    }
  }

  drawWater(ctx, world, view, back) {
    const th = this.theme;
    const y0 = world.water;
    const t = this.time;
    const amp = back ? 5 : 4;
    const phase = back ? 1.7 : 0;
    const off = back ? -7 : 0;
    ctx.beginPath();
    ctx.moveTo(view.x0, view.y1 + 400);
    for (let x = Math.floor(view.x0 / 12) * 12; x <= view.x1 + 12; x += 12) {
      ctx.lineTo(x, y0 + off + Math.sin(x * 0.03 + t * 2 + phase) * amp + Math.sin(x * 0.011 - t * 1.3) * amp * 0.6);
    }
    ctx.lineTo(view.x1 + 12, view.y1 + 400);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y0 - 10, 0, y0 + 160);
    g.addColorStop(0, back ? th.water[1] : th.water[0]);
    g.addColorStop(1, th.water[1]);
    ctx.fillStyle = g;
    ctx.globalAlpha = back ? 1 : 0.86;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (!back) {
      ctx.strokeStyle = th.waterTop;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // ---------- Objekte ----------

  drawObject(ctx, e, p, world) {
    const t = this.time;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    switch (e.type) {
      case "missile":
      case "airmissile": {
        ctx.rotate(Math.atan2(e.vy, e.vx));
        ctx.fillStyle = "#3d3d4a";
        ctx.beginPath();
        ctx.moveTo(-7, -4);
        ctx.lineTo(-3, -2);
        ctx.lineTo(-3, 2);
        ctx.lineTo(-7, 4);
        ctx.fill();
        roundRect(ctx, -6, -2.6, 11, 5.2, 2.5);
        ctx.fillStyle = "#9aa3b2";
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e8433b";
        ctx.beginPath();
        ctx.moveTo(4, -2.6);
        ctx.lineTo(9, 0);
        ctx.lineTo(4, 2.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case "grenade":
      case "cluster":
      case "clusterlet": {
        const r = e.type === "clusterlet" ? 2.6 : 4.6;
        ctx.rotate((e.age ?? 0) * 0.15 * Math.sign(e.vx || 1));
        ctx.fillStyle = e.type === "grenade" ? "#3f8a3a" : e.type === "cluster" ? "#d8423a" : "#55313a";
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (e.type !== "clusterlet") {
          ctx.fillStyle = "#c9c9c9";
          ctx.fillRect(-1.5, -r - 2.5, 3, 3);
          ctx.strokeRect(-1.5, -r - 2.5, 3, 3);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath();
          ctx.arc(-1.4, -1.4, 1.4, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case "banana":
      case "bananalet": {
        const s = e.type === "banana" ? 1 : 0.8;
        ctx.rotate((e.age ?? 0) * 0.25);
        ctx.scale(s, s);
        ctx.lineCap = "round";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6.5;
        ctx.beginPath();
        ctx.arc(0, -4, 7, 0.35, Math.PI - 0.35);
        ctx.stroke();
        ctx.strokeStyle = "#ffd83d";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#6b4a1e";
        ctx.beginPath();
        ctx.arc(6.6, -1.6, 1.5, 0, TAU);
        ctx.arc(-6.6, -1.6, 1.5, 0, TAU);
        ctx.fill();
        break;
      }
      case "holy":
        ctx.rotate((e.age ?? 0) * 0.1);
        ctx.fillStyle = "#ffd23d";
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff6b0";
        ctx.fillRect(-1, -11, 2, 7);
        ctx.fillRect(-3, -9, 6, 2);
        ctx.strokeRect(-1, -11, 2, 7);
        break;
      case "dynamite":
        ctx.fillStyle = "#e8433b";
        roundRect(ctx, -3, -7, 6, 13, 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#5a4630";
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.quadraticCurveTo(3, -10, 2, -12);
        ctx.stroke();
        ctx.fillStyle = Math.sin(t * 40) > 0 ? "#ffef7a" : "#ff8a3d";
        ctx.beginPath();
        ctx.arc(2, -12.5, 2 + Math.random(), 0, TAU);
        ctx.fill();
        break;
      case "sheep":
      case "supersheep":
        this.drawSheep(ctx, e);
        break;
      case "oldwoman":
        this.drawGranny(ctx, e);
        break;
      case "donkey":
        this.drawDonkey(ctx);
        break;
      case "mine": {
        ctx.fillStyle = "#4a4a55";
        ctx.beginPath();
        ctx.arc(0, 1, 5.5, Math.PI, 0);
        ctx.lineTo(5.5, 3);
        ctx.lineTo(-5.5, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const blink = e.fuse > 0 ? Math.sin(t * 25) > 0 : Math.sin(t * 3) > 0.6;
        ctx.fillStyle = blink ? "#ff3b3b" : "#7a2020";
        ctx.beginPath();
        ctx.arc(0, -3, 1.8, 0, TAU);
        ctx.fill();
        break;
      }
      case "barrel":
        ctx.fillStyle = "#d8423a";
        roundRect(ctx, -7, -9, 14, 18, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff3d6";
        ctx.fillRect(-7, -4, 14, 2.4);
        ctx.fillRect(-7, 2, 14, 2.4);
        ctx.fillStyle = INK;
        ctx.font = "bold 7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ÖL", 0, 1.2);
        break;
      case "crate":
        this.drawCrate(ctx, e);
        break;
      case "fire": {
        const f = 3 + Math.sin(t * 20 + e.id) * 1.2;
        ctx.fillStyle = "rgba(255,120,30,0.9)";
        ctx.beginPath();
        ctx.arc(0, -f * 0.6, f + 1.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,230,90,0.95)";
        ctx.beginPath();
        ctx.arc(0, -f * 0.6, f * 0.6, 0, TAU);
        ctx.fill();
        break;
      }
      case "grave":
        ctx.fillStyle = "#b9b9c6";
        ctx.beginPath();
        ctx.moveTo(-5, 6);
        ctx.lineTo(-5, -4);
        ctx.arc(0, -4, 5, Math.PI, 0);
        ctx.lineTo(5, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = TEAM_COLORS[world.teams[e.team]?.color] ?? "#888";
        ctx.fillRect(-1, -6, 2, 8);
        ctx.fillRect(-3, -4, 6, 2);
        break;
    }
    ctx.restore();
  }

  drawSheep(ctx, e) {
    const fly = e.mode === "fly";
    if (fly) {
      ctx.rotate(e.ang + (Math.cos(e.ang) < 0 ? Math.PI : 0));
      ctx.scale(Math.cos(e.ang) < 0 ? -1 : 1, 1);
    } else ctx.scale(e.dir, 1);
    const step = Math.sin(this.time * 18 + e.id) * 1.5;
    if (e.type === "supersheep") {
      ctx.fillStyle = "#e8433b";
      ctx.beginPath();
      ctx.moveTo(-2, -6);
      ctx.quadraticCurveTo(-14, -6 + (fly ? 0 : 6), -16, fly ? -2 + step : 6);
      ctx.lineTo(-4, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    if (!fly) {
      ctx.fillRect(-5 + step, 3, 2, 5);
      ctx.fillRect(3 - step, 3, 2, 5);
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    for (const [x, y, r] of [[-5, -1, 4], [0, -3, 4.5], [4, -1, 4], [-2, 2, 4], [3, 2, 3.5]]) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.ellipse(8, -3, 3.5, 2.8, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(9, -4, 1, 0, TAU);
    ctx.fill();
  }

  drawGranny(ctx, e) {
    ctx.scale(e.dir, 1);
    const step = Math.sin(this.time * 6 + e.id) * 1;
    ctx.fillStyle = "#8c5bb5";
    ctx.beginPath();
    ctx.moveTo(-5, 7);
    ctx.lineTo(-3, -4);
    ctx.lineTo(3, -4);
    ctx.lineTo(5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd9b8";
    ctx.beginPath();
    ctx.arc(1, -7, 3.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e6e6ee";
    ctx.beginPath();
    ctx.arc(-1.5, -9.5, 2.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#6b4a1e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(7 + step, 8);
    ctx.stroke();
  }

  drawDonkey(ctx) {
    ctx.fillStyle = "#a7a7b2";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(ctx, -14, -8, 24, 14, 4);
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, 6, -18, 10, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(7, -25, 3, 8);
    ctx.strokeRect(7, -25, 3, 8);
    ctx.fillRect(12, -25, 3, 8);
    ctx.strokeRect(12, -25, 3, 8);
    for (const x of [-12, -6, 0, 5]) {
      ctx.fillRect(x, 6, 4, 9);
      ctx.strokeRect(x, 6, 4, 9);
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(12.5, -13, 1.3, 0, TAU);
    ctx.fill();
  }

  drawCrate(ctx, e) {
    if (e.chute) {
      ctx.strokeStyle = "rgba(43,35,64,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(-14, -28);
      ctx.moveTo(8, -8);
      ctx.lineTo(14, -28);
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -32);
      ctx.stroke();
      ctx.fillStyle = e.kind === "health" ? "#fff" : "#ff8a3d";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-18, -26);
      ctx.quadraticCurveTo(0, -46, 18, -26);
      ctx.quadraticCurveTo(0, -32, -18, -26);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    if (e.kind === "health") {
      ctx.fillStyle = "#fff";
      roundRect(ctx, -8, -8, 16, 16, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e8433b";
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = "#c98a46";
      roundRect(ctx, -8, -8, 16, 16, 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#8a5a28";
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(8, -3);
      ctx.moveTo(-8, 3);
      ctx.lineTo(8, 3);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", 0, 0.5);
    }
  }

  drawRope(ctx, w, p) {
    ctx.strokeStyle = "#7a5a32";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 3);
    for (let i = w.rope.p.length - 1; i >= 0; i--) ctx.lineTo(w.rope.p[i][0], w.rope.p[i][1]);
    ctx.stroke();
    const a = w.rope.p[0];
    ctx.fillStyle = "#9aa3b2";
    ctx.beginPath();
    ctx.arc(a[0], a[1], 2.5, 0, TAU);
    ctx.fill();
  }

  drawBungee(ctx, w, p) {
    ctx.strokeStyle = "#e8433b";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(w.bng.ax, w.bng.ay);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawPlane(ctx, pl, view) {
    const speed = 420;
    const x = pl.x - pl.dir * 650 + pl.dir * speed * pl.age;
    const y = view.y0 + 90;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pl.dir, 1);
    ctx.fillStyle = "#6f7d8c";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(ctx, -30, -6, 60, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-15, 18);
    ctx.lineTo(5, 18);
    ctx.lineTo(10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-28, -4);
    ctx.lineTo(-36, -16);
    ctx.lineTo(-26, -16);
    ctx.lineTo(-20, -4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#bfe9ff";
    ctx.fillRect(14, -4, 8, 4);
    ctx.restore();
  }

  // ---------- Würmer ----------

  drawWorm(ctx, w, p, world, active, s) {
    const team = world.teams[w.team];
    const color = TEAM_COLORS[team?.color] ?? "#888";
    const t = this.time;
    const moving = s.moving(w);
    if (active) this.drawHeldWeapon(ctx, w, p, world);
    const anim = s.anim(w);
    ctx.save();
    ctx.translate(p.x, p.y);
    let tilt = 0;
    if (w.mode === "fly") tilt = Math.max(-0.9, Math.min(0.9, w.vx * 0.18));
    else if (w.mode === "air" || w.mode === "jet" || w.mode === "bungee" || w.mode === "rope") tilt = Math.max(-0.4, Math.min(0.4, w.vx * 0.08));
    ctx.rotate(tilt + anim.rot);
    // Strecken/Stauchen mit den Füßen als Ankerpunkt
    ctx.translate(0, 7);
    ctx.scale(w.face * anim.sx, anim.sy);
    ctx.translate(0, -7);
    const bob = moving ? Math.abs(Math.sin(t * 14)) * -1.6 : Math.sin(t * 2.2 + w.id) * 0.5;

    if (w.mode === "jet") {
      ctx.fillStyle = "#8b95a5";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      roundRect(ctx, -12, -8 + bob, 6, 12, 2);
      ctx.fill();
      ctx.stroke();
      if (w.thr) {
        ctx.fillStyle = Math.random() < 0.5 ? "#ffd23d" : "#ff8a3d";
        ctx.beginPath();
        ctx.moveTo(-11.5, 4);
        ctx.lineTo(-9, 12 + Math.random() * 6);
        ctx.lineTo(-6.5, 4);
        ctx.fill();
      }
    }

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = BODY;
    // Schwanz
    ctx.beginPath();
    ctx.ellipse(-6, 5.5, 6, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Körper
    roundRect(ctx, -6, -11 + bob, 12, 18.5 - bob, 6);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = BODY_DARK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.quadraticCurveTo(0, 3.2, 3, 2);
    ctx.moveTo(-3, 4.5);
    ctx.quadraticCurveTo(0, 5.7, 3, 4.5);
    ctx.stroke();
    // Stirnband in Teamfarbe
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.fillRect(-6.2, -9.5 + bob, 12.4, 3);
    ctx.strokeRect(-6.2, -9.5 + bob, 12.4, 3);
    const flutter = Math.sin(t * 9 + w.id) * 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -8.5 + bob);
    ctx.lineTo(-11, -10 + bob + flutter);
    ctx.lineTo(-10.5, -7 + bob + flutter);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Augen
    const ey = -4.5 + bob;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    for (const ex of [1.2, 5]) {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 2.4, 3, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    if (w.hp <= 0 || w.drown) {
      ctx.lineWidth = 1;
      for (const ex of [1.2, 5]) {
        ctx.beginPath();
        ctx.moveTo(ex - 1.3, ey - 1.3);
        ctx.lineTo(ex + 1.3, ey + 1.3);
        ctx.moveTo(ex + 1.3, ey - 1.3);
        ctx.lineTo(ex - 1.3, ey + 1.3);
        ctx.stroke();
      }
    } else {
      const px = Math.cos(w.aim) * 1;
      const py = Math.sin(w.aim) * 1.4;
      for (const ex of [1.2, 5]) {
        ctx.beginPath();
        ctx.arc(ex + px + 0.3, ey + py, 1.2, 0, TAU);
        ctx.fill();
      }
    }
    // Mund
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (w.mode === "fly" || w.drown) ctx.arc(4, 1 + bob, 1.5, 0, TAU);
    else ctx.arc(3.5, -0.5 + bob, 2, 0.2, Math.PI - 0.6);
    ctx.stroke();
    ctx.restore();
  }

  drawHeldWeapon(ctx, w, p, world) {
    const t = world.turn;
    if (t.phase !== "play" || t.fired || w.mode !== "stand") return;
    const wp = WEAPON[t.weapon];
    if (!wp || wp.noAim || wp.target) return;
    ctx.save();
    ctx.translate(p.x, p.y - 1);
    ctx.scale(w.face, 1);
    ctx.rotate(w.aim);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    switch (wp.id) {
      case "bazooka":
        ctx.fillStyle = "#6b8e4e";
        roundRect(ctx, -6, -3, 24, 6, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#3d3d4a";
        ctx.fillRect(14, -3.5, 3, 7);
        ctx.strokeRect(14, -3.5, 3, 7);
        break;
      case "shotgun":
        ctx.fillStyle = "#3d3d4a";
        ctx.fillRect(2, -1.5, 16, 3);
        ctx.fillStyle = "#8a5a28";
        roundRect(ctx, -4, -2.5, 8, 5, 2);
        ctx.fill();
        ctx.stroke();
        break;
      case "bat":
        ctx.fillStyle = "#c98a46";
        ctx.beginPath();
        ctx.moveTo(2, -1);
        ctx.lineTo(18, -2.5);
        ctx.lineTo(18, 2.5);
        ctx.lineTo(2, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case "rope":
        ctx.fillStyle = "#9aa3b2";
        ctx.beginPath();
        ctx.arc(10, 0, 3, 0, TAU);
        ctx.fill();
        ctx.stroke();
        break;
      default: {
        const colors = { grenade: "#3f8a3a", cluster: "#d8423a", banana: "#ffd83d", holy: "#ffd23d" };
        ctx.fillStyle = colors[wp.id] ?? "#888";
        ctx.beginPath();
        ctx.arc(11, 0, 3.8, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawAim(ctx, world, s) {
    const t = world.turn;
    if (t.phase !== "play" || t.fired) return;
    const w = world.activeWorm();
    if (!w || w.dead || (w.mode !== "stand" && !(t.weapon === "rope" && (w.mode === "air" || w.mode === "fly")))) return;
    const wp = WEAPON[t.weapon];
    if (!wp || wp.noAim || wp.target) return;
    const p = s.pos(w);
    const dx = Math.cos(w.aim) * w.face;
    const dy = Math.sin(w.aim);
    const color = TEAM_COLORS[world.teams[t.team]?.color] ?? "#e8433b";
    if (t.charging) {
      for (let i = 0; i < 14; i++) {
        const f = i / 14;
        if (f > t.power) break;
        const d = 14 + f * 70;
        ctx.fillStyle = `hsl(${55 - f * 55}, 100%, 55%)`;
        ctx.beginPath();
        ctx.arc(p.x + dx * d, p.y - 2 + dy * d, 1.5 + f * 4.5, 0, TAU);
        ctx.fill();
      }
    }
    const cx = p.x + dx * 52;
    const cy = p.y - 2 + dy * 52;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy);
    ctx.lineTo(cx - 3, cy);
    ctx.moveTo(cx + 3, cy);
    ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx, cy - 3);
    ctx.moveTo(cx, cy + 3);
    ctx.lineTo(cx, cy + 9);
    ctx.stroke();
  }

  // ---------- Bildschirm-Beschriftungen ----------

  text(ctx, str, x, y, fill, size = 13, stroke = INK) {
    ctx.font = `700 ${size}px Fredoka, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size / 4);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  drawLabels(ctx, s) {
    const { world, cam, fx } = s;
    const t = world.turn;
    const z = cam.zoom;
    for (const w of world.ents.values()) {
      if (w.type !== "worm" || w.dead) continue;
      const p = this.toScreen(cam, s.pos(w).x, s.pos(w).y);
      const color = TEAM_COLORS[world.teams[w.team]?.color] ?? "#fff";
      const top = p.y - 16 * z - 8;
      if (!w.drown) {
        this.text(ctx, String(Math.max(0, w.hp)), p.x, top, color, 13);
        this.text(ctx, w.name, p.x, top - 14, color, 12);
      }
      if (w.mode === "jet") {
        ctx.fillStyle = INK;
        ctx.fillRect(p.x - 17, top + 4, 34, 6);
        ctx.fillStyle = "#ffd23d";
        ctx.fillRect(p.x - 16, top + 5, 32 * Math.max(0, w.fuel / JET_FUEL), 4);
      }
      const isActive = w.id === t.worm && t.phase === "play";
      if (isActive && s.showArrow) {
        const ay = top - 34 + Math.sin(this.time * 8) * 4;
        ctx.fillStyle = color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x - 9, ay - 10);
        ctx.lineTo(p.x + 9, ay - 10);
        ctx.lineTo(p.x, ay);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
      const b = fx.bubbles.get(w.id);
      if (b) this.drawBubble(ctx, p.x, top - (isActive && s.showArrow ? 50 : 30), b);
    }
    for (const e of world.ents.values()) {
      if (e.fuse === undefined || e.fuse <= 0 || !["grenade", "cluster", "banana", "holy", "dynamite"].includes(e.type)) continue;
      const p = this.toScreen(cam, s.pos(e).x, s.pos(e).y);
      this.text(ctx, String(Math.ceil(e.fuse / 60)), p.x, p.y - 12 * z - 6, "#fff", 13);
    }
    for (const e of world.ents.values()) {
      if (e.type !== "oldwoman" && e.type !== "sheep" && e.type !== "supersheep") continue;
      const b = fx.bubbles.get(e.id);
      if (b) {
        const p = this.toScreen(cam, s.pos(e).x, s.pos(e).y);
        this.drawBubble(ctx, p.x, p.y - 18 * z - 8, b);
      }
    }
    for (const tx of fx.texts) {
      const p = this.toScreen(cam, tx.x, tx.y);
      const a = tx.age / tx.life;
      ctx.globalAlpha = Math.min(1, (1 - a) * 2.5);
      if (tx.comic) {
        const sc = 1 + Math.min(0.4, tx.age * 3);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(-0.12);
        ctx.scale(sc, sc);
        this.text(ctx, tx.text, 0, 0, tx.color, tx.size * Math.min(1.4, z + 0.3), "#7a1e00");
        ctx.restore();
      } else {
        this.text(ctx, tx.text, p.x, p.y - a * 40 - 30, tx.color, tx.size);
      }
      ctx.globalAlpha = 1;
    }
    if (s.target) {
      const p = this.toScreen(cam, s.target.x, s.target.y);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14 + Math.sin(this.time * 6) * 2, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "#e8433b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 20, p.y);
      ctx.lineTo(p.x + 20, p.y);
      ctx.moveTo(p.x, p.y - 20);
      ctx.lineTo(p.x, p.y + 20);
      ctx.stroke();
      if (s.target.dir) this.text(ctx, s.target.dir > 0 ? "→" : "←", p.x, p.y - 26, "#fff", 18);
    }
  }

  drawBubble(ctx, x, y, b) {
    ctx.font = "600 13px Fredoka, sans-serif";
    const w = ctx.measureText(b.text).width + 16;
    const h = 22;
    const pop = Math.min(1, b.age * 8);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, (b.life - b.age) * 3);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(ctx, -w / 2, -h - 6, w, h, 9);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.lineTo(0, 1);
    ctx.lineTo(5, -7);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-5, -9, 10, 3);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, 0, -h / 2 - 6);
    ctx.restore();
  }
}

