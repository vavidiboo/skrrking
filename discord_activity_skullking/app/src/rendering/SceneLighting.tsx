import React from "react";
import type { EffectQualityTier } from "../types";

interface SceneLightingProps {
  qualityTier: EffectQualityTier;
}

/**
 * Default lighting for the battle board.
 *
 * Stage 5 keeps this minimal:
 *   - one ambient light to bathe the table
 *   - one directional light for board surface depth
 *
 * Higher tiers nudge the directional intensity up; lite tier flattens it.
 * No shadows on this stage to keep the GPU budget predictable on Discord
 * mobile. Shadow casting can come back later in Stage 7 / 9.
 */
export function SceneLighting({ qualityTier }: SceneLightingProps) {
  const ambientIntensity = qualityTier === "lite" ? 0.85 : 0.65;
  const directionalIntensity =
    qualityTier === "ultra" ? 1.05 : qualityTier === "high" ? 0.95 : qualityTier === "medium" ? 0.85 : 0.7;

  return (
    <>
      <ambientLight intensity={ambientIntensity} color="#fff5dc" />
      <directionalLight
        position={[3.2, 6.4, 4.8]}
        intensity={directionalIntensity}
        color="#fff1c2"
      />
      <directionalLight
        position={[-4.0, 3.2, -2.6]}
        intensity={directionalIntensity * 0.35}
        color="#7ec7b8"
      />
    </>
  );
}
