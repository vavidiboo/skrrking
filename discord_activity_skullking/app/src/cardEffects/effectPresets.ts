import type {
  CardEffectDescriptor,
  CardEffectEventType,
  CardEffectPreset,
  CardEffectType,
  EffectChannel,
  EffectPriority,
  EffectQualityTier,
  GameCardLike,
  ShakeStrength,
} from "../types";

const BASE_PRESET: CardEffectPreset = {
  effectType: "default",
  themeClass: "default",
  flashColor: "rgba(255, 236, 173, 0.82)",
  auraColors: ["#ffe9a8", "#f1b347", "#ffffff"],
  dimBackground: false,
  shakeStrength: "none",
  particleStyle: "spark",
  particleCount: 10,
  particleSpread: 140,
  travelScale: 1.18,
  arrivalScale: 1.04,
  rotation: 0,
  moveDuration: 0.46,
  resolveDelay: 0.54,
  totalDuration: 1.38,
  moveEase: [0.18, 0.88, 0.22, 1],
  impactRing: true,
  resultGlow: "gold",
  emblem: "none",
  arcLift: 72,
};

export const CARD_EFFECT_PRESETS: Record<CardEffectType, CardEffectPreset> = {
  default: BASE_PRESET,
  suit: {
    ...BASE_PRESET,
    effectType: "suit",
    themeClass: "suit",
    flashColor: "rgba(255, 243, 194, 0.7)",
    auraColors: ["#ffe39d", "#d4a73c", "#fff5d5"],
    particleCount: 8,
    travelScale: 1.14,
    arrivalScale: 1.02,
    moveDuration: 0.4,
    totalDuration: 1.2,
    impactRing: false,
    arcLift: 46,
  },
  pirate: {
    ...BASE_PRESET,
    effectType: "pirate",
    themeClass: "pirate",
    flashColor: "rgba(255, 114, 82, 0.84)",
    auraColors: ["#ffb567", "#ff5f47", "#ffe2c6"],
    shakeStrength: "medium",
    particleStyle: "slash",
    particleCount: 12,
    particleSpread: 160,
    travelScale: 1.24,
    arrivalScale: 1.06,
    rotation: -5,
    moveDuration: 0.4,
    resolveDelay: 0.48,
    totalDuration: 1.26,
    resultGlow: "ember",
    emblem: "slash",
    arcLift: 86,
  },
  mermaid: {
    ...BASE_PRESET,
    effectType: "mermaid",
    themeClass: "mermaid",
    flashColor: "rgba(109, 211, 255, 0.72)",
    auraColors: ["#b0f2ff", "#54b8ff", "#dffcff"],
    particleStyle: "water",
    particleCount: 14,
    particleSpread: 128,
    travelScale: 1.16,
    arrivalScale: 1.03,
    moveDuration: 0.5,
    resolveDelay: 0.56,
    totalDuration: 1.46,
    resultGlow: "sea",
    emblem: "wave",
    arcLift: 80,
  },
  escape: {
    ...BASE_PRESET,
    effectType: "escape",
    themeClass: "escape",
    flashColor: "rgba(210, 224, 255, 0.52)",
    auraColors: ["#f5f7ff", "#afc8ff", "#e7edff"],
    particleStyle: "smoke",
    particleCount: 12,
    particleSpread: 110,
    travelScale: 1.06,
    arrivalScale: 0.98,
    rotation: 6,
    moveDuration: 0.3,
    resolveDelay: 0.34,
    totalDuration: 0.96,
    resultGlow: "mist",
    impactRing: false,
    arcLift: 38,
  },
  tigress: {
    ...BASE_PRESET,
    effectType: "tigress",
    themeClass: "tigress",
    flashColor: "rgba(255, 196, 82, 0.9)",
    auraColors: ["#ffe8a6", "#ffb347", "#fff8e1"],
    dimBackground: true,
    shakeStrength: "medium",
    particleStyle: "slash",
    particleCount: 14,
    particleSpread: 174,
    travelScale: 1.24,
    arrivalScale: 1.07,
    rotation: -7,
    moveDuration: 0.44,
    resolveDelay: 0.54,
    totalDuration: 1.38,
    resultGlow: "shock",
    emblem: "slash",
    arcLift: 92,
  },
  kraken: {
    ...BASE_PRESET,
    effectType: "kraken",
    themeClass: "kraken",
    flashColor: "rgba(109, 235, 220, 0.86)",
    auraColors: ["#b4fff4", "#4bd7cb", "#e4fffb"],
    dimBackground: true,
    shakeStrength: "heavy",
    particleStyle: "water",
    particleCount: 18,
    particleSpread: 178,
    travelScale: 1.28,
    arrivalScale: 1.08,
    rotation: 4,
    moveDuration: 0.5,
    resolveDelay: 0.62,
    totalDuration: 1.58,
    resultGlow: "sea",
    emblem: "wave",
    arcLift: 96,
  },
  white_whale: {
    ...BASE_PRESET,
    effectType: "white_whale",
    themeClass: "white-whale",
    flashColor: "rgba(215, 245, 255, 0.92)",
    auraColors: ["#f0fbff", "#9fdfff", "#ffffff"],
    dimBackground: true,
    shakeStrength: "heavy",
    particleStyle: "mist",
    particleCount: 16,
    particleSpread: 182,
    travelScale: 1.26,
    arrivalScale: 1.08,
    rotation: -3,
    moveDuration: 0.52,
    resolveDelay: 0.64,
    totalDuration: 1.62,
    resultGlow: "sea",
    emblem: "wave",
    arcLift: 104,
  },
  skull_king: {
    ...BASE_PRESET,
    effectType: "skull_king",
    themeClass: "skull-king",
    flashColor: "rgba(255, 208, 92, 0.92)",
    auraColors: ["#ffd76a", "#9f61ff", "#fff1bf"],
    dimBackground: true,
    shakeStrength: "heavy",
    particleStyle: "royal",
    particleCount: 18,
    particleSpread: 184,
    travelScale: 1.3,
    arrivalScale: 1.08,
    rotation: -2,
    moveDuration: 0.54,
    resolveDelay: 0.68,
    totalDuration: 1.72,
    moveEase: [0.16, 0.96, 0.22, 1],
    resultGlow: "legendary",
    emblem: "crown",
    arcLift: 110,
  },
  special: {
    ...BASE_PRESET,
    effectType: "special",
    themeClass: "special",
    flashColor: "rgba(255, 231, 130, 0.9)",
    auraColors: ["#fff0a8", "#ff8b5e", "#ffffff"],
    dimBackground: true,
    shakeStrength: "heavy",
    particleStyle: "impact",
    particleCount: 16,
    particleSpread: 190,
    travelScale: 1.28,
    arrivalScale: 1.08,
    moveDuration: 0.48,
    resolveDelay: 0.58,
    totalDuration: 1.54,
    resultGlow: "shock",
  },
};

const CARD_EFFECT_EVENT_TYPES: Record<CardEffectType, CardEffectEventType> = {
  default: "card.play",
  suit: "card.play",
  pirate: "card.special.pirate",
  mermaid: "card.special.mermaid",
  escape: "card.special.escape",
  tigress: "card.special.tigress",
  kraken: "card.special.kraken",
  white_whale: "card.special.whiteWhale",
  skull_king: "card.special.skullKing",
  special: "card.special.generic",
};

const CARD_EFFECT_PRIORITIES: Record<CardEffectType, EffectPriority> = {
  default: "low",
  suit: "low",
  pirate: "normal",
  mermaid: "normal",
  escape: "low",
  tigress: "normal",
  kraken: "high",
  white_whale: "high",
  skull_king: "high",
  special: "high",
};

const CARD_EFFECT_CHANNELS: Record<CardEffectType, EffectChannel[]> = {
  default: ["card", "overlay"],
  suit: ["card", "overlay"],
  pirate: ["card", "particles", "overlay", "camera"],
  mermaid: ["card", "particles", "overlay"],
  escape: ["card", "particles", "overlay"],
  tigress: ["card", "particles", "overlay", "camera"],
  kraken: ["card", "particles", "overlay", "board", "camera"],
  white_whale: ["card", "particles", "overlay", "board", "camera"],
  skull_king: ["card", "particles", "overlay", "board", "camera"],
  special: ["card", "particles", "overlay", "board"],
};

function reduceShake(shakeStrength: ShakeStrength, qualityTier: EffectQualityTier): ShakeStrength {
  if (qualityTier === "ultra" || qualityTier === "high") {
    return shakeStrength;
  }
  if (qualityTier === "medium") {
    if (shakeStrength === "heavy") {
      return "medium";
    }
    return shakeStrength;
  }
  if (qualityTier === "low") {
    if (shakeStrength === "heavy") {
      return "medium";
    }
    if (shakeStrength === "medium") {
      return "light";
    }
    return shakeStrength;
  }
  if (shakeStrength === "none") {
    return "none";
  }
  return "light";
}

function scaleParticles(count: number, qualityTier: EffectQualityTier): number {
  if (qualityTier === "ultra" || qualityTier === "high") {
    return count;
  }
  if (qualityTier === "medium") {
    return Math.max(6, Math.round(count * 0.8));
  }
  if (qualityTier === "low") {
    return Math.max(4, Math.round(count * 0.6));
  }
  return Math.max(3, Math.round(count * 0.35));
}

export function resolveEffectQualityTier(preferredQualityTier?: EffectQualityTier | null): EffectQualityTier {
  if (preferredQualityTier) {
    return preferredQualityTier;
  }
  if (typeof window === "undefined") {
    return "high";
  }
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "lite";
  }
  if (window.innerWidth <= 420) {
    return "medium";
  }
  return "high";
}

export function inferEffectType(card: GameCardLike = {}): CardEffectType {
  const rawType = String(card.effectType || card.type || card.kind || "").trim().toLowerCase();
  const safeType = rawType.replace(/\s+/g, "_");

  if (!safeType) {
    return "default";
  }
  if (safeType.includes("skull")) {
    return "skull_king";
  }
  if (safeType.includes("pirate")) {
    return "pirate";
  }
  if (safeType.includes("mermaid")) {
    return "mermaid";
  }
  if (safeType.includes("escape") || safeType.includes("run")) {
    return "escape";
  }
  if (safeType.includes("tigress")) {
    return "tigress";
  }
  if (safeType.includes("kraken")) {
    return "kraken";
  }
  if (safeType.includes("whale")) {
    return "white_whale";
  }
  if (safeType.includes("special")) {
    return "special";
  }
  if (safeType.includes("suit") || safeType.includes("number")) {
    return "suit";
  }
  return safeType in CARD_EFFECT_PRESETS ? (safeType as CardEffectType) : "default";
}

function applyQualityTier(preset: CardEffectPreset, qualityTier: EffectQualityTier): CardEffectPreset {
  if (qualityTier === "ultra" || qualityTier === "high") {
    return preset;
  }

  const spreadMultiplier = qualityTier === "medium" ? 0.92 : qualityTier === "low" ? 0.84 : 0.72;
  const arcMultiplier = qualityTier === "medium" ? 0.94 : qualityTier === "low" ? 0.84 : 0.7;
  const dimBackground = qualityTier === "lite" ? false : preset.dimBackground;
  const impactRing = qualityTier === "lite" ? false : preset.impactRing;

  return {
    ...preset,
    particleCount: scaleParticles(preset.particleCount, qualityTier),
    particleSpread: Math.max(72, Math.round(preset.particleSpread * spreadMultiplier)),
    arcLift: Math.max(24, Math.round(preset.arcLift * arcMultiplier)),
    dimBackground,
    impactRing,
    shakeStrength: reduceShake(preset.shakeStrength, qualityTier),
  };
}

export function resolveCardEffectPreset(
  effectType?: CardEffectType | null,
  card: GameCardLike = {},
  qualityTier?: EffectQualityTier | null,
): CardEffectPreset {
  const resolvedType = effectType || inferEffectType(card);
  const tier = resolveEffectQualityTier(qualityTier);
  const preset = CARD_EFFECT_PRESETS[resolvedType] || CARD_EFFECT_PRESETS.default;
  return {
    ...applyQualityTier(preset, tier),
    effectType: resolvedType,
  };
}

export function resolveCardEffectDescriptor(
  effectType?: CardEffectType | null,
  card: GameCardLike = {},
  qualityTier?: EffectQualityTier | null,
): CardEffectDescriptor {
  const resolvedType = effectType || inferEffectType(card);
  const tier = resolveEffectQualityTier(qualityTier);
  return {
    effectType: resolvedType,
    eventType: CARD_EFFECT_EVENT_TYPES[resolvedType] || "card.play",
    priority: CARD_EFFECT_PRIORITIES[resolvedType] || "low",
    channels: [...(CARD_EFFECT_CHANNELS[resolvedType] || CARD_EFFECT_CHANNELS.default)],
    qualityTier: tier,
    preset: resolveCardEffectPreset(resolvedType, card, tier),
  };
}
