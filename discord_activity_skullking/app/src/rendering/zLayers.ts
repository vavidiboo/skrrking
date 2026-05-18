/**
 * Z-layer policy for the game view.
 *
 * The runtime is a hybrid stack while we migrate from DOM-first to R3F-first.
 * This module is the single source of truth for stacking order between
 * the world-space canvas, the screen-space overlay, and the legacy gamePanel
 * that still hosts the live game UI.
 *
 * Rules (see `docs/rendering-pipeline.md`, "Z-Layer Policy"):
 *
 *   layer 0: far environment    -> inside R3F scene
 *   layer 1: board surface      -> inside R3F scene
 *   layer 2: seat/world props   -> inside R3F scene
 *   layer 3: active trick cards -> inside R3F scene (later)
 *   layer 4: world effects      -> inside R3F scene (later)
 *   layer 5: HTML HUD           -> overlay container
 *   layer 6: dialogs / blockers -> overlay container
 *   layer 7: emergency / system -> top-level portals (CardEffectLayer etc.)
 *
 * The legacy gamePanel still renders most of the HUD, hand, dialogs, and
 * cinematic effects. Until those move into proper React/R3F components,
 * we keep gamePanel as the "overlay floor" and stack the canvas below it.
 *
 * That decision is intentional:
 *   - the canvas provides world-space depth and cinematic backing
 *   - the legacy DOM keeps owning interactive HUD/hand surfaces on top
 *   - CardEffectLayer keeps portaling to <body>, above everything
 *
 * Numbers are chosen so they fit cleanly between existing styles.css ranges
 * (e.g. .layout has z-index 2, gamePanel mini-topbar uses 120, drawers 130,
 *  hand 150, body-portal effects up to 9000).
 */

export const Z_LAYERS = {
  /** R3F canvas root. Sits behind the legacy gamePanel HUD/hand. */
  canvas: 1,
  /** Screen-space overlay container that wraps the legacy gamePanel. */
  overlay: 2,
  /** Reserved for future React-owned HUD that should sit above legacy DOM. */
  hudTop: 200,
  /** Reserved for blocking/system overlays handed by React (reconnect, etc.). */
  systemBlocker: 9500,
} as const;

export type ZLayerKey = keyof typeof Z_LAYERS;
