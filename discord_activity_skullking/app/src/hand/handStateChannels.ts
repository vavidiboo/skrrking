// Feature: stage6-hand-ux-improvement, hand state channel token single source of truth.
//
// This module owns the canonical mapping from each of the seven normalized
// hand-card states (idle / legal / blocked / hovered / selected / held /
// resolving) to the non-color visual channels that hand.css uses to
// distinguish them. The same map will be consumed by HandCard.tsx (task
// 8.1) so the `data-state-channels` attribute it emits stays in sync with
// the CSS comments in hand.css and with the invariant tests in
// __tests__/hand.css.tokens.test.ts.
//
// Channel discipline (R2-2, R8-3): every state lists at least two
// non-color channels and `legal` vs `blocked` differ on at least one
// channel. Tokens come from a fixed alphabet of non-color channels:
//   { outline, shadow, lift, opacity }
// This mirrors the channels actually expressed in hand.css:
//   - outline  -> CSS `outline` / `outline-color` / `outline-offset`
//   - shadow   -> CSS `box-shadow`
//   - lift     -> CSS `transform: translateY(...)`
//   - opacity  -> CSS `opacity`
//
// Keeping this mapping as a const-typed record (not a `string[]`) lets the
// compiler reject typos at every call site that imports it.

import type { HandCardState } from "./deriveHandCardState";

/**
 * Closed alphabet of non-color visual channels Stage 6 hand.css uses to
 * differentiate states. New channels must be added here and to hand.css
 * together — the invariant test enforces membership.
 */
export const HAND_NON_COLOR_CHANNELS = [
  "outline",
  "shadow",
  "lift",
  "opacity",
] as const;

export type HandNonColorChannel = (typeof HAND_NON_COLOR_CHANNELS)[number];

/**
 * Canonical mapping from a hand state to the non-color channels that
 * encode it (relative to the idle baseline). Order is informational only;
 * the assertions treat each list as a set.
 *
 * Source-of-truth pairing with hand.css (task 7.1) per-state comments:
 *   idle      -> outline opacity   (baseline reference frame)
 *   legal     -> outline shadow    (subtle brass outline + sea glow)
 *   blocked   -> opacity shadow    (low opacity + inset shadow)
 *   hovered   -> lift shadow       (pointer hover lift + glow)
 *   selected  -> outline lift      (strong outline + larger lift)
 *   held      -> lift shadow       (long-press inspect lift + glow)
 *   resolving -> opacity shadow    (in-flight opacity drop + pulse)
 */
export const HAND_STATE_CHANNELS: Record<
  HandCardState,
  ReadonlyArray<HandNonColorChannel>
> = {
  idle: ["outline", "opacity"],
  legal: ["outline", "shadow"],
  blocked: ["opacity", "shadow"],
  hovered: ["lift", "shadow"],
  selected: ["outline", "lift"],
  held: ["lift", "shadow"],
  resolving: ["opacity", "shadow"],
};

/**
 * Convenience helper: the space-separated token string HandCard.tsx
 * (task 8.1) writes to `data-state-channels`. Centralizing the formatting
 * here keeps the attribute value identical across the renderer and the
 * tests that parse it.
 */
export function formatHandStateChannels(state: HandCardState): string {
  return HAND_STATE_CHANNELS[state].join(" ");
}
