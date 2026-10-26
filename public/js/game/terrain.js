// Zerstörbares Gelände als Bitmaske (1 = Erde, 0 = Luft).

const circleCache = new Map();

// Pixel-Offsets eines gefüllten Kreises, nach Abstand zum Rand sortiert,
// damit Kollisionsabfragen meist schon beim ersten Treffer abbrechen.
function circleOffsets(r) {
  const key = Math.round(r * 2);
  let list = circleCache.get(key);
  if (list) return list;
  const rr = key / 2;
  const pts = [];
  const lim = Math.ceil(rr);
  for (let dy = -lim; dy <= lim; dy++) {
    for (let dx = -lim; dx <= lim; dx++) {
      const d = dx * dx + dy * dy;
      if (d <= rr * rr) pts.push([dx, dy, d]);
    }
  }
  pts.sort((a, b) => b[2] - a[2]);
  list = new Int16Array(pts.length * 2);
  pts.forEach((p, i) => {
    list[i * 2] = p[0];
    list[i * 2 + 1] = p[1];
  });
  circleCache.set(key, list);
  return list;
}

export class Terrain {
  constructor(w, h, mask) {
    this.w = w;
    this.h = h;
    this.mask = mask ?? new Uint8Array(w * h);
  }

  solid(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.mask[y * this.w + x] !== 0;
  }

  // Berührt ein Kreis mit Radius r bei (x, y) irgendein Erd-Pixel?
  circleHits(x, y, r) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const offs = circleOffsets(r);
    const { w, h, mask } = this;
    for (let i = 0; i < offs.length; i += 2) {
      const px = cx + offs[i];
      const py = cy + offs[i + 1];
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      if (mask[py * w + px]) return true;
    }
    return false;
  }

  carve(cx, cy, r) {
    const { w, h, mask } = this;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    const rr = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= rr) mask[row + x] = 0;
      }
    }
  }

  // Oberflächennormale (zeigt in die Luft) aus der Erdverteilung um einen Punkt.
  normal(x, y, r = 5) {
    let sx = 0;
    let sy = 0;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        if (this.solid(cx + dx, cy + dy)) {
          sx -= dx;
          sy -= dy;
        }
      }
    }
    const len = Math.hypot(sx, sy);
    if (len < 0.001) return { x: 0, y: -1 };
    return { x: sx / len, y: sy / len };
  }

  // Erster Erd-Pixel auf der Strecke, plus der letzte freie Punkt davor.
  raycast(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len));
    let px = x0;
    let py = y0;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (dx * i) / steps;
      const y = y0 + (dy * i) / steps;
      if (this.solid(x, y)) return { x, y, px, py, dist: (len * i) / steps };
      px = x;
      py = y;
    }
    return null;
  }

  // Lauflängen-Kodierung (abwechselnd Luft/Erde, beginnend mit Luft) als Base64-Varints.
  encode() {
    const { mask } = this;
    const bytes = [];
    const push = (n) => {
      while (n >= 128) {
        bytes.push((n & 127) | 128);
        n = Math.floor(n / 128);
      }
      bytes.push(n);
    };
    let cur = 0;
    let run = 0;
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i] ? 1 : 0;
      if (v === cur) run++;
      else {
        push(run);
        cur = v;
        run = 1;
      }
    }
    push(run);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.slice(i, i + 8192));
    }
    return btoa(bin);
  }

  static decode(w, h, data) {
    const bin = atob(data);
    const mask = new Uint8Array(w * h);
    let pos = 0;
    let cur = 0;
    let i = 0;
    while (i < bin.length && pos < mask.length) {
      let n = 0;
      let mul = 1;
      let b;
      do {
        b = bin.charCodeAt(i++);
        n += (b & 127) * mul;
        mul *= 128;
      } while (b & 128);
      if (cur) mask.fill(1, pos, Math.min(mask.length, pos + n));
      pos += n;
      cur ^= 1;
    }
    return new Terrain(w, h, mask);
  }
}
