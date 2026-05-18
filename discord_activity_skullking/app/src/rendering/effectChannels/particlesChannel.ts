import type { CardEffectEvent, EffectQualityTier } from "../../types";

/**
 * Particles channel — Stage 7 minimal implementation.
 *
 * What this owns:
 *   - a single short-lived world-space burst near the trick center,
 *     rendered as Points with a constant point size
 *
 * What this does NOT own (kept on the DOM CardEffectLayer):
 *   - the foreground particle ribbons that fly with the card travel
 *     (slash / water / mist / royal — those stay on screen-space DOM
 *     because they ride the card's source rect and inherit live shape)
 *
 * The world burst is the BACKGROUND drama beat — small, behind the card,
 * meant to feel like the table reacted. It must not steal focus from the
 * DOM travel effect that owns the card's path.
 *
 * Quality tier ceilings (per rendering-pipeline.md performance budget):
 *   ultra  / high   -> 24 points
 *   medium          -> 16 points
 *   low             ->  8 points
 *   lite            ->  0 points (channel disabled)
 */

export interface ParticleBurstRequest {
  /** Wall-clock start time, ms. */
  startedAt: number;
  /** Total duration, ms. */
  durationMs: number;
  /** Number of points in the burst. */
  count: number;
  /** Initial outward velocity scalar in world units / sec. */
  velocity: number;
  /** Radius of the spawn ring, world units. */
  spawnRadius: number;
  /** Tint color, fed from the card preset. */
  color: string;
  /** Source event id, used so cancel() can target the right burst. */
  eventId: string;
}

/** Per-particle state recomputed each frame. */
export interface ParticleSample {
  /** Local position relative to the trick center anchor. */
  positions: Float32Array;
  /** Per-particle alpha so we can fade out independently of size. */
  opacity: number;
}

const BURST_DURATION_MIN_MS = 600;
const BURST_DURATION_MAX_MS = 900;

function tierCount(qualityTier: EffectQualityTier): number {
  if (qualityTier === "lite") return 0;
  if (qualityTier === "low") return 8;
  if (qualityTier === "medium") return 16;
  return 24; // ultra / high
}

/**
 * Decide whether this event should produce a world particle burst.
 * Returns null when the channel should stay silent.
 */
export function decideParticleBurst(
  event: CardEffectEvent,
  qualityTier: EffectQualityTier,
): ParticleBurstRequest | null {
  if (!event.channels.includes("particles")) return null;
  const count = tierCount(qualityTier);
  if (count === 0) return null;

  // Mermaid / escape ride DOM ribbons; their world burst stays small.
  // Skull King / kraken / white_whale get the louder spawn radius.
  const strong = event.channels.includes("board");
  const spawnRadius = strong ? 0.55 : 0.35;
  const velocity = strong ? 1.6 : 1.1;

  const color = event.payload.preset.auraColors?.[0] || "#fff5d5";

  const durationRaw = Math.round(event.payload.preset.totalDuration * 1000 * 0.5);
  const durationMs = Math.max(
    BURST_DURATION_MIN_MS,
    Math.min(BURST_DURATION_MAX_MS, durationRaw || 720),
  );

  return {
    startedAt: event.createdAt || Date.now(),
    durationMs,
    count,
    velocity,
    spawnRadius,
    color,
    eventId: event.id,
  };
}

/**
 * Allocate a particle pattern. Each entry has a stable angle / radius so
 * the per-frame sampler only needs the scalar progress to recompute
 * positions; this avoids any per-frame Math.random() calls.
 */
export function buildParticlePattern(
  burst: ParticleBurstRequest,
): { angles: Float32Array; lifts: Float32Array } {
  const angles = new Float32Array(burst.count);
  const lifts = new Float32Array(burst.count);
  for (let i = 0; i < burst.count; i += 1) {
    angles[i] = (i / burst.count) * Math.PI * 2 + (i % 3) * 0.07;
    // Stable per-particle vertical bias so the burst feels organic without
    // calling Math.random() during animation.
    lifts[i] = 0.3 + ((i * 37) % 10) / 10;
  }
  return { angles, lifts };
}

/**
 * Sample a particle burst at the current frame. The caller passes a
 * pre-allocated Float32Array of length burst.count * 3 to receive the
 * positions; we never allocate during animation.
 */
export function sampleParticleBurst(
  burst: ParticleBurstRequest,
  pattern: { angles: Float32Array; lifts: Float32Array },
  positions: Float32Array,
  nowMs: number,
): ParticleSample | null {
  const elapsed = nowMs - burst.startedAt;
  if (elapsed < 0 || elapsed >= burst.durationMs) {
    return null;
  }
  const t = elapsed / burst.durationMs;
  // ease-out radial expansion + gentle gravity drop
  const easeOut = 1 - Math.pow(1 - t, 2.0);
  const radius = burst.spawnRadius + burst.velocity * easeOut * 0.45;
  const lift = 0.6 * (1 - Math.pow(t - 0.4, 2) * 2.4);

  for (let i = 0; i < burst.count; i += 1) {
    const angle = pattern.angles[i];
    const liftBias = pattern.lifts[i];
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = Math.max(0, lift) * liftBias;
    const o = i * 3;
    positions[o + 0] = x;
    positions[o + 1] = y;
    positions[o + 2] = z;
  }

  // Quadratic fade so the burst lands cleanly to invisible.
  const opacity = (1 - t) * (1 - t);
  return { positions, opacity };
}
