import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CardEffectEvent, CardEffectPayload, CardEffectPreset, EffectBusCancel, ResultGlow } from "../types";
import { installCardEffectBridge, onEffectBusMessage } from "./effectBus";

interface CardEffectLayerProps {
  boardSelector?: string;
}

interface EffectParticle {
  id: string;
  x: number;
  y: number;
  delay: number;
  scale: number;
}

interface CastPath {
  x: number[];
  y: number[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildParticles(effect: CardEffectPayload): EffectParticle[] {
  const count = effect.preset.particleCount;
  const spread = effect.preset.particleSpread;
  return Array.from({ length: count }, (_, index) => {
    const progress = count <= 1 ? 0.5 : index / (count - 1);
    const angle = (-78 + progress * 156) * (Math.PI / 180);
    const distance = spread * (0.72 + (index % 4) * 0.12);
    return {
      id: `${effect.id}-p-${index}`,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: index * 0.018,
      scale: 0.72 + (index % 5) * 0.08,
    };
  });
}

function classNames(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(" ");
}

function resolveLiveHighlightClass(glow: ResultGlow): string {
  return classNames("card-fx-live-highlight", glow && `is-${glow}`);
}

function CardFallback({ effect }: { effect: CardEffectPayload }) {
  return (
    <div className={classNames("card-fx-fallback", `type-${effect.effectType}`)}>
      <span className="card-fx-fallback-kicker">{effect.effectType.replace(/_/g, " ")}</span>
      <strong>{effect.label}</strong>
    </div>
  );
}

function CardClone({ effect }: { effect: CardEffectPayload }) {
  if (effect.sourceInnerHtml) {
    return (
      <div className="card-fx-clone">
        <div
          className={classNames("card-fx-origin-card", effect.sourceClassName || `type-${effect.effectType}`)}
          dangerouslySetInnerHTML={{ __html: effect.sourceInnerHtml }}
        />
      </div>
    );
  }
  return <CardFallback effect={effect} />;
}

function CrownEmblem() {
  return (
    <svg viewBox="0 0 120 80" className="card-fx-emblem card-fx-emblem-crown" aria-hidden="true">
      <path d="M12 60 26 24l20 16 14-24 14 24 20-16 14 36Z" />
      <path d="M18 62h84" />
      <circle cx="26" cy="24" r="4" />
      <circle cx="60" cy="16" r="4" />
      <circle cx="94" cy="24" r="4" />
    </svg>
  );
}

function WaveEmblem() {
  return (
    <svg viewBox="0 0 180 56" className="card-fx-emblem card-fx-emblem-wave" aria-hidden="true">
      <path d="M6 32c18 0 18-16 36-16s18 16 36 16 18-16 36-16 18 16 36 16 18-16 36-16" />
      <path d="M6 42c18 0 18-12 36-12s18 12 36 12 18-12 36-12 18 12 36 12 18-12 36-12" />
    </svg>
  );
}

function SlashEmblem() {
  return (
    <div className="card-fx-emblem card-fx-emblem-slash" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

function EffectEmblem({ preset }: { preset: CardEffectPreset }) {
  if (preset.emblem === "crown") {
    return <CrownEmblem />;
  }
  if (preset.emblem === "wave") {
    return <WaveEmblem />;
  }
  if (preset.emblem === "slash") {
    return <SlashEmblem />;
  }
  return null;
}

function isCardEffectEventMessage(value: unknown): value is CardEffectEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "payload" in value &&
      "type" in value &&
      "channels" in value &&
      "createdAt" in value,
  );
}

export function CardEffectLayer({ boardSelector = "#gamePanel .table-wrap" }: CardEffectLayerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [queue, setQueue] = useState<CardEffectEvent[]>([]);
  const [activeEffect, setActiveEffect] = useState<CardEffectEvent | null>(null);
  const [phase, setPhase] = useState<"idle" | "cast" | "resolve">("idle");
  const [cancelMode, setCancelMode] = useState<EffectBusCancel["mode"] | null>(null);
  const activeEffectRef = useRef<CardEffectEvent | null>(null);

  useEffect(() => {
    activeEffectRef.current = activeEffect;
  }, [activeEffect]);

  useEffect(() => {
    installCardEffectBridge();
    return onEffectBusMessage((message) => {
      if (message.kind === "dispatch" && isCardEffectEventMessage(message.event)) {
        const nextEvent: CardEffectEvent = message.event;
        setQueue((current) => [...current, nextEvent]);
        return;
      }
      if (message.kind !== "cancel") {
        return;
      }
      setQueue((current) => current.filter((entry) => entry.id !== message.id));
      if (activeEffectRef.current?.id !== message.id) {
        return;
      }
      if (message.mode === "soft") {
        setCancelMode("soft");
        setPhase("resolve");
        return;
      }
      setCancelMode(message.mode);
      setActiveEffect(null);
      setPhase("idle");
    });
  }, []);

  useEffect(() => {
    if (activeEffect || queue.length === 0) {
      return;
    }
    setCancelMode(null);
    setActiveEffect(queue[0]);
    setQueue((current) => current.slice(1));
  }, [activeEffect, queue]);

  useEffect(() => {
    if (!activeEffect) {
      setPhase("idle");
      setCancelMode(null);
      return;
    }

    const effect = activeEffect.payload;
    const boardNode = document.querySelector(effect.boardSelector || boardSelector);
    const highlightNode = effect.highlightSelector ? document.querySelector(effect.highlightSelector) : null;
    const highlightClass = resolveLiveHighlightClass(effect.preset.resultGlow);
    const isSoftCancelled = cancelMode === "soft";

    setPhase(isSoftCancelled ? "resolve" : "cast");
    if (boardNode && effect.preset.shakeStrength !== "none") {
      boardNode.classList.add("card-fx-board-shake", `card-fx-board-shake--${effect.preset.shakeStrength}`);
    }
    if (highlightNode && effect.result === "win") {
      highlightNode.classList.add(highlightClass);
    }

    const resolveDelayMs = isSoftCancelled ? 0 : Math.round((reduceMotion ? 0.22 : effect.preset.resolveDelay) * 1000);
    const totalDurationMs = isSoftCancelled ? 180 : Math.round((reduceMotion ? 0.56 : effect.preset.totalDuration) * 1000);
    const resolveTimer = window.setTimeout(() => setPhase("resolve"), resolveDelayMs);
    const cleanupTimer = window.setTimeout(() => {
      setActiveEffect(null);
      setCancelMode(null);
      setPhase("idle");
    }, totalDurationMs);

    return () => {
      window.clearTimeout(resolveTimer);
      window.clearTimeout(cleanupTimer);
      if (boardNode) {
        boardNode.classList.remove("card-fx-board-shake", "card-fx-board-shake--light", "card-fx-board-shake--medium", "card-fx-board-shake--heavy");
      }
      if (highlightNode) {
        highlightNode.classList.remove("card-fx-live-highlight", "is-gold", "is-ember", "is-sea", "is-mist", "is-legendary", "is-shock");
      }
    };
  }, [activeEffect, boardSelector, cancelMode, reduceMotion]);

  const activePayload = activeEffect?.payload ?? null;
  const particles = useMemo<EffectParticle[]>(() => (activePayload ? buildParticles(activePayload) : []), [activePayload]);
  const castPath = useMemo<CastPath | null>(() => {
    if (!activePayload) {
      return null;
    }
    const sourceRect = activePayload.sourceRect;
    const targetRect = activePayload.targetRect;
    const midX = sourceRect.left + (targetRect.left - sourceRect.left) * 0.5;
    const arcLift = Math.max(18, Number(activePayload.preset.arcLift || 0));
    const midY = Math.min(sourceRect.top, targetRect.top) - arcLift;
    return {
      x: [sourceRect.left, midX, targetRect.left],
      y: [sourceRect.top, midY, targetRect.top],
    };
  }, [activePayload]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {activePayload ? (
        <div
          className={classNames(
            "card-fx-stage",
            `theme-${activePayload.preset.themeClass}`,
            activePayload.preset.dimBackground && "is-dimmed",
            phase === "resolve" && "is-resolving",
          )}
          aria-hidden="true"
        >
          <motion.div
            className="card-fx-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: activePayload.preset.dimBackground ? 0.76 : 0.22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24 }}
          />
          <motion.div
            className="card-fx-flash"
            style={{ "--card-fx-flash": activePayload.preset.flashColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.96, 0.08, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.42, times: [0, 0.14, 0.42, 1] }}
          />
          <div className="card-fx-vignette" />
          <motion.div
            className={classNames("card-fx-card", `is-${activePayload.preset.themeClass}`)}
            style={{ "--card-fx-aspect": activePayload.cardAspectRatio }}
            initial={{
              x: activePayload.sourceRect.left,
              y: activePayload.sourceRect.top,
              width: activePayload.sourceRect.width,
              height: activePayload.sourceRect.height,
              scale: 1,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              x: phase === "resolve" ? activePayload.targetRect.left : castPath?.x || activePayload.targetRect.left,
              y: phase === "resolve" ? activePayload.targetRect.top : castPath?.y || activePayload.targetRect.top,
              width: activePayload.targetRect.width,
              height: activePayload.targetRect.height,
              scale: phase === "resolve" ? activePayload.preset.arrivalScale : activePayload.preset.travelScale,
              rotate: activePayload.preset.rotation,
              opacity: phase === "resolve" && activePayload.effectType === "escape" ? 0.36 : 1,
            }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{
              duration: reduceMotion ? 0.22 : activePayload.preset.moveDuration,
              ease: activePayload.preset.moveEase,
            }}
          >
            <div className="card-fx-aura">
              <span className="card-fx-ring ring-1" style={{ "--ring-color": activePayload.preset.auraColors[0] }} />
              <span className="card-fx-ring ring-2" style={{ "--ring-color": activePayload.preset.auraColors[1] }} />
              <span className="card-fx-ring ring-3" style={{ "--ring-color": activePayload.preset.auraColors[2] }} />
            </div>
            <div className={classNames("card-fx-surface", `is-${activePayload.preset.themeClass}`)}>
              <CardClone effect={activePayload} />
            </div>
            <EffectEmblem preset={activePayload.preset} />
            <div className={classNames("card-fx-particles", `is-${activePayload.preset.particleStyle}`)}>
              {particles.map((particle) => (
                <span
                  key={particle.id}
                  className="card-fx-particle"
                  style={{
                    "--particle-x": `${particle.x}px`,
                    "--particle-y": `${particle.y}px`,
                    "--particle-delay": `${particle.delay}s`,
                    "--particle-scale": particle.scale,
                  }}
                />
              ))}
            </div>
          </motion.div>
          {activePayload.preset.impactRing ? (
            <motion.div
              className={classNames("card-fx-impact", `is-${activePayload.preset.themeClass}`)}
              style={{
                left: activePayload.targetRect.left + activePayload.targetRect.width * 0.5,
                top: activePayload.targetRect.top + activePayload.targetRect.height * 0.56,
              }}
              initial={{ opacity: 0, scale: 0.54 }}
              animate={{ opacity: phase === "resolve" ? 1 : 0, scale: phase === "resolve" ? 1.18 : 0.62 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.16 : 0.34, ease: [0.2, 0.9, 0.2, 1] }}
            />
          ) : null}
          {activePayload.result === "win" ? (
            <motion.div
              className={classNames("card-fx-result", `is-${activePayload.preset.resultGlow}`)}
              style={{
                left: activePayload.highlightRect.left,
                top: activePayload.highlightRect.top,
                width: activePayload.highlightRect.width,
                height: activePayload.highlightRect.height,
              }}
              initial={{ opacity: 0, scale: 0.84 }}
              animate={{
                opacity: phase === "resolve" ? 1 : 0,
                scale: phase === "resolve" ? clamp(activePayload.preset.arrivalScale + 0.06, 1.02, 1.18) : 0.86,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.18 : 0.42, ease: [0.18, 0.88, 0.24, 1] }}
            />
          ) : null}
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
