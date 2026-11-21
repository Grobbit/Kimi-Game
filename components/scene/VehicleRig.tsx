"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useWorld } from "@/lib/store";
import { rig } from "@/lib/rig";
import { keys } from "@/lib/keyboard";
import { VEHICLES } from "@/lib/registry";
import VehicleModel from "./VehicleModel";
import { useTerrain } from "./terrainContext";

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

export default function VehicleRig() {
  const vehicle = useWorld((s) => s.vehicle);
  const driving = useWorld((s) => s.driving);
  const terrain = useTerrain();
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);
  const placed = useRef(false);
  const flyAlt = useRef(0);

  const shadowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, "rgba(0,0,0,0.62)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.28)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  /* park the starter car in front of the player, once */
  useEffect(() => {
    if (placed.current) return;
    placed.current = true;
    const x = 1.4;
    const z = 5.0;
    rig.vehiclePos.set(x, terrain.sample(x, z), z);
    rig.heading = 0;
    flyAlt.current = rig.vehiclePos.y + 1.2;
  }, [terrain]);

  /* camera snap + takeoff height when getting in */
  useEffect(() => {
    if (!driving || !vehicle) return;
    const def = VEHICLES[vehicle.kind];
    flyAlt.current = Math.max(
      flyAlt.current,
      rig.vehiclePos.y + (def.fly ? 1.4 : 0.9),
    );
    const back = new THREE.Vector3(
      Math.sin(rig.heading),
      0,
      Math.cos(rig.heading),
    );
    camera.position
      .copy(rig.vehiclePos)
      .addScaledVector(back, def.camDist)
      .add(new THREE.Vector3(0, def.camHeight, 0));
    camera.lookAt(
      rig.vehiclePos.x,
      rig.vehiclePos.y + 1.2,
      rig.vehiclePos.z,
    );
  }, [driving, vehicle, camera]);

  useFrame((_, delta) => {
    if (!vehicle) return;
    const def = VEHICLES[vehicle.kind];
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    rig.driving = driving;

    let x = rig.vehiclePos.x;
    let z = rig.vehiclePos.z;
    let ground = terrain.sample(x, z);

    if (driving) {
      const fwd = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const turn = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
      rig.steer += (turn - rig.steer) * Math.min(1, dt * 9);

      if (def.fly) {
        rig.speed += fwd * def.accel * dt;
        rig.speed *= Math.max(0, 1 - 0.2 * dt);
        rig.speed = clamp(rig.speed, -def.maxSpeed * 0.4, def.maxSpeed);
        rig.heading +=
          rig.steer *
          def.turn *
          dt *
          (0.35 + 0.65 * Math.min(1, Math.abs(rig.speed) / 20)) *
          (rig.speed < 0 ? -1 : 1);

        const up = keys.has("ArrowUp");
        const down = keys.has("ArrowDown");
        if (up) rig.vy += 11 * dt;
        else if (down) rig.vy -= 11 * dt;
        else rig.vy *= Math.max(0, 1 - 2.6 * dt);
        rig.vy = clamp(rig.vy, -9, 9);
        flyAlt.current += rig.vy * dt;
        if (ground < -50) ground = -50;
        if (flyAlt.current < ground + 0.9) {
          flyAlt.current = ground + 0.9;
          rig.vy = Math.max(0, rig.vy);
        }

        x += -Math.sin(rig.heading) * rig.speed * dt;
        z += -Math.cos(rig.heading) * rig.speed * dt;
        rig.vehiclePos.set(x, flyAlt.current, z);

        const pitch = -rig.vy * 0.014;
        const roll = -rig.steer * 0.22;
        g.quaternion.setFromEuler(
          new THREE.Euler(pitch, rig.heading, roll, "YXZ"),
        );
      } else {
        const handbrake = keys.has("Space");
        if (fwd > 0) rig.speed += def.accel * dt;
        else if (fwd < 0)
          rig.speed -=
            (rig.speed > 0 ? def.brake : def.accel * 0.55) * dt;
        else
          rig.speed -=
            Math.sign(rig.speed) * Math.min(Math.abs(rig.speed), 3 * dt);
        if (handbrake) rig.speed *= Math.max(0, 1 - 3.6 * dt);
        rig.speed = clamp(rig.speed, -def.maxSpeed * 0.3, def.maxSpeed);

        rig.heading +=
          rig.steer *
          def.turn *
          dt *
          Math.min(1, Math.abs(rig.speed) / 8) *
          (rig.speed < 0 ? -1 : 1);

        x += -Math.sin(rig.heading) * rig.speed * dt;
        z += -Math.cos(rig.heading) * rig.speed * dt;
        ground = terrain.sample(x, z);
        rig.vehiclePos.set(
          x,
          THREE.MathUtils.lerp(
            rig.vehiclePos.y,
            ground,
            1 - Math.exp(-dt * 16),
          ),
          z,
        );
        if (rig.vehiclePos.y < ground - 2) rig.vehiclePos.y = ground;

        const n = terrain.normal(x, z);
        g.quaternion
          .copy(new THREE.Quaternion().setFromUnitVectors(UP, n))
          .multiply(new THREE.Quaternion().setFromAxisAngle(UP, rig.heading));
        flyAlt.current = rig.vehiclePos.y + 1.1;
      }

      /* chase camera */
      const back = new THREE.Vector3(
        Math.sin(rig.heading),
        0,
        Math.cos(rig.heading),
      );
      const dist =
        def.camDist *
        (1 + Math.min(0.32, (Math.abs(rig.speed) / def.maxSpeed) * 0.3));
      const desired = new THREE.Vector3(
        rig.vehiclePos.x,
        rig.vehiclePos.y + def.camHeight,
        rig.vehiclePos.z,
      ).addScaledVector(back, dist);
      camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));

      const look = new THREE.Vector3(
        rig.vehiclePos.x,
        rig.vehiclePos.y + (def.fly ? 1.8 : 1.25),
        rig.vehiclePos.z,
      );
      if (def.fly) {
        look.addScaledVector(
          new THREE.Vector3(
            -Math.sin(rig.heading),
            0,
            -Math.cos(rig.heading),
          ),
          7,
        );
      }
      camera.lookAt(look);

      if (camera instanceof THREE.PerspectiveCamera) {
        const target =
          62 + Math.min(1, Math.abs(rig.speed) / def.maxSpeed) * 10;
        camera.fov += (target - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }

      rig.pos.copy(rig.vehiclePos);
    } else {
      const fx = -Math.sin(rig.heading) * 1.35;
      const fz = -Math.cos(rig.heading) * 1.35;
      const rx = Math.cos(rig.heading) * 0.82;
      const rz = -Math.sin(rig.heading) * 0.82;
      const wheels = [
        terrain.sample(x + fx + rx, z + fz + rz),
        terrain.sample(x + fx - rx, z + fz - rz),
        terrain.sample(x - fx + rx, z - fz + rz),
        terrain.sample(x - fx - rx, z - fz - rz),
      ];
      const avg = (wheels[0] + wheels[1] + wheels[2] + wheels[3]) / 4;
      rig.vehiclePos.y = avg + 0.04;
      const n = terrain.normal(x, z).lerp(UP, 0.5).normalize();
      g.quaternion
        .copy(new THREE.Quaternion().setFromUnitVectors(UP, n))
        .multiply(new THREE.Quaternion().setFromAxisAngle(UP, rig.heading));
      rig.speed = 0;
      rig.steer = 0;
      flyAlt.current = rig.vehiclePos.y + 1.1;
    }

    g.position.copy(rig.vehiclePos);
  });

  if (!vehicle) return null;

  return (
    <group ref={group}>
      <VehicleModel kind={vehicle.kind} color={vehicle.color} />
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.03, 0]}
        scale={[2.5, 4.7, 1]}
        renderOrder={1}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={shadowTex}
          transparent
          opacity={0.8}
          depthWrite={false}
          color="#000000"
        />
      </mesh>
    </group>
  );
}
