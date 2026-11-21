import * as THREE from "three";

/**
 * Mutable runtime rig. Kept outside React so the render loop never causes
 * re-renders. The director only ever reads tiny snapshots of this.
 */
export const rig = {
  pos: new THREE.Vector3(0, 0, 14),
  yaw: -0.1,
  pitch: -0.03,
  vy: 0,
  grounded: true,
  moving: false,
  sprint: false,

  driving: false,
  vehiclePos: new THREE.Vector3(5.2, 0, 2),
  heading: 0,
  speed: 0,
  steer: 0,
  flyAlt: 0,

  at: 0,
  locked: false,
};

export type Rig = typeof rig;
