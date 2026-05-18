import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { EffectQualityTier } from "../types";
import { resolveEffectQualityTier } from "../cardEffects/effectPresets";
import { GameScene } from "./GameScene";
import { Z_LAYERS } from "./zLayers";

interface GameCanvasProps {
  /** Number of seats currently in the match. Optional in Stage 5. */
  seatCount?: number;
  /** Manual quality tier override (mostly for tests). */
  qualityTier?: EffectQualityTier;
}

interface ViewportSize {
  width: number;
  height: number;
}

function readViewportSize(): ViewportSize {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }
  return {
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
  };
}

/**
 * Map our shared EffectQualityTier into a R3F devicePixelRatio policy.
 *
 *   ultra/high -> use the device pixel ratio, capped at 2 to control fill cost
 *   medium     -> capped at 1.5
 *   low        -> capped at 1.25
 *   lite       -> always 1, the cheapest path
 */
function dprForTier(tier: EffectQualityTier): [number, number] {
  if (tier === "ultra" || tier === "high") {
    return [1, 2];
  }
  if (tier === "medium") {
    return [1, 1.5];
  }
  if (tier === "low") {
    return [1, 1.25];
  }
  return [1, 1];
}

/**
 * GameCanvas
 *
 * The first real R3F root in the project.
 *
 * Stage 5 responsibilities:
 *   - mount the R3F Canvas
 *   - apply a device-pixel-ratio policy based on EffectQualityTier
 *   - track viewport changes so GameCamera can respond to Discord resizes
 *   - sit BELOW the legacy gamePanel via Z_LAYERS.canvas
 *
 * Out of scope on this stage:
 *   - postprocessing
 *   - shadows
 *   - effect channels (camera shake / drift) — those move into Stage 7
 *
 * Mount policy:
 *   - parent (App.tsx) only mounts this component when the current view is
 *     `game`. We do not gate the mount inside this component on purpose so
 *     the lifecycle is explicit at the call site.
 */
export function GameCanvas({ seatCount, qualityTier }: GameCanvasProps) {
  const tier = qualityTier ?? resolveEffectQualityTier();
  const [viewport, setViewport] = useState<ViewportSize>(() => readViewportSize());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = (): void => {
      setViewport(readViewportSize());
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const aspect = viewport.width / Math.max(1, viewport.height);

  return (
    <div
      className="game-canvas-root"
      data-quality-tier={tier}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_LAYERS.canvas,
        // Pointer events stay off the canvas while gameplay still lives in the
        // DOM overlay above. Stage 7+ may re-enable for world-space picking.
        pointerEvents: "none",
      }}
    >
      <Canvas
        dpr={dprForTier(tier)}
        flat
        gl={{
          antialias: tier === "ultra" || tier === "high",
          powerPreference: tier === "lite" ? "low-power" : "high-performance",
          alpha: true,
        }}
        // We drive aspect through GameCamera so Canvas's built-in resize
        // observer cooperates with our viewport tracking.
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#0b1424"]} />
        <GameScene qualityTier={tier} aspect={aspect} seatCount={seatCount} />
      </Canvas>
    </div>
  );
}
