import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";

interface GameCameraProps {
  /** Device aspect ratio (width / height). */
  aspect: number;
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
export function GameCamera({ aspect }: GameCameraProps) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) {
      return;
    }
    const compact = aspect < 0.95;
    const fov = compact ? 48 : 42;
    const position: [number, number, number] = compact ? [0, 5.2, 5.6] : [0, 4.6, 5.0];

    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(0, 0, 0);
    camera.fov = fov;
    camera.aspect = aspect;
    camera.near = 0.1;
    camera.far = 50;
    camera.updateProjectionMatrix();
  }, [aspect, camera]);

  return null;
}
