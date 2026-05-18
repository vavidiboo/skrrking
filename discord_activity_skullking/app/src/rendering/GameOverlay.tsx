import React, { type PropsWithChildren } from "react";
import { Z_LAYERS } from "./zLayers";

interface GameOverlayProps extends PropsWithChildren {
  /** Whether this overlay should currently be visible. */
  active: boolean;
}

/**
 * GameOverlay
 *
 * Stage 5 acts as a thin stacking-context wrapper around the existing
 * legacy gamePanel content. Children are rendered as-is so we do NOT
 * disturb the legacy DOM tree that legacy-app.js still mutates.
 *
 * Responsibilities (this stage):
 *   - establish the overlay z-layer above the canvas
 *   - apply `pointer-events: auto` so HUD interactions still work
 *   - respect Discord safe-area insets via env() padding
 *
 * Responsibilities (future stages):
 *   - host React-owned HUD pieces as fragments are migrated out of shell.html
 *   - host React-owned dialogs and result screens
 *
 * Note: the CardEffectLayer keeps portaling to <body> directly. We do not
 * pull it inside this wrapper, on purpose. Keeping the effect overlay above
 * the entire stack via document.body matches the "emergency / system overlay"
 * tier in the z-layer policy and avoids stacking-context surprises.
 */
export function GameOverlay({ active, children }: GameOverlayProps) {
  return (
    <div
      className="game-overlay-root"
      data-overlay-active={active ? "true" : "false"}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: Z_LAYERS.overlay,
        // Honour Discord mobile safe areas. The HUD inside still anchors
        // itself; this just ensures the wrapper does not paint into the
        // device chrome region.
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        // Children are interactive HUD/hand DOM, so input must reach them.
        pointerEvents: active ? "auto" : "none",
        display: active ? "block" : "none",
      }}
    >
      {children}
    </div>
  );
}
