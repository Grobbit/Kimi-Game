"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useWorld } from "@/lib/store";
import { rig } from "@/lib/rig";
import { keys, isTyping } from "@/lib/keyboard";
import { terrainRef } from "@/lib/terrainRef";
import { useUI } from "@/lib/ui";
import { useTerrain } from "./terrainContext";

export default function Player() {
  const terrain = useTerrain();
  const { camera, gl } = useThree();
  const worldRef = useRef<any>(null);
  const bodyRef = useRef<any>(null);
  const colliderRef = useRef<any>(null);
  const ctrlRef = useRef<any>(null);
  const jump = useRef(false);
  const lastNear = useRef(false);
  const bob = useRef(0);

  const teleport = useWorld((s) => s.teleport);

  /* ---- Rapier world ---------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    let world: any = null;

    (async () => {
      const RAPIER = await import("@dimforge/rapier3d-compat");
      await RAPIER.init();
      if (cancelled) return;

      world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

      const geo = terrain.geometry;
      const posAttr = geo.getAttribute("position");
      const idxAttr = geo.getIndex();
      if (!idxAttr) return;
      const verts = new Float32Array(posAttr.array as ArrayLike<number>);
      const inds = new Uint32Array(idxAttr.array as ArrayLike<number>);
      const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      world.createCollider(RAPIER.ColliderDesc.trimesh(verts, inds), ground);

      const x = THREE.MathUtils.clamp(rig.pos.x, -340, 340);
      const z = THREE.MathUtils.clamp(rig.pos.z, -340, 340);
      const y = terrain.sample(x, z);
      rig.pos.set(x, y + 0.02, z);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          x,
          y + 0.97,
          z,
        ),
      );
      const collider = world.createCollider(
        RAPIER.ColliderDesc.capsule(0.6, 0.34),
        body,
      );
      const ctrl = world.createCharacterController(0.02);
      ctrl.enableAutostep(0.42, 0.22, true);
      ctrl.enableSnapToGround(0.5);
      ctrl.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
      ctrl.setMinSlopeSlideAngle((38 * Math.PI) / 180);
      ctrl.setApplyImpulsesToDynamicBodies(true);

      worldRef.current = world;
      bodyRef.current = body;
      colliderRef.current = collider;
      ctrlRef.current = ctrl;

      if (rig.driving) {
        body.setTranslation(
          {
            x: rig.vehiclePos.x,
            y: rig.vehiclePos.y + 0.97,
            z: rig.vehiclePos.z,
          },
          true,
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        world?.free?.();
      } catch {
        /* noop */
      }
      worldRef.current = null;
      bodyRef.current = null;
      colliderRef.current = null;
      ctrlRef.current = null;
    };
  }, [terrain]);

  /* ---- teleports -------------------------------------------------- */
  useEffect(() => {
    if (!teleport) return;
    const t = terrainRef.current ?? terrain;
    let x = teleport.x;
    let z = teleport.z;
    if (teleport.peak) {
      x = t.maxPoint.x;
      z = t.maxPoint.z;
    }
    const gy = t.sample(x, z);
    rig.pos.set(x, gy + 0.02, z);
    rig.vy = 0;
    rig.pitch = 0;
    if (teleport.heading !== undefined) rig.yaw = teleport.heading;
    const b = bodyRef.current;
    if (b) b.setTranslation({ x, y: gy + 0.97, z }, true);
    if (rig.driving) {
      rig.vehiclePos.set(x, gy, z);
      if (teleport.heading !== undefined) rig.heading = teleport.heading;
      rig.speed = 0;
      rig.vy = 0;
    } else {
      // keep the ride nearby so F always works after a jump
      const vx = x + 3.2;
      const vz = z + 3.6;
      rig.vehiclePos.set(vx, t.sample(vx, vz), vz);
      rig.heading = rig.yaw;
      rig.speed = 0;
    }
  }, [teleport?.id, terrain, teleport]);

  /* ---- input / pointer lock --------------------------------------- */
  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      if (isTyping()) return;
      const ui = useUI.getState();
      if (ui.chat) ui.setChat(false);
      canvas.requestPointerLock?.();
    };

    const onLock = () => {
      const locked = document.pointerLockElement === canvas;
      rig.locked = locked;
      useUI.getState().setLocked(locked);
    };

    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      rig.yaw -= e.movementX * 0.0022;
      rig.pitch = THREE.MathUtils.clamp(
        rig.pitch - e.movementY * 0.0022,
        -1.35,
        1.35,
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.code === "KeyF" && !e.repeat) {
        const s = useWorld.getState();
        if (!s.vehicle) return;
        if (s.driving) {
          s.setDriving(false);
        } else {
          const d = Math.hypot(
            rig.pos.x - rig.vehiclePos.x,
            rig.pos.z - rig.vehiclePos.z,
          );
          if (d < 10) s.setDriving(true);
        }
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) jump.current = true;
      }
    };

    canvas.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onLock);
    document.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);

    return () => {
      canvas.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [gl]);

  /* ---- frame loop ------------------------------------------------- */
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    rig.at += dt;

    const s = useWorld.getState();
    rig.driving = s.driving;

    const world = worldRef.current;
    const body = bodyRef.current;
    const ctrl = ctrlRef.current;
    const collider = colliderRef.current;
    if (!world || !body || !ctrl || !collider) return;

    /* proximity for the F hint */
    const near =
      !!s.vehicle &&
      !s.driving &&
      Math.hypot(rig.pos.x - rig.vehiclePos.x, rig.pos.z - rig.vehiclePos.z) <
        10;
    if (near !== lastNear.current) {
      lastNear.current = near;
      useUI.getState().setNear(near);
    }

    if (!s.driving) {
      const fwd = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");

      let dx = 0;
      let dz = 0;
      if (fwd || side) {
        const sy = Math.sin(rig.yaw);
        const cy = Math.cos(rig.yaw);
        dx = -sy * fwd + cy * side;
        dz = -cy * fwd - sy * side;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
      }
      const moving = !!(fwd || side);
      rig.moving = moving;
      rig.sprint = sprint && moving;

      const speed = sprint ? 9.2 : 4.9;

      if (jump.current) {
        jump.current = false;
        if (rig.grounded) rig.vy = 5.3;
      }
      rig.vy -= 9.81 * dt;
      if (rig.vy < -30) rig.vy = -30;

      const desired = {
        x: dx * speed * dt,
        y: rig.vy * dt,
        z: dz * speed * dt,
      };

      ctrl.computeColliderMovement(collider, desired);
      const m = ctrl.computedMovement();
      const t = body.translation();
      body.setNextKinematicTranslation({
        x: t.x + m.x,
        y: t.y + m.y,
        z: t.z + m.z,
      });

      world.timestep = dt;
      world.step();

      const p = body.translation();
      rig.pos.set(p.x, p.y - 0.94, p.z);
      rig.grounded = ctrl.computedGrounded();
      if (rig.grounded && rig.vy < 0) rig.vy = 0;

      if (p.y < -400) {
        const gy = terrain.sample(0, 0);
        body.setTranslation({ x: 0, y: gy + 0.97, z: 0 }, true);
        rig.pos.set(0, gy, 0);
        rig.vy = 0;
      }

      const targetBob =
        moving && rig.grounded ? Math.sin(rig.at * (sprint ? 13 : 9)) * 0.035 : 0;
      bob.current += (targetBob - bob.current) * Math.min(1, dt * 10);

      camera.position.set(p.x, rig.pos.y + 1.66 + bob.current, p.z);
      camera.quaternion.setFromEuler(
        new THREE.Euler(rig.pitch, rig.yaw, 0, "YXZ"),
      );
      if (camera instanceof THREE.PerspectiveCamera && camera.fov !== 61) {
        camera.fov = 61;
        camera.updateProjectionMatrix();
      }
      void state;
    } else {
      body.setNextKinematicTranslation({
        x: rig.vehiclePos.x,
        y: rig.vehiclePos.y + 0.97,
        z: rig.vehiclePos.z,
      });
      world.timestep = dt;
      world.step();
      rig.pos.copy(rig.vehiclePos);
    }
  });

  return null;
}
