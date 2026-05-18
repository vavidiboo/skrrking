import type {
  BuildCardEffectEventOptions,
  BuildCardEffectPayloadOptions,
  CardEffectEvent,
  CardEffectEventType,
  CardEffectPayload,
  EffectBusMessage,
  EffectCancelMode,
  EffectChannel,
  EffectEvent,
  EffectPriority,
  NormalizedRect,
  SkullKingFXBridge,
} from "../types";
import { inferEffectType, resolveCardEffectDescriptor, resolveCardEffectPreset } from "./effectPresets";

export const EFFECT_BUS_EVENT = "skullking:effect";
export const CARD_EFFECT_EVENT = "skullking:card-effect";

const DEFAULT_BOARD_SELECTOR = "#gamePanel .table-wrap";
const DEFAULT_THROTTLE_WINDOW_MS: Record<EffectPriority, number> = {
  critical: 0,
  high: 0,
  normal: 150,
  low: 250,
};

const activeReplaceEntries = new Map<string, { eventId: string; expiresAt: number; priority: EffectPriority }>();
const recentDedupeEntries = new Map<string, number>();

function isCardEffectPayload(
  detail?: CardEffectPayload | BuildCardEffectPayloadOptions | null,
): detail is CardEffectPayload {
  return Boolean(detail && typeof detail === "object" && "preset" in detail && "id" in detail);
}

function isCardEffectEvent(detail?: EffectEvent | BuildCardEffectEventOptions | null): detail is CardEffectEvent {
  return Boolean(
    detail &&
      typeof detail === "object" &&
      "payload" in detail &&
      "type" in detail &&
      "channels" in detail &&
      "createdAt" in detail &&
      "cancel" in detail,
  );
}

function isEffectEvent(detail?: EffectEvent | BuildCardEffectEventOptions | null): detail is EffectEvent {
  return Boolean(
    detail &&
      typeof detail === "object" &&
      "payload" in detail &&
      "type" in detail &&
      "channels" in detail &&
      "createdAt" in detail &&
      "priority" in detail,
  );
}

function findElement(value?: Element | string | null): Element | null {
  if (!value) {
    return null;
  }
  if (typeof Element !== "undefined" && value instanceof Element) {
    return value;
  }
  if (typeof value === "string" && typeof document !== "undefined") {
    return document.querySelector(value);
  }
  return null;
}

function rectFromElement(element?: Element | null): NormalizedRect | null {
  if (!(element instanceof Element) || typeof element.getBoundingClientRect !== "function") {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function normalizeAspectRatio(rawAspectRatio?: number | null): number {
  const numeric = Number(rawAspectRatio);
  if (!Number.isFinite(numeric) || numeric < 0.45 || numeric > 0.85) {
    return 0.64;
  }
  return numeric;
}

function fitRectToAspect(rect: NormalizedRect | null, aspectRatio?: number | null): NormalizedRect | null {
  if (!rect) {
    return rect;
  }
  const safeAspectRatio = normalizeAspectRatio(aspectRatio);
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.5;
  const rectAspectRatio = rect.width / Math.max(1, rect.height);
  let width = rect.width;
  let height = rect.height;

  if (!Number.isFinite(rectAspectRatio) || rectAspectRatio > safeAspectRatio) {
    width = height * safeAspectRatio;
  } else {
    height = width / safeAspectRatio;
  }

  return {
    left: centerX - width * 0.5,
    top: centerY - height * 0.5,
    width,
    height,
  };
}

function centerRectFromBoard(boardRect: NormalizedRect | null, size = 0.22, aspectRatio = 0.64): NormalizedRect {
  if (!boardRect) {
    const width = 96;
    const height = width / normalizeAspectRatio(aspectRatio);
    return {
      left: window.innerWidth * 0.5 - width * 0.5,
      top: window.innerHeight * 0.48 - height * 0.5,
      width,
      height,
    };
  }

  const width = Math.max(88, boardRect.width * size);
  const height = width / normalizeAspectRatio(aspectRatio);
  return {
    left: boardRect.left + boardRect.width * 0.5 - width * 0.5,
    top: boardRect.top + boardRect.height * 0.52 - height * 0.5,
    width,
    height,
  };
}

function clampRectToBoard(
  rect: NormalizedRect | null,
  boardRect: NormalizedRect | null,
  padding = 22,
): NormalizedRect | null {
  if (!rect || !boardRect) {
    return rect;
  }

  const maxWidth = Math.max(72, boardRect.width - padding * 2);
  const maxHeight = Math.max(102, boardRect.height - padding * 2);
  const width = Math.min(rect.width, maxWidth);
  const height = Math.min(rect.height, maxHeight);
  const minLeft = boardRect.left + padding;
  const maxLeft = boardRect.left + boardRect.width - padding - width;
  const minTop = boardRect.top + padding;
  const maxTop = boardRect.top + boardRect.height - padding - height;

  return {
    left: Math.min(Math.max(rect.left, minLeft), Math.max(minLeft, maxLeft)),
    top: Math.min(Math.max(rect.top, minTop), Math.max(minTop, maxTop)),
    width,
    height,
  };
}

function cardLabel(card: BuildCardEffectPayloadOptions["card"] = {}): string {
  return String(card.label || card.name || card.title || card.type || "Card");
}

function sanitizeSourceClassName(className = ""): string {
  const blocked = new Set([
    "playable",
    "legal",
    "selected",
    "blocked",
    "illegal",
    "dragging",
    "drag-commit",
    "hs-dealing",
    "hs-playing",
  ]);

  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !blocked.has(token))
    .join(" ");
}

function buildEffectId(explicitId?: string): string {
  if (explicitId) {
    return explicitId;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `fx-${crypto.randomUUID()}`;
  }
  return `fx-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
}

function sanitizeCardEventType(type: string | null | undefined, fallbackType: CardEffectEventType): CardEffectEventType {
  const safeType = String(type || "").trim();
  if (
    safeType === "card.play" ||
    safeType === "card.special.generic" ||
    safeType === "card.special.pirate" ||
    safeType === "card.special.mermaid" ||
    safeType === "card.special.escape" ||
    safeType === "card.special.tigress" ||
    safeType === "card.special.kraken" ||
    safeType === "card.special.whiteWhale" ||
    safeType === "card.special.skullKing"
  ) {
    return safeType;
  }
  return fallbackType;
}

function dedupeChannels(channels: EffectChannel[]): EffectChannel[] {
  return Array.from(new Set(channels.filter(Boolean)));
}

function createReplaceKey(event: EffectEvent): string {
  const label = typeof event.payload === "object" && event.payload && "label" in event.payload ? event.payload.label : "effect";
  const cardId = String(event.card?.id || label || "card");
  const sourceKey = String(event.source?.playerId || event.source?.selector || "source");
  return [event.type, event.payload.result, cardId, sourceKey].join("|");
}

function createDedupeKey(event: EffectEvent): string {
  const label = typeof event.payload === "object" && event.payload && "label" in event.payload ? event.payload.label : "effect";
  const result = typeof event.payload === "object" && event.payload && "result" in event.payload ? event.payload.result : "pending";
  const cardId = String(event.card?.id || label || "card");
  const targetKey = String(event.target?.playerId || event.target?.selector || "target");
  return [event.type, result, cardId, targetKey].join("|");
}

function cleanupPolicyMaps(now = Date.now()): void {
  activeReplaceEntries.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      activeReplaceEntries.delete(key);
    }
  });
  recentDedupeEntries.forEach((expiresAt, key) => {
    if (expiresAt <= now) {
      recentDedupeEntries.delete(key);
    }
  });
}

function dispatchEffectBusMessage(message: EffectBusMessage): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<EffectBusMessage>(EFFECT_BUS_EVENT, { detail: message }));
  if (message.kind === "dispatch" && isCardEffectEvent(message.event)) {
    window.dispatchEvent(new CustomEvent<CardEffectPayload>(CARD_EFFECT_EVENT, { detail: message.event.payload }));
  }
}

function shouldDropAsDuplicate(event: EffectEvent): boolean {
  if (event.throttle.mode === "none" || event.throttle.windowMs <= 0) {
    return false;
  }
  const dedupeKey = event.throttle.dedupeKey || createDedupeKey(event);
  const now = event.createdAt;
  const existingUntil = recentDedupeEntries.get(dedupeKey) || 0;
  if (existingUntil > now) {
    return true;
  }
  recentDedupeEntries.set(dedupeKey, now + event.throttle.windowMs);
  return false;
}

function maybeReplaceActiveEvent(event: EffectEvent): void {
  if (event.cancel.mode !== "replace") {
    return;
  }
  const replaceKey = event.cancel.replaceKey || createReplaceKey(event);
  const existing = activeReplaceEntries.get(replaceKey);
  if (existing && existing.eventId !== event.id) {
    dispatchEffectBusMessage({
      kind: "cancel",
      id: existing.eventId,
      mode: "replace",
      reason: "Replaced by a newer effect event",
      createdAt: event.createdAt,
      replaceById: event.id,
    });
  }
  const durationMs =
    isCardEffectEvent(event)
      ? Math.max(120, Math.round(event.payload.preset.totalDuration * 1000))
      : 1200;
  activeReplaceEntries.set(replaceKey, {
    eventId: event.id,
    expiresAt: event.createdAt + durationMs,
    priority: event.priority,
  });
}

export function buildCardEffectPayload({
  id,
  card = {},
  effectType,
  sourceElement,
  sourceSelector,
  sourceRect,
  targetElement,
  targetSelector,
  targetRect,
  highlightElement,
  highlightSelector,
  highlightRect,
  boardSelector = DEFAULT_BOARD_SELECTOR,
  boardElement,
  boardRect,
  result = "pending",
}: BuildCardEffectPayloadOptions = {}): CardEffectPayload {
  const resolvedType = effectType || inferEffectType(card);
  const resolvedPreset = resolveCardEffectPreset(resolvedType, card);
  const boardNode = findElement(boardElement) || findElement(boardSelector);
  const sourceNode = findElement(sourceElement) || findElement(sourceSelector);
  const targetNode = findElement(targetElement) || findElement(targetSelector);
  const highlightNode = findElement(highlightElement) || findElement(highlightSelector);
  const safeBoardRect = boardRect || rectFromElement(boardNode);
  const rawSourceRect = sourceRect || rectFromElement(sourceNode) || centerRectFromBoard(safeBoardRect, 0.18);
  const cardAspectRatio = normalizeAspectRatio(rawSourceRect?.width / Math.max(1, rawSourceRect?.height || 1));
  const safeSourceRect = fitRectToAspect(rawSourceRect, cardAspectRatio) || centerRectFromBoard(safeBoardRect, 0.18);
  const targetNodeRect = targetRect || rectFromElement(targetNode);
  const rawTargetRect =
    safeBoardRect && targetNodeRect && targetNodeRect.width > safeBoardRect.width * 0.38
      ? centerRectFromBoard(safeBoardRect, 0.22, cardAspectRatio)
      : targetNodeRect || centerRectFromBoard(safeBoardRect, 0.22, cardAspectRatio);
  const safeTargetRect =
    fitRectToAspect(clampRectToBoard(rawTargetRect, safeBoardRect, 26), cardAspectRatio) ||
    centerRectFromBoard(safeBoardRect, 0.22, cardAspectRatio);
  const rawHighlightRect = highlightRect || rectFromElement(highlightNode) || safeTargetRect;
  const safeHighlightRect =
    fitRectToAspect(clampRectToBoard(rawHighlightRect, safeBoardRect, 20), cardAspectRatio) || safeTargetRect;

  return {
    id: buildEffectId(id),
    card,
    label: cardLabel(card),
    effectType: resolvedType,
    preset: resolvedPreset,
    sourceRect: safeSourceRect,
    targetRect: safeTargetRect,
    highlightRect: safeHighlightRect,
    cardAspectRatio,
    sourceMarkup: sourceNode?.outerHTML || "",
    sourceInnerHtml: sourceNode instanceof Element ? sourceNode.innerHTML : "",
    sourceClassName: sanitizeSourceClassName(sourceNode instanceof Element ? sourceNode.className : ""),
    result,
    boardSelector,
    highlightSelector: typeof highlightSelector === "string" ? highlightSelector : null,
  };
}

export function buildCardEffectEvent(detail: BuildCardEffectEventOptions = {}): CardEffectEvent {
  const fallbackType = inferEffectType(detail.card);
  const descriptor = resolveCardEffectDescriptor(detail.effectType || fallbackType, detail.card, detail.qualityTier);
  const eventId = buildEffectId(detail.id);
  const payload = buildCardEffectPayload({
    ...detail,
    id: eventId,
    effectType: descriptor.effectType,
  });
  const createdAt = Number.isFinite(Number(detail.createdAt)) ? Number(detail.createdAt) : Date.now();
  const sourceSelector = typeof detail.sourceSelector === "string" ? detail.sourceSelector : null;
  const targetSelector = typeof detail.targetSelector === "string" ? detail.targetSelector : null;
  const sourceElement = findElement(detail.sourceElement) || findElement(sourceSelector);
  const targetElement = findElement(detail.targetElement) || findElement(targetSelector);
  const type = sanitizeCardEventType(detail.type, descriptor.eventType);
  const unknownTypeRequested =
    Boolean(detail.type) && type !== String(detail.type).trim() && String(detail.type).trim().length > 0;

  return {
    id: eventId,
    type,
    effectType: descriptor.effectType,
    priority: detail.priority || descriptor.priority,
    channels: dedupeChannels(detail.channels || descriptor.channels),
    qualityTier: descriptor.qualityTier,
    createdAt,
    card: detail.card || {},
    source: {
      playerId: detail.sourcePlayerId || null,
      playerName: detail.sourcePlayerName || null,
      element: sourceElement,
      selector: sourceSelector,
      rect: detail.sourceRect || rectFromElement(sourceElement) || payload.sourceRect,
    },
    target: {
      playerId: detail.targetPlayerId || null,
      playerName: detail.targetPlayerName || null,
      element: targetElement,
      selector: targetSelector,
      rect: detail.targetRect || rectFromElement(targetElement) || payload.targetRect,
    },
    payload: {
      ...payload,
      id: eventId,
      preset: descriptor.preset,
    },
    cancel: {
      mode: detail.cancel?.mode || "replace",
      replaceKey: detail.cancel?.replaceKey || null,
    },
    throttle: {
      mode: detail.throttle?.mode || "dedupe",
      dedupeKey: detail.throttle?.dedupeKey || null,
      windowMs:
        typeof detail.throttle?.windowMs === "number"
          ? Math.max(0, detail.throttle.windowMs)
          : DEFAULT_THROTTLE_WINDOW_MS[detail.priority || descriptor.priority],
    },
    fallback: {
      mode: detail.fallback?.mode || (descriptor.qualityTier === "lite" ? "lite" : "render"),
      reason: detail.fallback?.reason || (unknownTypeRequested ? "unknown_effect_event_type" : null),
    },
  };
}

function sanitizePriority(priority: EffectPriority | undefined): EffectPriority {
  if (priority === "critical" || priority === "high" || priority === "normal" || priority === "low") {
    return priority;
  }
  return "normal";
}

function sanitizeCancelMode(mode: EffectCancelMode | undefined): EffectCancelMode {
  if (mode === "none" || mode === "soft" || mode === "hard" || mode === "replace") {
    return mode;
  }
  return "none";
}

function normalizeGenericEvent(detail: EffectEvent): EffectEvent {
  if (isCardEffectEvent(detail)) {
    return buildCardEffectEvent(detail);
  }

  return {
    ...detail,
    id: buildEffectId(detail.id),
    effectType: detail.effectType || "default",
    priority: sanitizePriority(detail.priority),
    channels: dedupeChannels(detail.channels || []),
    qualityTier: detail.qualityTier || "high",
    createdAt: Number.isFinite(Number(detail.createdAt)) ? Number(detail.createdAt) : Date.now(),
    payload: detail.payload && typeof detail.payload === "object" ? detail.payload : {},
    cancel: {
      mode: sanitizeCancelMode(detail.cancel?.mode),
      replaceKey: detail.cancel?.replaceKey || null,
    },
    throttle: {
      mode: detail.throttle?.mode || "none",
      dedupeKey: detail.throttle?.dedupeKey || null,
      windowMs: typeof detail.throttle?.windowMs === "number" ? Math.max(0, detail.throttle.windowMs) : 0,
    },
    fallback: {
      mode: detail.fallback?.mode || "render",
      reason: detail.fallback?.reason || null,
    },
  };
}

function normalizeIncomingEvent(detail?: EffectEvent | BuildCardEffectEventOptions | null): EffectEvent | null {
  if (!detail) {
    return buildCardEffectEvent({
      fallback: {
        mode: "lite",
        reason: "missing_effect_event",
      },
    });
  }
  if (isCardEffectEvent(detail)) {
    return buildCardEffectEvent({
      id: detail.id,
      type: detail.type,
      card: detail.card,
      effectType: detail.effectType,
      sourceElement: detail.source?.element || null,
      sourceSelector: detail.source?.selector || null,
      sourceRect: detail.source?.rect || detail.payload.sourceRect,
      targetElement: detail.target?.element || null,
      targetSelector: detail.target?.selector || null,
      targetRect: detail.target?.rect || detail.payload.targetRect,
      highlightSelector: detail.payload.highlightSelector,
      highlightRect: detail.payload.highlightRect,
      boardSelector: detail.payload.boardSelector,
      result: detail.payload.result,
      priority: detail.priority,
      channels: detail.channels,
      qualityTier: detail.qualityTier,
      createdAt: detail.createdAt,
      sourcePlayerId: detail.source?.playerId || null,
      sourcePlayerName: detail.source?.playerName || null,
      targetPlayerId: detail.target?.playerId || null,
      targetPlayerName: detail.target?.playerName || null,
      cancel: detail.cancel,
      throttle: detail.throttle,
      fallback: detail.fallback,
    });
  }
  if (isEffectEvent(detail)) {
    return normalizeGenericEvent(detail);
  }
  return buildCardEffectEvent({
    ...detail,
    fallback: {
      mode: detail.fallback?.mode || "lite",
      reason: detail.fallback?.reason || "malformed_effect_event",
    },
  });
}

export function emitEffectEvent(detail?: EffectEvent | BuildCardEffectEventOptions | null): EffectEvent | null {
  if (typeof window === "undefined") {
    return null;
  }

  cleanupPolicyMaps();
  const event = normalizeIncomingEvent(detail);
  if (!event) {
    return null;
  }
  if (event.fallback.mode === "skip") {
    return null;
  }
  if (shouldDropAsDuplicate(event)) {
    return null;
  }
  maybeReplaceActiveEvent(event);
  dispatchEffectBusMessage({
    kind: "dispatch",
    event,
  });
  return event;
}

export function emitCardEffectEvent(detail?: CardEffectEvent | BuildCardEffectEventOptions | null): CardEffectEvent | null {
  const event = emitEffectEvent(detail);
  return event && isCardEffectEvent(event) ? event : null;
}

export function emitCardEffect(detail?: CardEffectEvent | BuildCardEffectEventOptions | null): CardEffectPayload | null {
  return emitCardEffectEvent(detail)?.payload || null;
}

export function onEffectBusMessage(listener: (message: EffectBusMessage) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event: Event): void => {
    const customEvent = event as CustomEvent<EffectBusMessage>;
    listener(customEvent.detail);
  };
  window.addEventListener(EFFECT_BUS_EVENT, handler);
  return () => window.removeEventListener(EFFECT_BUS_EVENT, handler);
}

export function onCardEffect(listener: (event: CardEffectEvent) => void): () => void {
  return onEffectBusMessage((message) => {
    if (message.kind === "dispatch" && isCardEffectEvent(message.event)) {
      listener(message.event);
    }
  });
}

export function installCardEffectBridge(): SkullKingFXBridge | null {
  if (typeof window === "undefined") {
    return null;
  }
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (window.SkullKingFX) {
    if (root) {
      root.dataset.skullkingFxBridge = "ready";
    }
    return window.SkullKingFX;
  }

  window.SkullKingFX = {
    emit: emitCardEffect,
    emitEvent: emitEffectEvent,
    playCardEffect: emitCardEffect,
    playCardEvent: emitCardEffectEvent,
    buildCardEffectPayload,
    buildCardEffectEvent,
    inferEffectType,
    resolveCardEffectPreset,
    resolveCardEffectDescriptor,
  };
  if (root) {
    root.dataset.skullkingFxBridge = "ready";
  }
  return window.SkullKingFX;
}
