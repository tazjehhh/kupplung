import { Terrain } from "../game/terrain.js";

export const THEMES = {
  wiese: {
    sky: ["#4fb8ee", "#bfe9ff"], far: "#9fd39a", mid: "#6fbf62", dirt: [146, 98, 56], top: [104, 196, 66],
    topEdge: [70, 150, 45], outline: [58, 36, 20], water: ["#2f86d6", "#1b5fa8"], waterTop: "#7cc8ff", deco: "stones",
  },
  wueste: {
    sky: ["#ff9f5a", "#ffe6a8"], far: "#f4c27f", mid: "#e5a560", dirt: [225, 174, 98], top: [247, 216, 144],
    topEdge: [214, 172, 96], outline: [120, 74, 28], water: ["#2aa6b8", "#167a8c"], waterTop: "#8fe6f0", deco: "stripes",
  },
  schnee: {
    sky: ["#88b9f2", "#eef6ff"], far: "#d4e3f6", mid: "#b5cbe8", dirt: [126, 144, 168], top: [250, 252, 255],
    topEdge: [196, 216, 238], outline: [40, 52, 76], water: ["#3a78b8", "#24548a"], waterTop: "#bfe2ff", deco: "stones", snow: true,
  },
  suess: {
    sky: ["#f49ad2", "#fff0fa"], far: "#ffd0ec", mid: "#ffb0dc", dirt: [150, 92, 62], top: [255, 186, 220],
    topEdge: [236, 140, 190], outline: [86, 38, 40], water: ["#c45ad6", "#8e34a8"], waterTop: "#f2b2ff", deco: "sprinkles",
  },
  vulkan: {
    sky: ["#231a33", "#9a3d26"], far: "#43293a", mid: "#33202c", dirt: [72, 64, 74], top: [116, 104, 110],
    topEdge: [80, 70, 76], outline: [16, 12, 18], water: ["#ff6a1f", "#c22d0a"], waterTop: "#ffd36b", deco: "embers", lava: true,
  },
};

const SPRINKLES = [[255, 90, 90], [90, 180, 255], [255, 230, 90], [120, 220, 120], [255, 255, 255], [190, 120, 255]];

// Kachelbare Struktur (Steine/Streifen) für das Erdreich
function makeTile(kind, size = 128) {
  const shade = new Float32Array(size * size);
  const color = new Int8Array(size * size).fill(-1);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (kind === "stripes") {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        shade[y * size + x] = Math.sin((y + Math.sin(x / size * Math.PI * 2) * 6) / size * Math.PI * 8) * 0.35;
      }
    }
  }
  const blobs = kind === "sprinkles" ? 30 : 46;
  for (let i = 0; i < blobs; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const r = 2 + rnd() * (kind === "stripes" ? 3 : 7);
    const s = (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.5);
    for (let y = -Math.ceil(r) - 1; y <= r + 1; y++) {
      for (let x = -Math.ceil(r) - 1; x <= r + 1; x++) {
        const d = Math.hypot(x, y);
        if (d > r) continue;
        const px = (Math.floor(cx + x) + size) % size;
        const py = (Math.floor(cy + y) + size) % size;
        shade[py * size + px] += s * (d > r - 1.2 ? 0.6 : 1);
      }
    }
  }
  if (kind === "sprinkles" || kind === "embers") {
    for (let i = 0; i < (kind === "sprinkles" ? 60 : 25); i++) {
      const cx = Math.floor(rnd() * size);
      const cy = Math.floor(rnd() * size);
      const c = kind === "sprinkles" ? Math.floor(rnd() * SPRINKLES.length) : 7;
      const horizontal = rnd() < 0.5;
      for (let k = 0; k < (kind === "sprinkles" ? 4 : 2); k++) {
        for (let t = 0; t < 2; t++) {
          const px = (cx + (horizontal ? k : t)) % size;
          const py = (cy + (horizontal ? t : k)) % size;
          color[py * size + px] = c;
        }
      }
    }
  }
  return { size, shade, color };
}

export class TerrainRenderer {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  // Komplett neu zeichnen: Grasdecke vom Originalgelände, Löcher vom aktuellen.
  build(world) {
    const { w, h } = world;
    this.world = world;
    this.theme = THEMES[world.theme] ?? THEMES.wiese;
    this.canvas.width = w;
    this.canvas.height = h;
    this.tile = makeTile(this.theme.deco);
    const orig = Terrain.decode(w, h, world.orig).mask;
    const cur = world.terrain.mask;
    const img = this.ctx.createImageData(w, h);
    const d = img.data;
    const th = this.theme;
    const { size, shade, color } = this.tile;
    const depthArr = new Int16Array(w).fill(-1);

    for (let y = 0; y < h; y++) {
      const fade = 1 - (y / h) * 0.25;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!orig[i]) {
          depthArr[x] = -1;
          continue;
        }
        const depth = depthArr[x] === -1 && (y === 0 || !orig[i - w]) ? 0 : depthArr[x] + 1;
        depthArr[x] = Math.min(depth, 1000);
        if (!cur[i]) continue;
        const grass = 7 + Math.sin(x * 0.13) * 2.2 + Math.sin(x * 0.041 + 1) * 2;
        let r, g, b;
        if (depth < grass) {
          const c = depth > grass - 2.5 ? th.topEdge : th.top;
          [r, g, b] = c;
        } else {
          const ti = (y % size) * size + (x % size);
          const col = color[ti];
          if (col >= 0) {
            [r, g, b] = col === 7 ? [255, 120 + (x % 3) * 30, 40] : SPRINKLES[col];
          } else {
            const s = 1 + shade[ti] * 0.12;
            r = th.dirt[0] * s * fade;
            g = th.dirt[1] * s * fade;
            b = th.dirt[2] * s * fade;
          }
        }
        const o = i * 4;
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
        d[o + 3] = 255;
      }
    }
    this.outline(d, cur, w, 0, 0, w, h);
    this.ctx.putImageData(img, 0, 0);
  }

  // Dunkler Rand überall dort, wo Erde an Luft grenzt.
  outline(d, mask, w, x0, y0, x1, y1, stride = w, ox = 0, oy = 0) {
    const h = mask.length / w;
    const [or, og, ob] = this.theme.outline;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        let edge = false;
        for (let k = 1; k <= 2 && !edge; k++) {
          if ((x - k >= 0 && !mask[i - k]) || (x + k < w && !mask[i + k]) ||
              (y - k >= 0 && !mask[i - k * w]) || (y + k < h && !mask[i + k * w])) edge = true;
        }
        if (!edge && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
          edge = !mask[i - w - 1] || !mask[i - w + 1] || !mask[i + w - 1] || !mask[i + w + 1];
        }
        if (edge) {
          const o = ((y - oy) * stride + (x - ox)) * 4;
          d[o] = or;
          d[o + 1] = og;
          d[o + 2] = ob;
          d[o + 3] = 255;
        }
      }
    }
  }

  // Nach einer Explosion: Loch ausschneiden, Rand nachziehen, Brandspuren malen.
  carve(cx, cy, r) {
    const world = this.world;
    const { w, h } = world;
    const mask = world.terrain.mask;
    const pad = r + 6;
    const x0 = Math.max(0, Math.floor(cx - pad));
    const y0 = Math.max(0, Math.floor(cy - pad));
    const x1 = Math.min(w, Math.ceil(cx + pad));
    const y1 = Math.min(h, Math.ceil(cy + pad));
    if (x1 <= x0 || y1 <= y0) return;
    const rw = x1 - x0;
    const img = this.ctx.getImageData(x0, y0, rw, y1 - y0);
    const d = img.data;
    const scorch = r + 5;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = ((y - y0) * rw + (x - x0)) * 4;
        if (!mask[y * w + x]) {
          d[o + 3] = 0;
          continue;
        }
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= scorch && r > 6) {
          const k = 0.72 + (dist / scorch) * 0.25;
          d[o] *= k;
          d[o + 1] *= k;
          d[o + 2] *= k;
        }
      }
    }
    this.outline(d, mask, w, x0, y0, x1, y1, rw, x0, y0);
    this.ctx.putImageData(img, x0, y0);
  }
}
