// Emberline Crossing — bots. Nine opponents and allies with real bodies
// (helmet, visor, vest, gun in hand — never plain boxes), routes through the
// map, hold positions, line of sight, hearing, and burst fire. They plant,
// defuse and rotate; the round can be won or lost without the player.
import * as THREE from 'three';
import { THEME } from './palette.js';
import { Sfx } from './audio.js';

const BOT_NAMES_EMBER = ['Ash', 'Flint', 'Cinder', 'Spark'];
const BOT_NAMES_WARDEN = ['Vale', 'Onyx', 'Slate', 'Birch', 'Rowan'];
const SPEED = 3.6;
const EYE = 1.55;

function mat(color, { roughness = 0.8, metalness = 0.05, emissive = null, emissiveIntensity = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
  return m;
}

function buildBody(team, isCarrier) {
  const group = new THREE.Group();
  const teamColor = team === 'ember' ? THEME.teamAttack : THEME.teamDefend;
  const dark = team === 'ember' ? THEME.teamAttackDark : THEME.teamDefendDark;
  const visor = team === 'ember' ? THEME.visorAttack : THEME.visorDefend;
  const cloth = mat(teamColor);
  const darkMat = mat(dark);
  const skin = mat('#c9a184', { roughness: 0.7 });
  const vest = mat(dark, { roughness: 0.65 });
  const visorMat = mat(visor, { roughness: 0.2, metalness: 0.2, emissive: visor, emissiveIntensity: 1.6 });
  const accentMat = mat(teamColor, { roughness: 0.4, emissive: teamColor, emissiveIntensity: 0.7 });

  // Legs + boots.
  const legGeo = new THREE.BoxGeometry(0.17, 0.78, 0.2);
  const leftLeg = new THREE.Mesh(legGeo, darkMat);
  leftLeg.position.set(-0.11, 0.39, 0);
  const rightLeg = new THREE.Mesh(legGeo, darkMat);
  rightLeg.position.set(0.11, 0.39, 0);
  // Torso + vest plate + shoulder pads.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), cloth);
  torso.position.set(0, 1.09, 0);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.06), vest);
  plate.position.set(0, 1.12, 0.17);
  const padL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), vest);
  padL.position.set(-0.32, 1.36, 0);
  const padR = padL.clone();
  padR.position.x = 0.32;
  // Arms reaching forward, gun in hand.
  const armGeo = new THREE.BoxGeometry(0.12, 0.12, 0.5);
  const armL = new THREE.Mesh(armGeo, cloth);
  armL.position.set(-0.18, 1.18, 0.22);
  armL.rotation.x = -0.5;
  const armR = new THREE.Mesh(armGeo, cloth);
  armR.position.set(0.18, 1.18, 0.22);
  armR.rotation.x = -0.5;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.62), mat('#1c1e22', { roughness: 0.45, metalness: 0.6 }));
  gun.position.set(0, 1.16, 0.55);
  // Head: face, helmet shell, glowing visor.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin);
  head.position.set(0, 1.62, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(teamColor, { roughness: 0.55 }));
  helmet.position.set(0, 1.65, 0);
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.03), visorMat);
  visorMesh.position.set(0, 1.62, 0.16);
  // Team stripe on the shoulder + carrier pack.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.32), accentMat);
  stripe.position.set(0, 1.38, 0);
  let pack = null;
  if (isCarrier) {
    pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.14), mat(THEME.accent, { roughness: 0.5, emissive: THEME.accentEmissive, emissiveIntensity: 0.8 }));
    pack.position.set(0, 1.12, -0.22);
  }
  const parts = [leftLeg, rightLeg, torso, plate, padL, padR, armL, armR, gun, head, helmet, visorMesh, stripe];
  if (pack) parts.push(pack);
  for (const p of parts) {
    p.castShadow = true;
    group.add(p);
  }
  // Hitboxes: head, torso, legs — the raycaster reads userData.part.
  head.userData.part = 'head';
  torso.userData.part = 'body';
  plate.userData.part = 'body';
  leftLeg.userData.part = 'leg';
  rightLeg.userData.part = 'leg';
  return { group, headMesh: head, torsoMesh: torso, legMeshes: [leftLeg, rightLeg], gunTip: gun };
}

export function createBots(scene, opts) {
  const { colliders, shootables, effects, onPlayerDamage, onBotDown, playerRef } = opts;
  const bots = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();

  function losClear(from, to) {
    tmpV.subVectors(to, from);
    const dist = tmpV.length();
    if (dist < 0.05) return true;
    raycaster.set(from, tmpV.normalize());
    raycaster.far = dist - 0.05;
    const hits = raycaster.intersectObjects(shootables, false);
    return hits.length === 0;
  }

  function collide(bot, dt) {
    const p = bot.position;
    for (const c of colliders) {
      if (p.y > c.height) continue;
      const ox = p.x + 0.4 > c.minX && p.x - 0.4 < c.maxX;
      const oz = p.z + 0.4 > c.minZ && p.z - 0.4 < c.maxZ;
      if (!ox || !oz) continue;
      const pushL = p.x - (c.minX - 0.4);
      const pushR = (c.maxX + 0.4) - p.x;
      const pushB = p.z - (c.minZ - 0.4);
      const pushF = (c.maxZ + 0.4) - p.z;
      const m = Math.min(pushL, pushR, pushB, pushF);
      if (m === pushL) p.x = c.minX - 0.4;
      else if (m === pushR) p.x = c.maxX + 0.4;
      else if (m === pushB) p.z = c.minZ - 0.4;
      else p.z = c.maxZ + 0.4;
    }
    p.x = Math.max(-23.4, Math.min(23.4, p.x));
    p.z = Math.max(-19.4, Math.min(19.4, p.z));
    void dt;
  }

  function makeBot(team, name, spawn, index, isCarrier) {
    const { group, headMesh, torsoMesh, legMeshes, gunTip } = buildBody(team, isCarrier);
    group.position.copy(spawn);
    scene.add(group);
    const bot = {
      team, name, index, isCarrier,
      group, headMesh, torsoMesh, legMeshes, gunTip,
      position: group.position,
      health: 100, alive: true,
      yaw: team === 'ember' ? Math.PI : 0,
      state: 'route', // route | hold | engage | investigate | plant | defuse | rotate | dead
      route: [], routeIndex: 0, holdUntil: 0,
      target: null, // bot or 'player'
      lastSeen: 0, reactionAt: 0, burstLeft: 0, nextShotAt: 0,
      hearAt: null, hearPos: null, stuckAt: 0, lastPos: spawn.clone(),
      fade: 1, deathT: 0, flashT: 0, losAt: -1, losOk: false,
    };
    group.rotation.y = bot.yaw;
    for (const mesh of [headMesh, torsoMesh, ...legMeshes]) {
      mesh.userData.bot = bot;
    }
    bots.push(bot);
    return bot;
  }

  function spawnSquad() {
    bots.length = 0;
    for (let i = 0; i < 4; i += 1) {
      makeBot('ember', BOT_NAMES_EMBER[i], opts.attackerSpawns[i], i, i === 0);
    }
    for (let i = 0; i < 5; i += 1) {
      makeBot('warden', BOT_NAMES_WARDEN[i], opts.defenderSpawns[i], i, false);
    }
    return bots;
  }

  function eyePos(bot) {
    return tmpV2.set(bot.position.x, bot.position.y + EYE, bot.position.z);
  }

  function canSee(bot, target) {
    const from = new THREE.Vector3(bot.position.x, bot.position.y + EYE, bot.position.z);
    const to = target === 'player'
      ? new THREE.Vector3(playerRef.position.x, playerRef.position.y + playerRef.eye * 0.88, playerRef.position.z)
      : new THREE.Vector3(target.position.x, target.position.y + 1.3, target.position.z);
    return losClear(from, to);
  }

  function nearestVisibleEnemy(bot, now) {
    let best = null;
    let bestDist = Infinity;
    const candidates = [];
    if (bot.team === 'ember') {
      for (const b of bots) if (b.team === 'warden' && b.alive) candidates.push(b);
    } else {
      for (const b of bots) if (b.team === 'ember' && b.alive) candidates.push(b);
      candidates.push('player');
    }
    for (const target of candidates) {
      const isPlayer = target === 'player';
      const tx = isPlayer ? playerRef.position.x : target.position.x;
      const tz = isPlayer ? playerRef.position.z : target.position.z;
      const dist = Math.hypot(tx - bot.position.x, tz - bot.position.z);
      if (dist > 46) continue;
      if (now - bot.losAt > 0.15 || bot.losOk === false) {
        bot.losAt = now;
        bot.losOk = canSee(bot, target);
      }
      if (!bot.losOk) continue;
      if (dist < bestDist) { bestDist = dist; best = target; }
    }
    return best ? { target: best, dist: bestDist } : null;
  }

  function hitChance(bot, target, dist, targetMoving) {
    let chance = 0.34 - dist * 0.006;
    if (bot.state === 'hold') chance += 0.1;
    if (targetMoving) chance -= 0.12;
    if (bot.moving) chance -= 0.08;
    return Math.max(0.06, Math.min(0.6, chance));
  }

  function botShoot(bot, target, now, dist) {
    if (now < bot.nextShotAt) return;
    bot.nextShotAt = now + 0.13;
    const from = new THREE.Vector3();
    bot.gunTip.getWorldPosition(from);
    const isPlayer = target === 'player';
    const tx = isPlayer ? playerRef.position.x : target.position.x;
    const ty = isPlayer ? playerRef.position.y + 1.2 : target.position.y + 1.2;
    const tz = isPlayer ? playerRef.position.z : target.position.z;
    const targetMoving = isPlayer
      ? Math.hypot(playerRef.velocity.x, playerRef.velocity.z) > 1
      : target.moving;
    const hit = Math.random() < hitChance(bot, target, dist, targetMoving);
    const aim = new THREE.Vector3(tx, ty, tz);
    if (!hit) {
      aim.x += (Math.random() - 0.5) * 1.6;
      aim.y += (Math.random() - 0.5) * 1.2;
      aim.z += (Math.random() - 0.5) * 1.6;
    }
    effects.fireTracer(from, aim);
    effects.muzzleFlash(from);
    if (Math.hypot(from.x - playerRef.position.x, from.z - playerRef.position.z) < 26) {
      Sfx.shot('rifle');
    }
    if (hit) {
      const head = Math.random() < 0.16;
      const dmg = head ? 62 : 26 + Math.floor(Math.random() * 9);
      if (isPlayer) onPlayerDamage(dmg, bot.position);
      else damageBot(target, dmg, head ? 'head' : 'body', bot);
    }
  }

  function damageBot(bot, amount, part, attacker) {
    if (!bot.alive) return;
    bot.health -= amount;
    bot.flashT = 0.12;
    if (attacker) {
      bot.hearPos = attacker.position ? attacker.position.clone() : new THREE.Vector3(attacker.x, 0, attacker.z);
      bot.hearAt = performance.now() / 1000;
      if (bot.state === 'route' || bot.state === 'hold') bot.state = 'investigate';
    }
    if (bot.health <= 0) {
      bot.alive = false;
      bot.state = 'dead';
      bot.deathT = 0;
      onBotDown(bot, attacker);
    }
  }

  function moveToward(bot, tx, tz, dt, speed) {
    const dx = tx - bot.position.x;
    const dz = tz - bot.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) return true;
    const step = Math.min(dist, speed * dt);
    bot.position.x += (dx / dist) * step;
    bot.position.z += (dz / dist) * step;
    bot.yaw = Math.atan2(dx, dz);
    bot.moving = true;
    return false;
  }

  function faceTarget(bot, target) {
    const tx = target === 'player' ? playerRef.position.x : target.position.x;
    const tz = target === 'player' ? playerRef.position.z : target.position.z;
    bot.yaw = Math.atan2(tx - bot.position.x, tz - bot.position.z);
  }

  function updateBot(bot, dt, now, round) {
    if (!bot.alive) {
      bot.deathT += dt;
      bot.group.rotation.x = Math.max(-Math.PI / 2, bot.group.rotation.x - dt * 3.2);
      if (bot.deathT > 1.2) bot.group.visible = false;
      return;
    }
    bot.moving = false;
    bot.group.rotation.y = bot.yaw;
    if (bot.flashT > 0) {
      bot.flashT -= dt;
      const flash = bot.flashT > 0;
      bot.torsoMesh.material.emissive.setHex(flash ? 0x881111 : 0x000000);
      bot.headMesh.material.emissive.setHex(flash ? 0x881111 : 0x000000);
    }
    // Slow walk bob.
    bot.group.position.y = bot.position.y + (bot.moving ? Math.abs(Math.sin(now * 9)) * 0.05 : 0);

    // Re-scan for a visible enemy on a short cadence.
    const seen = nearestVisibleEnemy(bot, now);
    if (seen) {
      if (bot.target !== seen.target) {
        bot.target = seen.target;
        bot.reactionAt = now + 0.35 + Math.random() * 0.45;
        bot.burstLeft = 0;
      }
      bot.state = 'engage';
      bot.lastSeen = now;
    } else if (bot.state === 'engage' && now - bot.lastSeen > 1.6) {
      bot.target = null;
      bot.state = bot.team === 'warden' ? 'hold' : 'route';
    }

    if (bot.state === 'engage' && bot.target) {
      faceTarget(bot, bot.target);
      if (now >= bot.reactionAt) {
        if (bot.burstLeft <= 0) {
          bot.burstLeft = 3 + Math.floor(Math.random() * 3);
          bot.nextShotAt = now + 0.25 + Math.random() * 0.4;
        }
        if (bot.burstLeft > 0 && now >= bot.nextShotAt) {
          bot.burstLeft -= 1;
          const dist = Math.hypot(
            (bot.target === 'player' ? playerRef.position.x : bot.target.position.x) - bot.position.x,
            (bot.target === 'player' ? playerRef.position.z : bot.target.position.z) - bot.position.z,
          );
          botShoot(bot, bot.target, now, dist);
          bot.nextShotAt = now + 0.13;
        }
      }
      return;
    }

    // Plant / defuse duties.
    if (bot.state === 'plant' && round.plantSite) {
      const site = round.plantSite;
      const arrived = moveToward(bot, site.center.x, site.center.z, dt, SPEED);
      if (arrived) {
        round.onBotPlant(bot, dt);
      }
      return;
    }
    if (bot.state === 'defuse' && round.plantedSite) {
      const site = round.plantedSite;
      const arrived = moveToward(bot, site.center.x, site.center.z, dt, SPEED);
      if (arrived) round.onBotDefuse(bot, dt);
      return;
    }
    if (bot.state === 'rotate' && round.plantedSite) {
      const site = round.plantedSite;
      moveToward(bot, site.center.x + 3, site.center.z + 3, dt, SPEED * 1.1);
      return;
    }

    // Investigate a heard shot, then resume the route.
    if (bot.state === 'investigate' && bot.hearPos) {
      const arrived = moveToward(bot, bot.hearPos.x, bot.hearPos.z, dt, SPEED * 1.15);
      if (arrived || now - bot.hearAt > 6) {
        bot.state = bot.team === 'warden' ? 'hold' : 'route';
        bot.hearPos = null;
      }
      return;
    }

    // Route following / holding.
    if (bot.team === 'ember') {
      if (bot.route.length === 0) return;
      const wp = bot.route[bot.routeIndex];
      const arrived = moveToward(bot, wp[0], wp[1], dt, SPEED);
      if (arrived) {
        bot.routeIndex = Math.min(bot.routeIndex + 1, bot.route.length - 1);
        bot.holdUntil = now + 0.6 + Math.random() * 1.2;
        bot.state = 'hold';
      }
    } else {
      if (bot.state === 'hold') {
        if (now > bot.holdUntil) {
          bot.state = 'route';
          bot.routeIndex = (bot.routeIndex + 1) % bot.route.length;
        }
        // Scan while holding: slow yaw sweep.
        bot.yaw += Math.sin(now * 0.5 + bot.index) * dt * 0.25;
        return;
      }
      if (bot.route.length === 0) return;
      const wp = bot.route[bot.routeIndex];
      const arrived = moveToward(bot, wp[0], wp[1], dt, SPEED * 0.85);
      if (arrived) {
        bot.holdUntil = now + 1.5 + Math.random() * 2.5;
        bot.state = 'hold';
      }
    }

    // Stuck detection: if barely moved in 2.5s, skip to the next waypoint.
    if (Math.hypot(bot.position.x - bot.lastPos.x, bot.position.z - bot.lastPos.z) < 0.15) {
      if (now - bot.stuckAt > 2.5) {
        bot.routeIndex = Math.min(bot.routeIndex + 1, Math.max(0, bot.route.length - 1));
        bot.stuckAt = now;
      }
    } else {
      bot.stuckAt = now;
      bot.lastPos.copy(bot.position);
    }
  }

  function step(dt, now, round) {
    for (const bot of bots) {
      updateBot(bot, dt, now, round);
      collide(bot, dt);
    }
  }

  function assignRoutes(roundNumber) {
    const ember = bots.filter((b) => b.team === 'ember' && b.alive);
    const warden = bots.filter((b) => b.team === 'warden' && b.alive);
    const lanes = ['attackA', 'attackB', 'attackMid'];
    ember.forEach((bot, i) => {
      bot.route = opts.routes[lanes[i % 3]].map((p) => [...p]);
      bot.routeIndex = 0;
      bot.state = 'route';
      bot.target = null;
    });
    const defLanes = ['defendA', 'defendB', 'defendMid'];
    warden.forEach((bot, i) => {
      bot.route = opts.routes[defLanes[i % 3]].map((p) => [...p]);
      bot.routeIndex = 0;
      bot.state = 'hold';
      bot.holdUntil = performance.now() / 1000 + i * 0.4;
      bot.target = null;
    });
    void roundNumber;
  }

  function reset(spawns) {
    for (const bot of bots) {
      bot.health = 100;
      bot.alive = true;
      bot.state = 'route';
      bot.target = null;
      bot.group.visible = true;
      bot.group.rotation.x = 0;
      bot.group.rotation.y = bot.yaw;
      bot.fade = 1;
      const spawn = bot.team === 'ember' ? spawns.attacker[bot.index] : spawns.defender[bot.index];
      bot.position.copy(spawn);
      bot.lastPos.copy(spawn);
      bot.torsoMesh.material.emissive.setHex(0x000000);
      bot.headMesh.material.emissive.setHex(0x000000);
    }
  }

  function hearShot(position, radius) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.position.x - position.x, bot.position.z - position.z);
      if (d < radius && bot.state !== 'engage') {
        bot.hearPos = position.clone();
        bot.hearAt = performance.now() / 1000;
        if (bot.state === 'route' || bot.state === 'hold') bot.state = 'investigate';
      }
    }
  }

  return {
    bots, spawnSquad, step, assignRoutes, reset, damageBot, hearShot,
    aliveCount: (team) => bots.filter((b) => b.team === team && b.alive).length,
  };
}
