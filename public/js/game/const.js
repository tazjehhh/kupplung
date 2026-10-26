// Physik läuft mit festen 60 Ticks pro Sekunde, Einheiten sind Pixel und Ticks.
export const TICK_RATE = 60;
export const GRAVITY = 0.18;
export const WIND_FORCE = 0.028;
export const WORM_R = 7;
export const MAX_STEP = 6;
export const WALK_SPEED = 0.85;
export const MAX_THROW = 15;
export const FALL_DAMAGE_SPEED = 7.2;
export const ROPE_MAX = 420;
export const JET_FUEL = 330;
// Ausholen vor dem Sprung in Ticks; ein zweites Enter in dieser Zeit wird zum Rückwärtssalto
export const JUMP_PREP = 11;

export const MAP_SIZES = {
  small: { w: 1800, h: 960 },
  medium: { w: 2500, h: 1150 },
  large: { w: 3300, h: 1350 },
};

export const THEMES = ["wiese", "wueste", "schnee", "suess", "vulkan"];

export const TEAM_COLORS = ["#e8433b", "#3b82f6", "#22b14c", "#f5b700", "#a55eea", "#ff7a1a"];
export const TEAM_COLOR_NAMES = ["Rot", "Blau", "Grün", "Gelb", "Lila", "Orange"];

export const PROJECTILES = new Set([
  "missile", "grenade", "cluster", "clusterlet", "banana", "bananalet", "holy",
  "dynamite", "airmissile", "sheep", "supersheep", "oldwoman", "donkey",
]);

// Stimmpakete (Hedgewars), Reihenfolge = Standardzuteilung nach Teamnummer
export const VOICE_PACKS = ["Default", "Pirate", "British", "Mobster", "Surfer", "Robot", "Classic", "Singer", "Russian"];
export const VOICE_NAMES = {
  Default: "Standard", Pirate: "Pirat", British: "Brite", Mobster: "Mafioso", Surfer: "Surfer",
  Robot: "Roboter", Classic: "Klassisch", Singer: "Sänger", Russian: "Russe",
};
