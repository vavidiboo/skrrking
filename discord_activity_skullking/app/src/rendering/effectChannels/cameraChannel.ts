import { Camera, Vector3 } from "three";
import type { CardEffectEvent, EffectQualityTier, ShakeStrength } from "../../types";

/**
 * Camera channel — Stage 7 minimal implementation.
 *
 * World counterpart to the DOM card-fx-board-shake animation. The DOM layer
 * keeps shaking the board ELEMENT in screen space; this channel shakes the
 * CAMERA in world space. The two are visually complementary because they
 * operate on different transforms, so they may run at the same time without
 * doubling the same motion.
 *
 * Driver model:
 *   1. EffectScene captures the camera baseline position on the first frame
 *      a shake is active.
 *   2. Each frame, EffectScene calls applyCameraShake() which writes
 *      `camera.position = baseline + offset` based on a time-decayed sine.
 *   3. When the shake ends or is hard-cancelled, EffectScene restores the
 *      baseline exactly so GameCamera's aspect logic stays the source of
 *      truth for the resting framing.
 *
 * Reduced motion: handled implicitly by EffectQualityTier === "lite", which
 * resolveEffectQualityTier() returns when prefers-reduced-motion is set.
 */

export interface CameraShakeRequest {
  /** Wall-clock start time, ms. */
  startedAt: number;
  /** Total duration, ms. Clamped 200..450 by the caller. */
  durationMs: number;
  /** Peak displacement amplitude in world units. */
  amplitude: number;
  /** Sine frequency in Hz. */
  frequencyHz: number;
  /** Source event id, used so cancel() can target the right shake. */
  eventId: string;
}

const SHAKE_DURATION_MIN_MS = 200;
const SHAKE_DURATION_MAX_MS = 450;

/**
 * Map a card effect event to a camera amplitude.
 *
 * Rule of thumb (kept small on purpose so cinematic shakes never harm
 * gameplay readability — see rendering-pipeline.md "Rendering Priority"):
 *
 *   - lite tier                            -> 0  (no shake at all)
 *   - any card.play with no camera channel -> 0.04 (subtle ambient nudge)
 *   - camera + light                       -> 0.10
 *   - camera + medium                      -> 0.16
 *   - camera + heavy                       -> 0.24
 *
 * Tier multipliers then taper the amplitude down on weaker devices.
 */
export function decideShakeAmplitude(event: CardEffectEvent, qualityTier: EffectQualityTier): number {
  if (qualityTier === "lite") {
    return 0;
  }
  const hasCameraChannel = event.channels.includes("camera");
  const strength = event.payload.preset.shakeStrength as ShakeStrength;

  let base = 0.04; // ambient nudge for any card play
  if (hasCameraChannel) {
    if (strength === "light") base = 0.1;
    else if (strength === "medium") base = 0.16;
    else if (strength === "heavy") base = 0.24;
  }

  const tierMultiplier =
    qualityTier === "ultra" || qualityTier === "high"
      ? 1.0
      : qualityTier === "medium"
        ? 0.85
        : 0.6;

  return base * tierMultiplier;
}

export function decideShakeDuration(event: CardEffectEvent): number {
  // Heavier shakes get more time; lighter shakes resolve fast so they do not
  // bleed into the next card play.
  const strength = event.payload.preset.shakeStrength as ShakeStrength;
  const raw = strength === "heavy" ? 420 : strength === "medium" ? 320 : strength === "light" ? 240 : 220;
  return Math.max(SHAKE_DURATION_MIN_MS, Math.min(SHAKE_DURATION_MAX_MS, raw));
}

export function decideShakeFrequency(event: CardEffectEvent): number {
  // Faster wobble for heavier impacts.
  const strength = event.payload.preset.shakeStrength as ShakeStrength;
  if (strength === "heavy") return 22;
  if (strength === "medium") return 18;
  return 14;
}

/**
 * Apply the active shake to the camera for the current frame.
 *
 * Returns `true` while the shake is still progressing, `false` once it has
 * fully finished. The caller is responsible for restoring the baseline when
 * this function returns false (so the resting position is always exact).
 */
export function applyCameraShake(
  camera: Camera,
  baseline: Vector3,
  shake: CameraShakeRequest,
  nowMs: number,
): boolean {
  const elapsed = nowMs - shake.startedAt;
  if (elapsed >= shake.durationMs || shake.amplitude <= 0) {
    camera.position.copy(baseline);
    return false;
  }
  const t = elapsed / shake.durationMs;
  // Quadratic decay so the shake feels punchy at start and lands cleanly.
  const decay = (1 - t) * (1 - t);
  const phase = (elapsed / 1000) * shake.frequencyHz * Math.PI * 2;
  // Two axes are enough for a believable cinematic nudge. We avoid Z so
  // depth-of-field assumptions in future stages stay intact.
  const dx = Math.sin(phase) * shake.amplitude * decay;
  const dy = Math.cos(phase * 1.3) * shake.amplitude * 0.6 * decay;
  camera.position.set(baseline.x + dx, baseline.y + dy, baseline.z);
  return true;
}
