import { Rng } from "./rng.js";
import { Terrain } from "./terrain.js";

// Zufällige Inselkarte aus geglättetem Rauschen. Läuft nur beim Host, das Ergebnis
// wird als Bitmaske an alle verschickt.

function makeNoise(rng) {
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rng.next();
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const a = vals[perm[(perm[xi & 255] + yi) & 255]];
    const b = vals[perm[(perm[(xi + 1) & 255] + yi) & 255]];
    const c = vals[perm[(perm[xi & 255] + yi + 1) & 255]];
    const d = vals[perm[(perm[(xi + 1) & 255] + yi + 1) & 255]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise, x, y, octaves) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

const STYLES = ["huegel", "inseln", "hoehlen"];

export function generateMap(w, h, seed, waterLevel) {
  const rng = new Rng(seed);
  const style = rng.pick(STYLES);
  const shape = makeNoise(rng);
  const gapNoise = makeNoise(rng);
  const caveNoise = makeNoise(rng);

  const scale = rng.range(200, 300);
  const gapLevel = style === "inseln" ? 0.56 : 0.66;
  const tunnelWidth = style === "hoehlen" ? 0.055 : 0.035;
  const chambers = style === "hoehlen" ? 0.6 : 0.7;
  const baseHeight = rng.range(0.42, 0.52);
  const hilliness = style === "huegel" ? 0.32 : 0.22;
  const margin = w * 0.07;

  // Dichtefeld auf grobem Raster, danach bilinear auf Pixel interpoliert
  const step = 4;
  const gw = Math.ceil(w / step) + 1;
  const gh = Math.ceil(h / step) + 1;
  const grid = new Float32Array(gw * gh);
  for (let gx = 0; gx < gw; gx++) {
    const x = gx * step;
    const surface = baseHeight + (fbm(gapNoise, x / 700, 3.7, 3) - 0.5) * hilliness * 2;
    const edge = Math.min(x, w - x);
    const gap = fbm(gapNoise, x / 480, 0.5, 2);
    for (let gy = 0; gy < gh; gy++) {
      const y = gy * step;
      const ny = y / h;
      let d = fbm(shape, x / scale, y / scale, 5);
      d += (ny - surface) * 2.4;
      if (ny < 0.12) d -= (0.12 - ny) * 8;
      if (edge < margin) d -= (1 - edge / margin) ** 1.5 * 2.6;
      if (gap > gapLevel) d -= (gap - gapLevel) * 6;
      if (ny > surface - 0.02) {
        const tunnel = Math.abs(fbm(caveNoise, x / 190, y / 140, 3) - 0.5);
        if (tunnel < tunnelWidth) d -= (tunnelWidth - tunnel) * 14;
        const chamber = fbm(caveNoise, x / 160 + 40, y / 160 + 40, 2);
        if (chamber > chambers) d -= (chamber - chambers) * 6;
      }
      grid[gy * gw + gx] = d;
    }
  }

  const terrain = new Terrain(w, h);
  const mask = terrain.mask;
  for (let y = 0; y < h; y++) {
    const gy = Math.floor(y / step);
    const fy = (y - gy * step) / step;
    const row0 = gy * gw;
    const row1 = Math.min(gh - 1, gy + 1) * gw;
    for (let x = 0; x < w; x++) {
      const gx = Math.floor(x / step);
      const fx = (x - gx * step) / step;
      const gx1 = Math.min(gw - 1, gx + 1);
      const a = grid[row0 + gx];
      const b = grid[row0 + gx1];
      const c = grid[row1 + gx];
      const d = grid[row1 + gx1];
      const v = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
      if (v > 0.5) mask[y * w + x] = 1;
    }
  }

  // Unterhalb des Wassers ist alles egal – aber nichts darf am Kartenboden kleben bleiben,
  // was später als schwebender Krümel übrig bleibt.
  removeSmallRegions(terrain, 1500, 1);
  removeSmallRegions(terrain, 250, 0);
  return { terrain, style };
}

// Entfernt zusammenhängende Bereiche mit Wert `value`, die kleiner als minSize sind.
// Luftblasen (value 0) werden aufgefüllt, Erdkrümel (value 1) gelöscht.
function removeSmallRegions(terrain, minSize, value) {
  const { w, h, mask } = terrain;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const region = [];
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || mask[start] !== value) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    region.length = 0;
    let touchesBorder = false;
    while (sp > 0) {
      const i = stack[--sp];
      if (region.length <= minSize) region.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      if (x > 0 && !seen[i - 1] && mask[i - 1] === value) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < w - 1 && !seen[i + 1] && mask[i + 1] === value) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && !seen[i - w] && mask[i - w] === value) { seen[i - w] = 1; stack[sp++] = i - w; }
      if (y < h - 1 && !seen[i + w] && mask[i + w] === value) { seen[i + w] = 1; stack[sp++] = i + w; }
    }
    if (region.length <= minSize && !(value === 0 && touchesBorder)) {
      for (const i of region) mask[i] = value ? 0 : 1;
    }
  }
}
