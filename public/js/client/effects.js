// Rein optische Effekte: Partikel, Schadenszahlen, Sprechblasen. Nur im Client.

const BOOM_WORDS = ["BUMM!", "KRACH!", "WUMMS!", "PENG!", "ZACK!", "RUMS!", "KABUMM!"];

export class Effects {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.bubbles = new Map();
    this.flashes = [];
    this.shake = 0;
    this.tracers = [];
    this.planes = [];
  }

  add(p) {
    if (this.parts.length > 1500) this.parts.shift();
    p.age = 0;
    this.parts.push(p);
  }

  explosion(x, y, r, dirtColor) {
    const big = r >= 40;
    this.flashes.push({ x, y, r: r * 1.3, age: 0, life: 0.22 });
    this.add({ kind: "ring", x, y, r: r * 0.4, grow: r * 3.2, life: 0.35, color: "rgba(255,255,255,0.9)" });
    const fire = Math.round(6 + r / 6);
    for (let i = 0; i < fire; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * r * 0.05;
      this.add({ kind: "fire", x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, size: r * (0.25 + Math.random() * 0.3), life: 0.35 + Math.random() * 0.3 });
    }
    const smoke = Math.round(4 + r / 8);
    for (let i = 0; i < smoke; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: "smoke", x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.4, vx: Math.cos(a) * 0.4, vy: -0.6 - Math.random() * 0.8, size: r * (0.2 + Math.random() * 0.25), life: 1 + Math.random() * 0.9, shade: 60 + Math.random() * 60 });
    }
    const debris = Math.round(8 + r / 3);
    for (let i = 0; i < debris; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const s = 2 + Math.random() * (r / 10);
      this.add({ kind: "debris", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: 2 + Math.random() * 3, life: 1 + Math.random() * 0.8, color: dirtColor, grav: 0.18, rot: Math.random() * 6 });
    }
    if (big) this.texts.push({ x, y: y - r * 0.6, text: BOOM_WORDS[Math.floor(Math.random() * BOOM_WORDS.length)], color: "#ffd23d", age: 0, life: 0.9, size: 16 + r / 4, comic: true });
    this.shake = Math.max(this.shake, r / 6);
  }

  puff(x, y, n = 6, color = 200) {
    for (let i = 0; i < n; i++) {
      this.add({ kind: "smoke", x, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 1.2, size: 4 + Math.random() * 6, life: 0.6 + Math.random() * 0.5, shade: color });
    }
  }

  splash(x, y, size = 1) {
    for (let i = 0; i < 14 * size; i++) {
      this.add({ kind: "drop", x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 4 * size, size: 2 + Math.random() * 2.5, life: 1.2, grav: 0.2 });
    }
  }

  sparkle(x, y, color = "#bfefff") {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.5 + Math.random() * 2.5;
      this.add({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: 2 + Math.random() * 2, life: 0.7 + Math.random() * 0.4, color });
    }
  }

  trail(x, y) {
    this.add({ kind: "smoke", x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.2, size: 3 + Math.random() * 2, life: 0.7, shade: 220 });
  }

  flame(x, y, vx, vy) {
    this.add({ kind: "fire", x, y, vx, vy, size: 3 + Math.random() * 3, life: 0.25 });
  }

  floatText(x, y, text, color, size = 18) {
    this.texts.push({ x, y, text, color, age: 0, life: 1.6, size });
  }

  say(id, text) {
    this.bubbles.set(id, { text, age: 0, life: 2.6 });
  }

  tracer(x0, y0, x1, y1) {
    this.tracers.push({ x0, y0, x1, y1, age: 0, life: 0.18 });
  }

  plane(x, dir) {
    this.planes.push({ x, dir, age: 0, life: 3 });
  }

  update(dt) {
    const k = dt * 60;
    for (const p of this.parts) {
      p.age += dt;
      p.x += (p.vx ?? 0) * k;
      p.y += (p.vy ?? 0) * k;
      if (p.grav) p.vy += p.grav * k;
      if (p.kind === "smoke") {
        p.vx *= 0.98;
        p.size += 0.15 * k;
      }
      if (p.kind === "fire") p.size *= 1 - 0.02 * k;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const t of this.texts) t.age += dt;
    this.texts = this.texts.filter((t) => t.age < t.life);
    for (const [id, b] of this.bubbles) {
      b.age += dt;
      if (b.age > b.life) this.bubbles.delete(id);
    }
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < f.life);
    for (const t of this.tracers) t.age += dt;
    this.tracers = this.tracers.filter((t) => t.age < t.life);
    for (const p of this.planes) p.age += dt;
    this.planes = this.planes.filter((p) => p.age < p.life);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  // Zeichnen im Welt-Koordinatensystem
  draw(ctx, camera) {
    for (const f of this.flashes) {
      const a = 1 - f.age / f.life;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, `rgba(255,255,230,${a})`);
      g.addColorStop(0.4, `rgba(255,220,90,${a * 0.9})`);
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of this.parts) {
      const t = p.age / p.life;
      const a = 1 - t;
      switch (p.kind) {
        case "smoke":
          ctx.fillStyle = `rgba(${p.shade},${p.shade},${p.shade},${a * 0.55})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "fire": {
          const gg = Math.round(230 - t * 160);
          ctx.fillStyle = `rgba(255,${gg},${Math.round(60 - t * 60)},${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "debris":
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          ctx.globalAlpha = 1;
          break;
        case "ring":
          ctx.strokeStyle = p.color.replace("0.9", String(a * 0.8));
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + p.grow * t, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "drop":
          ctx.fillStyle = `rgba(190,230,255,${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "spark":
          ctx.fillStyle = p.color;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
      }
    }
    for (const tr of this.tracers) {
      ctx.strokeStyle = `rgba(255,240,150,${1 - tr.age / tr.life})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tr.x0, tr.y0);
      ctx.lineTo(tr.x1, tr.y1);
      ctx.stroke();
    }
  }
}
