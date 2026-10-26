import { WEAPONS } from "./weapons.js";

export const CRATE_CHANCE = { aus: 0, selten: 0.2, normal: 0.4, oft: 0.75 };
export const WATER_RISE = { langsam: 15, normal: 30, schnell: 55 };

export function defaultAmmo() {
  return Object.fromEntries(WEAPONS.map((w) => [w.id, w.ammo]));
}

export const AMMO_PRESETS = {
  standard: { name: "Standard", ammo: defaultAmmo },
  unendlich: { name: "Alles unendlich", ammo: () => Object.fromEntries(WEAPONS.map((w) => [w.id, -1])) },
  basis: {
    name: "Nur Basis",
    ammo: () => Object.fromEntries(WEAPONS.map((w) => [w.id, w.cat === 0 || w.cat === 4 ? w.ammo : 0])),
  },
  chaos: {
    name: "Chaos",
    ammo: () => Object.fromEntries(WEAPONS.map((w) => [w.id, w.cat === 4 || w.cat === 0 ? -1 : 3])),
  },
};

export const DEFAULT_SETTINGS = {
  worms: 4,
  hp: 100,
  turnTime: 45,
  retreat: 3,
  mapSize: "medium",
  theme: "zufall",
  mines: 6,
  barrels: 5,
  dudMines: true,
  crates: "normal",
  crateHealth: 25,
  wind: true,
  fallDamage: true,
  sdMinutes: 15,
  sdOneHp: false,
  waterRise: "normal",
  ammo: defaultAmmo(),
};

// Ergänzt fehlende/ungültige Werte (z. B. aus alten Räumen) mit Standardwerten.
export function normalizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s && typeof s === "object" ? s : {}) };
  out.ammo = { ...defaultAmmo(), ...(s?.ammo ?? {}) };
  out.worms = Math.max(1, Math.min(8, out.worms | 0));
  return out;
}
