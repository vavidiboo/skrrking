import type { GameCardLike } from "./domain";

export type EffectPriority = "critical" | "high" | "normal" | "low";
export type EffectQualityTier = "ultra" | "high" | "medium" | "low" | "lite";
export type EffectChannel = "board" | "camera" | "card" | "particles" | "overlay" | "score" | "audio";
export type EffectEventType =
  | "card.play"
  | "card.special.skullKing"
  | "card.special.mermaid"
  | "trick.resolve"
  | "round.scoreDelta"
  | "match.finish"
  | "ui.turnUrgent"
  | "camera.shake";

export type CardEffectType =
  | "default"
  | "suit"
  | "pirate"
  | "mermaid"
  | "escape"
  | "tigress"
  | "kraken"
  | "white_whale"
  | "skull_king"
  | "special";

export type ShakeStrength = "none" | "light" | "medium" | "heavy";
export type ParticleStyle = "spark" | "slash" | "water" | "smoke" | "royal" | "impact" | "mist";
export type ResultGlow = "gold" | "ember" | "sea" | "mist" | "legendary" | "shock";
export type EffectEmblemType = "none" | "crown" | "wave" | "slash";

export interface CardEffectPreset {
  themeClass: string;
  flashColor: string;
  auraColors: [string, string, string];
  dimBackground: boolean;
  shakeStrength: ShakeStrength;
  particleStyle: ParticleStyle;
  particleCount: number;
  particleSpread: number;
  travelScale: number;
  arrivalScale: number;
  rotation: number;
  moveDuration: number;
  resolveDelay: number;
  totalDuration: number;
  moveEase: [number, number, number, number];
  impactRing: boolean;
  resultGlow: ResultGlow;
  emblem: EffectEmblemType;
  arcLift: number;
  effectType?: CardEffectType;
}

export interface NormalizedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BuildCardEffectPayloadOptions {
  card?: GameCardLike;
  effectType?: CardEffectType;
  sourceElement?: Element | null;
  sourceSelector?: string | null;
  sourceRect?: NormalizedRect | null;
  targetElement?: Element | null;
  targetSelector?: string | null;
  targetRect?: NormalizedRect | null;
  highlightElement?: Element | null;
  highlightSelector?: string | null;
  highlightRect?: NormalizedRect | null;
  boardSelector?: string;
  boardElement?: Element | null;
  boardRect?: NormalizedRect | null;
  result?: "pending" | "win" | "lose";
}

export interface CardEffectPayload {
  id: string;
  card: GameCardLike;
  label: string;
  effectType: CardEffectType;
  preset: CardEffectPreset;
  sourceRect: NormalizedRect;
  targetRect: NormalizedRect;
  highlightRect: NormalizedRect;
  cardAspectRatio: number;
  sourceMarkup: string;
  sourceInnerHtml: string;
  sourceClassName: string;
  result: "pending" | "win" | "lose";
  boardSelector: string;
  highlightSelector: string | null;
}

export interface EffectEvent {
  id: string;
  type: EffectEventType;
  priority: EffectPriority;
  channels: EffectChannel[];
  qualityTier?: EffectQualityTier;
  card?: GameCardLike;
  sourcePlayerId?: string;
  targetPlayerId?: string;
  payload?: Record<string, unknown>;
  createdAt: number;
}

export interface SkullKingFXBridge {
  emit: (detail: CardEffectPayload | BuildCardEffectPayloadOptions) => CardEffectPayload | null;
  playCardEffect: (detail: CardEffectPayload | BuildCardEffectPayloadOptions) => CardEffectPayload | null;
  buildCardEffectPayload: (detail?: BuildCardEffectPayloadOptions) => CardEffectPayload;
  inferEffectType: (card?: GameCardLike) => CardEffectType;
  resolveCardEffectPreset: (effectType?: CardEffectType, card?: GameCardLike) => CardEffectPreset;
}
