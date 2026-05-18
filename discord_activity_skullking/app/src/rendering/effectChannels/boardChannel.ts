import type { CardEffectEvent, EffectQualityTier } from "../../types";

/**
 * Board channel — Stage 7 minimal implementation.
 *
 * What this owns:
 *   - a single ring mesh that briefly expands and fades on the table
 *     surface, anchored to the trick center
 *
 * What this does NOT own (kept on the DOM CardEffectLayer):
 *   - the impact ring (.card-fx-impact)
 *   - vignette dim
 *   - flash burst
 *   - score-adjacent overlay text
 *
 * Visual budget:
 *   - one mesh, no shaders, no postprocessing
 *   - opacity tween only; no procedural textures
 *
 * The ring lives ABOVE the table plane (y = 0) by a tiny offset so it
 * never z-fights with the board surface or table ring.
 */

export interface BoardRippleRequest {
  /** Wall-clock start time, ms. */
  startedAt: number;
  /** Total duration, ms. */
  durationMs: number;
  /** Final radius the ring expands to, in world units. */
  radius: number;
  /** Peak opacity at the start of the tween. */
  opacityPeak: number;
  /** Source event id, used so cancel() can target the right ripple. */
  eventId: string;
  /** Tint color for the ring material. Pulled from preset auraColors[0]. */
  color: string;
}

const RIPPLE_DURATION_MIN_MS = 360;
const RIPPLE_DURATION_MAX_MS = 720;
const RIPPLE_OPACITY_BASE = 0.55;

/**
 * Decide whether this event should produce a board ripple, and at what
 * intensity. Returns `null` when the channel should stay silent (lite tier
 * or events without the `board` channel).
 */
export function decideBoardRipple(
  event: CardEffectEvent,
  qualityTier: EffectQualityTier,
): BoardRippleRequest | null {
  if (qualityTier === "lite") return null;
  if (!event.channels.includes("board")) return null;

  // Pull color cue from the preset so each card family stays visually distinct.
  const color = event.payload.preset.auraColors?.[0] || "#7ec7b8";

  // Tier-scaled radius and opacity. The base ring is large enough to read
  // as a board-wide reaction without obscuring the trick center cards.
  const radiusBase = 1.9;
  const radiusMultiplier =
    qualityTier === "ultra" || qualityTier === "high"
      ? 1.0
      : qualityTier === "medium"
        ? 0.85
        : 0.7;

  const durationRaw = Math.round(event.payload.preset.totalDuration * 1000 * 0.55);
  const durationMs = Math.max(
    RIPPLE_DURATION_MIN_MS,
    Math.min(RIPPLE_DURATION_MAX_MS, durationRaw || 480),
  );

  const opacityPeak = qualityTier === "low" ? RIPPLE_OPACITY_BASE * 0.7 : RIPPLE_OPACITY_BASE;

  return {
    startedAt: event.createdAt || Date.now(),
    durationMs,
    radius: radiusBase * radiusMultiplier,
    opacityPeak,
    eventId: event.id,
    color,
  };
}

/**
 * Compute the visual progress of a ripple at the current frame.
 *
 *   scale: 0.4..1.0  (eased outward)
 *   opacity: opacityPeak fading to 0
 *
 * Returns null once the ripple has completed; the caller should hide the
 * ring mesh in that frame.
 */
export function sampleBoardRipple(
  ripple: BoardRippleRequest,
  nowMs: number,
): { scale: number; opacity: number } | null {
  const elapsed = nowMs - ripple.startedAt;
  if (elapsed < 0 || elapsed >= ripple.durationMs) {
    return null;
  }
  const t = elapsed / ripple.durationMs;
  // ease-out for the outward expansion
  const easeOut = 1 - Math.pow(1 - t, 2.4);
  const scale = 0.4 + easeOut * 0.6;
  // ease-in fade for opacity so the ring stays vivid early then dies
  const opacity = ripple.opacityPeak * (1 - t * t);
  return { scale, opacity };
}
