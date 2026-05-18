import type {
  BuildCardEffectPayloadOptions,
  CardEffectPayload,
  NormalizedRect,
  SkullKingFXBridge,
} from "../types";
import { inferEffectType, resolveCardEffectPreset } from "./effectPresets";

export const CARD_EFFECT_EVENT = "skullking:card-effect";

function isCardEffectPayload(
  detail?: CardEffectPayload | BuildCardEffectPayloadOptions | null,
): detail is CardEffectPayload {
  return Boolean(detail && "preset" in detail && "id" in detail);
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

export function buildCardEffectPayload({
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
  boardSelector = "#gamePanel .table-wrap",
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
  const safeHighlightRect = fitRectToAspect(clampRectToBoard(rawHighlightRect, safeBoardRect, 20), cardAspectRatio) || safeTargetRect;

  return {
    id: `fx-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
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

export function emitCardEffect(detail?: CardEffectPayload | BuildCardEffectPayloadOptions | null): CardEffectPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  const payload = isCardEffectPayload(detail) ? detail : buildCardEffectPayload(detail || {});
  window.dispatchEvent(new CustomEvent<CardEffectPayload>(CARD_EFFECT_EVENT, { detail: payload }));
  return payload;
}

export function onCardEffect(listener: (detail: CardEffectPayload) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event: Event): void => {
    const customEvent = event as CustomEvent<CardEffectPayload>;
    listener(customEvent.detail);
  };
  window.addEventListener(CARD_EFFECT_EVENT, handler);
  return () => window.removeEventListener(CARD_EFFECT_EVENT, handler);
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
    playCardEffect: emitCardEffect,
    buildCardEffectPayload,
    inferEffectType,
    resolveCardEffectPreset,
  };
  if (root) {
    root.dataset.skullkingFxBridge = "ready";
  }
  return window.SkullKingFX;
}
