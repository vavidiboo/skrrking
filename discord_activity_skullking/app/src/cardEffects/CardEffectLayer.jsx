import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { buildCardEffectPayload, installCardEffectBridge, onCardEffect } from "./effectBus.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildParticles(effect) {
  const count = effect.preset.particleCount;
  const spread = effect.preset.particleSpread;
  return Array.from({ length: count }, (_, index) => {
    const progress = count <= 1 ? 0.5 : index / (count - 1);
    const angle = (-78 + (progress * 156)) * (Math.PI / 180);
    const distance = spread * (0.72 + ((index % 4) * 0.12));
    return {
      id: `${effect.id}-p-${index}`,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: index * 0.018,
      scale: 0.72 + ((index % 5) * 0.08),
    };
  });
}

function classNames(...tokens) {
  return tokens.filter(Boolean).join(" ");
}

function resolveLiveHighlightClass(glow) {
  return classNames("card-fx-live-highlight", glow && `is-${glow}`);
}

function CardFallback({ effect }) {
  return (
    <div className={classNames("card-fx-fallback", `type-${effect.effectType}`)}>
      <span className="card-fx-fallback-kicker">{effect.effectType.replace(/_/g, " ")}</span>
      <strong>{effect.label}</strong>
    </div>
  );
}

function CardClone({ effect }) {
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

function EffectEmblem({ preset }) {
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

function normalizeEffect(detail, boardSelector) {
  return detail?.preset ? detail : buildCardEffectPayload({ ...detail, boardSelector });
}

export function CardEffectLayer({ boardSelector = "#gamePanel .table-wrap" }) {
  const reduceMotion = useReducedMotion();
  const [queue, setQueue] = useState([]);
  const [activeEffect, setActiveEffect] = useState(null);
  const [phase, setPhase] = useState("idle");

  useEffect(() => {
    installCardEffectBridge();
    return onCardEffect((detail) => {
      setQueue((current) => [...current, normalizeEffect(detail, boardSelector)]);
    });
  }, [boardSelector]);

  useEffect(() => {
    if (activeEffect || queue.length === 0) {
      return;
    }
    setActiveEffect(queue[0]);
    setQueue((current) => current.slice(1));
  }, [activeEffect, queue]);

  useEffect(() => {
    if (!activeEffect) {
      setPhase("idle");
      return;
    }

    const boardNode = document.querySelector(activeEffect.boardSelector || boardSelector);
    const highlightNode = activeEffect.highlightSelector ? document.querySelector(activeEffect.highlightSelector) : null;
    const highlightClass = resolveLiveHighlightClass(activeEffect.preset.resultGlow);

    setPhase("cast");
    if (boardNode && activeEffect.preset.shakeStrength !== "none") {
      boardNode.classList.add("card-fx-board-shake", `card-fx-board-shake--${activeEffect.preset.shakeStrength}`);
    }
    if (highlightNode && activeEffect.result === "win") {
      highlightNode.classList.add(highlightClass);
    }

    const resolveDelayMs = Math.round((reduceMotion ? 0.22 : activeEffect.preset.resolveDelay) * 1000);
    const totalDurationMs = Math.round((reduceMotion ? 0.56 : activeEffect.preset.totalDuration) * 1000);
    const resolveTimer = window.setTimeout(() => setPhase("resolve"), resolveDelayMs);
    const cleanupTimer = window.setTimeout(() => {
      setActiveEffect(null);
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
  }, [activeEffect, boardSelector, reduceMotion]);

  const particles = useMemo(() => activeEffect ? buildParticles(activeEffect) : [], [activeEffect]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {activeEffect ? (
        <div
          className={classNames(
            "card-fx-stage",
            `theme-${activeEffect.preset.themeClass}`,
            activeEffect.preset.dimBackground && "is-dimmed",
            phase === "resolve" && "is-resolving",
          )}
          aria-hidden="true"
        >
          <motion.div
            className="card-fx-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: activeEffect.preset.dimBackground ? 0.76 : 0.22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24 }}
          />
          <motion.div
            className="card-fx-flash"
            style={{ "--card-fx-flash": activeEffect.preset.flashColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.96, 0.08, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.42, times: [0, 0.14, 0.42, 1] }}
          />
          <div className="card-fx-vignette" />
          <motion.div
            className={classNames("card-fx-card", `is-${activeEffect.preset.themeClass}`)}
            initial={{
              x: activeEffect.sourceRect.left,
              y: activeEffect.sourceRect.top,
              width: activeEffect.sourceRect.width,
              height: activeEffect.sourceRect.height,
              scale: 1,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              x: activeEffect.targetRect.left,
              y: activeEffect.targetRect.top,
              width: activeEffect.targetRect.width,
              height: activeEffect.targetRect.height,
              scale: phase === "resolve" ? activeEffect.preset.arrivalScale : activeEffect.preset.travelScale,
              rotate: activeEffect.preset.rotation,
              opacity: phase === "resolve" && activeEffect.effectType === "escape" ? 0.36 : 1,
            }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{
              duration: reduceMotion ? 0.22 : activeEffect.preset.moveDuration,
              ease: activeEffect.preset.moveEase,
            }}
          >
            <div className="card-fx-aura">
              <span className="card-fx-ring ring-1" style={{ "--ring-color": activeEffect.preset.auraColors[0] }} />
              <span className="card-fx-ring ring-2" style={{ "--ring-color": activeEffect.preset.auraColors[1] }} />
              <span className="card-fx-ring ring-3" style={{ "--ring-color": activeEffect.preset.auraColors[2] }} />
            </div>
            <div className={classNames("card-fx-surface", `is-${activeEffect.preset.themeClass}`)}>
              <CardClone effect={activeEffect} />
            </div>
            <EffectEmblem preset={activeEffect.preset} />
            <div className={classNames("card-fx-particles", `is-${activeEffect.preset.particleStyle}`)}>
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
          {activeEffect.preset.impactRing ? (
            <motion.div
              className={classNames("card-fx-impact", `is-${activeEffect.preset.themeClass}`)}
              style={{
                left: activeEffect.targetRect.left + (activeEffect.targetRect.width * 0.5),
                top: activeEffect.targetRect.top + (activeEffect.targetRect.height * 0.56),
              }}
              initial={{ opacity: 0, scale: 0.54 }}
              animate={{ opacity: phase === "resolve" ? 1 : 0, scale: phase === "resolve" ? 1.18 : 0.62 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.16 : 0.34, ease: [0.2, 0.9, 0.2, 1] }}
            />
          ) : null}
          {activeEffect.result === "win" ? (
            <motion.div
              className={classNames("card-fx-result", `is-${activeEffect.preset.resultGlow}`)}
              style={{
                left: activeEffect.highlightRect.left,
                top: activeEffect.highlightRect.top,
                width: activeEffect.highlightRect.width,
                height: activeEffect.highlightRect.height,
              }}
              initial={{ opacity: 0, scale: 0.84 }}
              animate={{ opacity: phase === "resolve" ? 1 : 0, scale: phase === "resolve" ? clamp(activeEffect.preset.arrivalScale + 0.06, 1.02, 1.18) : 0.86 }}
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
