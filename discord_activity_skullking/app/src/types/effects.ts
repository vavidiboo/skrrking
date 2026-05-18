import type { GameCardLike } from "./domain";

export type EffectPriority = "critical" | "high" | "normal" | "low";
export type EffectQualityTier = "ultra" | "high" | "medium" | "low" | "lite";
export type EffectChannel = "board" | "camera" | "card" | "particles" | "overlay" | "score" | "audio";

export type CardEffectEventType =
  | "card.play"
  | "card.special.generic"
  | "card.special.pirate"
  | "card.special.mermaid"
  | "card.special.escape"
  | "card.special.tigress"
  | "card.special.kraken"
  | "card.special.whiteWhale"
  | "card.special.skullKing";

export type EffectEventType =
  | CardEffectEventType
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

export type EffectCancelMode = "none" | "soft" | "hard" | "replace";
export type EffectThrottleMode = "none" | "dedupe" | "throttle";
export type EffectFallbackMode = "render" | "lite" | "skip";

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

export interface EffectEndpoint {
  playerId?: string | null;
  playerName?: string | null;
  element?: Element | null;
  selector?: string | null;
  rect?: NormalizedRect | null;
}

export interface EffectCancelPolicy {
  mode: EffectCancelMode;
  replaceKey?: string | null;
}

export interface EffectThrottlePolicy {
  mode: EffectThrottleMode;
  dedupeKey?: string | null;
  windowMs: number;
}

export interface EffectFallbackPolicy {
  mode: EffectFallbackMode;
  reason?: string | null;
}

export interface BuildCardEffectPayloadOptions {
  id?: string;
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

export interface BuildCardEffectEventOptions extends BuildCardEffectPayloadOptions {
  type?: CardEffectEventType | string | null;
  priority?: EffectPriority;
  channels?: EffectChannel[];
  qualityTier?: EffectQualityTier;
  createdAt?: number;
  sourcePlayerId?: string | null;
  sourcePlayerName?: string | null;
  targetPlayerId?: string | null;
  targetPlayerName?: string | null;
  cancel?: Partial<EffectCancelPolicy> | null;
  throttle?: Partial<EffectThrottlePolicy> | null;
  fallback?: Partial<EffectFallbackPolicy> | null;
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

export interface EffectEventBase<TType extends EffectEventType = EffectEventType, TPayload = Record<string, unknown>> {
  id: string;
  type: TType;
  effectType: CardEffectType;
  priority: EffectPriority;
  channels: EffectChannel[];
  qualityTier: EffectQualityTier;
  source?: EffectEndpoint;
  target?: EffectEndpoint;
  card?: GameCardLike;
  payload: TPayload;
  createdAt: number;
  cancel: EffectCancelPolicy;
  throttle: EffectThrottlePolicy;
  fallback: EffectFallbackPolicy;
}

export interface CardEffectEvent extends EffectEventBase<CardEffectEventType, CardEffectPayload> {
  card: GameCardLike;
  payload: CardEffectPayload;
}

export interface GenericEffectEvent extends EffectEventBase<Exclude<EffectEventType, CardEffectEventType>> {
  payload: Record<string, unknown>;
}

export type EffectEvent = CardEffectEvent | GenericEffectEvent;

export interface EffectBusDispatch {
  kind: "dispatch";
  event: EffectEvent;
}

export interface EffectBusCancel {
  kind: "cancel";
  id: string;
  mode: EffectCancelMode;
  reason: string;
  createdAt: number;
  replaceById?: string | null;
}

export type EffectBusMessage = EffectBusDispatch | EffectBusCancel;

export interface CardEffectDescriptor {
  effectType: CardEffectType;
  eventType: CardEffectEventType;
  priority: EffectPriority;
  channels: EffectChannel[];
  qualityTier: EffectQualityTier;
  preset: CardEffectPreset;
}

export interface SkullKingFXBridge {
  emit: (detail?: CardEffectEvent | BuildCardEffectEventOptions | null) => CardEffectPayload | null;
  emitEvent: (detail?: EffectEvent | BuildCardEffectEventOptions | null) => EffectEvent | null;
  playCardEffect: (detail?: CardEffectEvent | BuildCardEffectEventOptions | null) => CardEffectPayload | null;
  playCardEvent: (detail?: CardEffectEvent | BuildCardEffectEventOptions | null) => CardEffectEvent | null;
  buildCardEffectPayload: (detail?: BuildCardEffectPayloadOptions) => CardEffectPayload;
  buildCardEffectEvent: (detail?: BuildCardEffectEventOptions) => CardEffectEvent;
  inferEffectType: (card?: GameCardLike) => CardEffectType;
  resolveCardEffectPreset: (effectType?: CardEffectType, card?: GameCardLike, qualityTier?: EffectQualityTier) => CardEffectPreset;
  resolveCardEffectDescriptor: (effectType?: CardEffectType, card?: GameCardLike, qualityTier?: EffectQualityTier) => CardEffectDescriptor;
}
