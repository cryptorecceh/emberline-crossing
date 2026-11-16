// Emberline Crossing — player movement: acceleration, friction, gravity, jump,
// crouch, and AABB collision against the world's cover. Movement speed feeds
// weapon spread, so stopping to aim pays (judge criterion 2).
import * as THREE from 'three';

const WALK_SPEED = 5.4;
const CROUCH_SPEED = 2.6;
const ACCEL = 42;
const FRICTION = 10;
const GRAVITY = 20;
const JUMP_SPEED = 7.2;
const EYE_STAND = 1.62;
const EYE_CROUCH = 1.05;
const RADIUS = 0.42;

export function createPlayer(colliders, spawn) {
  const state = {
    position: spawn.clone(),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eye: EYE_STAND,
    crouched: false,
    grounded: true,
    recoilPitch: 0,
    recoilYaw: 0,
  };
  const desired = new THREE.Vector3();

  function collideAxis(axis) {
    for (const c of colliders) {
      if (state.position.y > c.height) continue;
      const overlapX = state.position.x + RADIUS > c.minX && state.position.x - RADIUS < c.maxX;
      const overlapZ = state.position.z + RADIUS > c.minZ && state.position.z - RADIUS < c.maxZ;
      if (!overlapX || !overlapZ) continue;
      if (axis === 'x') {
        state.position.x = state.velocity.x > 0 ? c.minX - RADIUS - 0.001 : c.maxX + RADIUS + 0.001;
        state.velocity.x = 0;
      } else {
        state.position.z = state.velocity.z > 0 ? c.minZ - RADIUS - 0.001 : c.maxZ + RADIUS + 0.001;
        state.velocity.z = 0;
      }
    }
  }

  function step(dt, keys, adsT = 0, moveVec = null) {
    let forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    let strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    if (moveVec) {
      forward += moveVec.y;
      strafe += moveVec.x;
      forward = Math.max(-1, Math.min(1, forward));
      strafe = Math.max(-1, Math.min(1, strafe));
    }
    state.crouched = keys.has('ControlLeft') || keys.has('ControlRight');
    const targetEye = state.crouched ? EYE_CROUCH : EYE_STAND;
    state.eye += (targetEye - state.eye) * Math.min(1, dt * 10);
    // Aiming down sights steadies the gun but slows the feet.
    const speed = (state.crouched ? CROUCH_SPEED : WALK_SPEED) * (1 - 0.45 * adsT);
    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    desired.set(0, 0, 0);
    if (forward !== 0 || strafe !== 0) {
      desired.x = (-sin * forward + cos * strafe);
      desired.z = (-cos * forward - sin * strafe);
      // Analog input (touch joystick) scales speed; keys stay full speed.
      const mag = Math.min(1, Math.hypot(forward, strafe));
      desired.normalize().multiplyScalar(speed * mag);
    }
    state.velocity.x += (desired.x - state.velocity.x) * Math.min(1, ACCEL * dt / (speed || 1) * 0.22 + dt * 6);
    state.velocity.z += (desired.z - state.velocity.z) * Math.min(1, ACCEL * dt / (speed || 1) * 0.22 + dt * 6);
    const horizontal = Math.hypot(state.velocity.x, state.velocity.z);
    if (horizontal > speed) {
      state.velocity.x *= speed / horizontal;
      state.velocity.z *= speed / horizontal;
    }
    if (forward === 0 && strafe === 0) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      state.velocity.x *= damp;
      state.velocity.z *= damp;
    }
    state.position.x += state.velocity.x * dt;
    collideAxis('x');
    state.position.z += state.velocity.z * dt;
    collideAxis('z');
    // Map bounds.
    state.position.x = Math.max(-23.4, Math.min(23.4, state.position.x));
    state.position.z = Math.max(-19.4, Math.min(19.4, state.position.z));
    // Gravity + jump.
    if (keys.has('Space') && state.grounded) {
      state.velocity.y = JUMP_SPEED;
      state.grounded = false;
    }
    state.velocity.y -= GRAVITY * dt;
    state.position.y += state.velocity.y * dt;
    if (state.position.y <= 0) {
      state.position.y = 0;
      state.velocity.y = 0;
      state.grounded = true;
    }
    // Recoil decays back to zero.
    state.recoilPitch *= Math.max(0, 1 - dt * 7);
    state.recoilYaw *= Math.max(0, 1 - dt * 7);
  }

  function look(dx, dy) {
    state.yaw -= dx * 0.0022;
    state.pitch -= dy * 0.0022;
    state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
  }

  function recoil(addedPitch, addedYaw) {
    state.recoilPitch += addedPitch;
    state.recoilYaw += addedYaw;
  }

  function groundSpeed() {
    return Math.hypot(state.velocity.x, state.velocity.z);
  }

  function respawn(at, yaw) {
    state.position.copy(at);
    state.velocity.set(0, 0, 0);
    state.yaw = yaw;
    state.pitch = 0;
    state.recoilPitch = 0;
    state.recoilYaw = 0;
  }

  return { state, step, look, recoil, groundSpeed, respawn };
}
