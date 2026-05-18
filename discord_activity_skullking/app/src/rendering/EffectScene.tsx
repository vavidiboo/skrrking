import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, Mesh, Points, Vector3 } from "three";
import { onEffectBusMessage } from "../cardEffects/effectBus";
import type { CardEffectEvent, EffectBusMessage, EffectEvent, EffectQualityTier } from "../types";
import {
  applyCameraShake,
  buildParticlePattern,
  decideBoardRipple,
  decideParticleBurst,
  decideShakeAmplitude,
  decideShakeDuration,
  decideShakeFrequency,
  sampleBoardRipple,
  sampleParticleBurst,
  type BoardRippleRequest,
  type CameraShakeRequest,
  type ParticleBurstRequest,
} from "./effectChannels";
import type { GameCameraFraming } from "./GameCamera";
import {
  cancelWorldEffectEvent,
  createWorldEffectQueueState,
  enqueueWorldEffectEvent,
  finishActiveWorldEffect,
  takeNextWorldEffectEvent,
} from "./worldEffectQueue";

interface EffectSceneProps {
  qualityTier: EffectQualityTier;
  cameraFraming: GameCameraFraming;
}

/**
 * EffectScene
 *
 * Stage 7 introduces the first R3F-side consumer of the effectBus.
 *
 * Channel ownership (see docs/rendering-pipeline.md "World vs Overlay"):
 *
 *   DOM CardEffectLayer owns:
 *     - card travel actor
 *     - flash burst
 *     - impact ring (.card-fx-impact)
 *     - vignette dim
 *     - score-adjacent overlay text and live highlight
 *     - DOM board shake (.card-fx-board-shake--*)
 *
 *   EffectScene (this file) owns:
 *     - camera shake / nudge (world-space camera transform)
 *     - board ripple ring (world-space mesh on the table surface)
 *     - world particle burst near the trick center (world-space Points)
 *
 * The two layers run on the SAME effectBus event but on DIFFERENT visual
 * transforms, so they never paint the same thing twice. The DOM shake
 * moves the screen-space board element; the camera shake moves the world
 * camera. They are visually complementary, not redundant.
 *
 * Subscription:
 *   - we subscribe in useEffect, not useFrame
 *   - we filter `kind === "dispatch"` on incoming messages
 *   - on `kind === "cancel"`, any active world effect for the cancelled
 *     event id is hard-reset (see clearActiveEffects)
 *
 * Throttling and dedupe are done by effectBus before events reach us, so
 * EffectScene never adds its own queue.
 */

function isCardEffectEvent(event: EffectEvent): event is CardEffectEvent {
  return event.type.startsWith("card.");
}

interface ActiveWorldEffects {
  shake: CameraShakeRequest | null;
  ripple: BoardRippleRequest | null;
  burst: ParticleBurstRequest | null;
  burstPattern: { angles: Float32Array; lifts: Float32Array } | null;
  burstPositions: Float32Array | null;
}

function emptyActive(): ActiveWorldEffects {
  return {
    shake: null,
    ripple: null,
    burst: null,
    burstPattern: null,
    burstPositions: null,
  };
}

function hasRunningWorldEffects(active: ActiveWorldEffects): boolean {
  return Boolean(active.shake || active.ripple || active.burst);
}

function startWorldEffectEvent(
  event: CardEffectEvent,
  qualityTier: EffectQualityTier,
  active: ActiveWorldEffects,
  positionBuffer: Float32Array,
  nowMs: number,
): boolean {
  let started = false;

  const amplitude = decideShakeAmplitude(event, qualityTier);
  if (amplitude > 0) {
    active.shake = {
      startedAt: nowMs,
      durationMs: decideShakeDuration(event),
      amplitude,
      frequencyHz: decideShakeFrequency(event),
      eventId: event.id,
    };
    started = true;
  }

  const ripple = decideBoardRipple(event, qualityTier);
  if (ripple) {
    active.ripple = { ...ripple, startedAt: nowMs };
    started = true;
  }

  const burst = decideParticleBurst(event, qualityTier);
  if (burst) {
    const stamped: ParticleBurstRequest = { ...burst, startedAt: nowMs };
    active.burst = stamped;
    active.burstPattern = buildParticlePattern(stamped);
    active.burstPositions = positionBuffer;
    for (let i = 0; i < positionBuffer.length; i += 1) positionBuffer[i] = 0;
    started = true;
  }

  return started;
}

export function EffectScene({ qualityTier, cameraFraming }: EffectSceneProps) {
  const camera = useThree((state) => state.camera);
  const cameraBaselineRef = useRef<Vector3>(new Vector3(...cameraFraming.position));
  const activeRef = useRef<ActiveWorldEffects>(emptyActive());
  const queueRef = useRef(createWorldEffectQueueState());

  const rippleMeshRef = useRef<Mesh>(null);
  const pointsRef = useRef<Points>(null);
  const pointsGeometryRef = useRef<BufferGeometry>(null);

  // Pre-allocate the largest possible position buffer (24 points * 3 floats)
  // so the geometry never reallocates during animation. We still set the
  // draw range each burst so smaller bursts only render their own points.
  const positionBuffer = useMemo(() => new Float32Array(24 * 3), []);

  useEffect(() => {
    const unsubscribe = onEffectBusMessage((message: EffectBusMessage) => {
      if (message.kind === "cancel") {
        // Hard cancel any active world effect that matches this event id.
        const active = activeRef.current;
        const cancelledActive = cancelWorldEffectEvent(queueRef.current, message.id);
        if (active.shake?.eventId === message.id) active.shake = null;
        if (active.ripple?.eventId === message.id) active.ripple = null;
        if (active.burst?.eventId === message.id) {
          active.burst = null;
          active.burstPattern = null;
          active.burstPositions = null;
        }
        if (cancelledActive && !hasRunningWorldEffects(active)) {
          finishActiveWorldEffect(queueRef.current, message.id);
        }
        return;
      }
      if (message.kind !== "dispatch") return;
      const event = message.event;
      if (!isCardEffectEvent(event)) return;

      // lite tier short-circuit: EffectScene becomes a no-op so we do not
      // burn any work on low-end devices or under prefers-reduced-motion
      // (which resolveEffectQualityTier downgrades to "lite").
      if (qualityTier === "lite") return;
      enqueueWorldEffectEvent(queueRef.current, event);
    });
    return unsubscribe;
  }, [positionBuffer, qualityTier]);

  useEffect(() => {
    cameraBaselineRef.current.set(
      cameraFraming.position[0],
      cameraFraming.position[1],
      cameraFraming.position[2],
    );
  }, [cameraFraming]);

  useFrame(() => {
    if (qualityTier === "lite") return;
    const active = activeRef.current;
    const now = Date.now();
    if (!hasRunningWorldEffects(active)) {
      let next = takeNextWorldEffectEvent(queueRef.current);
      while (next) {
        const started = startWorldEffectEvent(next, qualityTier, active, positionBuffer, now);
        if (started) {
          break;
        }
        finishActiveWorldEffect(queueRef.current, next.id);
        next = takeNextWorldEffectEvent(queueRef.current);
      }
    }

    // Camera shake. Resting framing comes from GameCamera's shared framing
    // model so viewport reflows and shake recovery always converge on the
    // same source of truth.
    if (active.shake) {
      const stillRunning = applyCameraShake(camera, cameraBaselineRef.current, active.shake, now);
      if (!stillRunning) {
        camera.position.copy(cameraBaselineRef.current);
        active.shake = null;
      }
    }

    // Board ripple. Hide the mesh when no ripple is active.
    const rippleMesh = rippleMeshRef.current;
    if (rippleMesh) {
      if (active.ripple) {
        const sample = sampleBoardRipple(active.ripple, now);
        if (sample) {
          rippleMesh.visible = true;
          const s = active.ripple.radius * sample.scale;
          rippleMesh.scale.set(s, s, 1);
          const material = rippleMesh.material as {
            opacity?: number;
            transparent?: boolean;
            color?: { set?: (value: string) => void };
          };
          if (material) {
            material.opacity = sample.opacity;
            material.transparent = true;
            material.color?.set?.(active.ripple.color);
          }
        } else {
          active.ripple = null;
          rippleMesh.visible = false;
        }
      } else if (rippleMesh.visible) {
        rippleMesh.visible = false;
      }
    }

    // Particle burst.
    const points = pointsRef.current;
    const geom = pointsGeometryRef.current;
    if (points && geom) {
      if (active.burst && active.burstPattern && active.burstPositions) {
        const sample = sampleParticleBurst(active.burst, active.burstPattern, active.burstPositions, now);
        if (sample) {
          points.visible = true;
          const attr = geom.getAttribute("position") as Float32BufferAttribute | undefined;
          if (attr) {
            // Copy without realloc — see the pre-allocation comment above.
            (attr.array as Float32Array).set(sample.positions);
            attr.needsUpdate = true;
            geom.setDrawRange(0, active.burst.count);
          }
          const material = points.material as { opacity?: number; transparent?: boolean; color?: { set?: (c: string) => void } };
          if (material) {
            material.opacity = sample.opacity;
            material.transparent = true;
            material.color?.set?.(active.burst.color);
          }
        } else {
          active.burst = null;
          active.burstPattern = null;
          active.burstPositions = null;
          points.visible = false;
        }
      } else if (points.visible) {
        points.visible = false;
      }
    }

    if (!hasRunningWorldEffects(active) && queueRef.current.activeEventId) {
      finishActiveWorldEffect(queueRef.current, queueRef.current.activeEventId);
    }
  });

  // Static buffer geometry for the particle Points. We allocate enough
  // slots for the largest tier (ultra) and use draw ranges to limit the
  // count per burst. A static `position` attribute keeps THREE happy.
  const pointsGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(24 * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  return (
    <group name="EffectScene">
      {/* Board ripple: ring mesh hovering just above the table surface. */}
      <mesh
        ref={rippleMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 0]}
        visible={false}
        name="BoardRipple"
      >
        <ringGeometry args={[0.78, 1.02, 64]} />
        <meshBasicMaterial color="#fff5d5" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* World particle burst centred on the trick anchor. */}
      <points
        ref={pointsRef}
        position={[0, 0.05, 0]}
        visible={false}
        name="WorldParticleBurst"
      >
        <primitive object={pointsGeometry} ref={pointsGeometryRef} attach="geometry" />
        <pointsMaterial
          size={0.08}
          color="#fff5d5"
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
