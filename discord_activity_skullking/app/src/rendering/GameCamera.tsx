import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";

interface GameCameraProps {
  framing: GameCameraFraming;
}

export interface GameCameraFraming {
  /** Device aspect ratio (width / height). */
  aspect: number;
  /** Camera field of view. */
  fov: number;
  /** Resting camera position. */
  position: [number, number, number];
  /** Stable look-at target for the table center. */
  lookAt: [number, number, number];
}

export function resolveGameCameraFraming(aspect: number): GameCameraFraming {
  const compact = aspect < 0.95;
  return {
    aspect,
    fov: compact ? 48 : 42,
    position: compact ? [0, 5.2, 5.6] : [0, 4.6, 5.0],
    lookAt: [0, 0, 0],
  };
}

/**
 * Default game camera framing.
 *
 * Stage 5 scope: only the static framing.
 *   - looks down at the table from a slight tilt
 *   - tracks aspect via the default perspective camera
 *
 * Out of scope on this stage (intentionally not implemented):
 *   - turn emphasis movement
 *   - trick-resolution shake
 *   - special-card drift / push
 *
 * Those land in Stage 7 (basic 3D effects) wired to the camera channel.
 *
 * We update the default Canvas camera in place rather than swapping the
 * camera object, which keeps R3F's resize/render loop ownership intact.
 */
export function GameCamera({ framing }: GameCameraProps) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) {
      return;
    }

    camera.position.set(framing.position[0], framing.position[1], framing.position[2]);
    camera.lookAt(framing.lookAt[0], framing.lookAt[1], framing.lookAt[2]);
    camera.fov = framing.fov;
    camera.aspect = framing.aspect;
    camera.near = 0.1;
    camera.far = 50;
    camera.updateProjectionMatrix();
  }, [camera, framing]);

  return null;
}
