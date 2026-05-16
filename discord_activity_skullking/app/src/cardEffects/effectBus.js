import { inferEffectType, resolveCardEffectPreset } from "./effectPresets.js";

export const CARD_EFFECT_EVENT = "skullking:card-effect";

function findElement(value) {
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

function rectFromElement(element) {
  if (!element?.getBoundingClientRect) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (!rect?.width || !rect?.height) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function centerRectFromBoard(boardRect, size = 0.22) {
  if (!boardRect) {
    const width = 96;
    const height = 136;
    return {
      left: (window.innerWidth * 0.5) - (width * 0.5),
      top: (window.innerHeight * 0.48) - (height * 0.5),
      width,
      height,
    };
  }
  const width = Math.max(88, boardRect.width * size);
  const height = width * 1.42;
  return {
    left: boardRect.left + (boardRect.width * 0.5) - (width * 0.5),
    top: boardRect.top + (boardRect.height * 0.52) - (height * 0.5),
    width,
    height,
  };
}

function clampRectToBoard(rect, boardRect, padding = 22) {
  if (!rect || !boardRect) {
    return rect;
  }

  const maxWidth = Math.max(72, boardRect.width - (padding * 2));
  const maxHeight = Math.max(102, boardRect.height - (padding * 2));
  const width = Math.min(rect.width, maxWidth);
  const height = Math.min(rect.height, maxHeight);
  const minLeft = boardRect.left + padding;
  const maxLeft = (boardRect.left + boardRect.width) - padding - width;
  const minTop = boardRect.top + padding;
  const maxTop = (boardRect.top + boardRect.height) - padding - height;

  return {
    left: Math.min(Math.max(rect.left, minLeft), Math.max(minLeft, maxLeft)),
    top: Math.min(Math.max(rect.top, minTop), Math.max(minTop, maxTop)),
    width,
    height,
  };
}

function cardLabel(card = {}) {
  return String(card.label || card.name || card.title || card.type || "Card");
}

function sanitizeSourceClassName(className = "") {
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
} = {}) {
  const resolvedType = effectType || inferEffectType(card);
  const resolvedPreset = resolveCardEffectPreset(resolvedType, card);
  const boardNode = findElement(boardElement) || findElement(boardSelector);
  const sourceNode = findElement(sourceElement) || findElement(sourceSelector);
  const targetNode = findElement(targetElement) || findElement(targetSelector);
  const highlightNode = findElement(highlightElement) || findElement(highlightSelector);
  const safeBoardRect = boardRect || rectFromElement(boardNode);
  const safeSourceRect = sourceRect || rectFromElement(sourceNode) || centerRectFromBoard(safeBoardRect, 0.18);
  const targetNodeRect = targetRect || rectFromElement(targetNode);
  const rawTargetRect =
    safeBoardRect && targetNodeRect && targetNodeRect.width > (safeBoardRect.width * 0.38)
      ? centerRectFromBoard(safeBoardRect)
      : (targetNodeRect || centerRectFromBoard(safeBoardRect));
  const safeTargetRect = clampRectToBoard(rawTargetRect, safeBoardRect, 26);
  const rawHighlightRect = highlightRect || rectFromElement(highlightNode) || safeTargetRect;
  const safeHighlightRect = clampRectToBoard(rawHighlightRect, safeBoardRect, 20);

  return {
    id: `fx-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
    card,
    label: cardLabel(card),
    effectType: resolvedType,
    preset: resolvedPreset,
    sourceRect: safeSourceRect,
    targetRect: safeTargetRect,
    highlightRect: safeHighlightRect,
    sourceMarkup: sourceNode?.outerHTML || "",
    sourceInnerHtml: sourceNode?.innerHTML || "",
    sourceClassName: sanitizeSourceClassName(sourceNode?.className || ""),
    result,
    boardSelector,
    highlightSelector: typeof highlightSelector === "string" ? highlightSelector : null,
  };
}

export function emitCardEffect(detail) {
  if (typeof window === "undefined") {
    return null;
  }
  const payload = detail?.preset ? detail : buildCardEffectPayload(detail);
  window.dispatchEvent(new CustomEvent(CARD_EFFECT_EVENT, { detail: payload }));
  return payload;
}

export function onCardEffect(listener) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event) => {
    listener(event.detail);
  };
  window.addEventListener(CARD_EFFECT_EVENT, handler);
  return () => window.removeEventListener(CARD_EFFECT_EVENT, handler);
}

export function installCardEffectBridge() {
  if (typeof window === "undefined") {
    return null;
  }
  if (window.SkullKingFX) {
    return window.SkullKingFX;
  }

  window.SkullKingFX = {
    emit: emitCardEffect,
    playCardEffect: emitCardEffect,
    buildCardEffectPayload,
    inferEffectType,
    resolveCardEffectPreset,
  };
  return window.SkullKingFX;
}
