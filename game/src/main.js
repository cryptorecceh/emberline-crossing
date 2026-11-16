// Emberline Crossing — boot and the one loop: a fixed 60 Hz simulation feeding
// a render at the display's rate. ?shot=start|buy|play|end with &seed=N sets
// up a deterministic frame for a capture, renders it twice, then freezes it
// and sets window.__shotReady. ?theme=dusk|neon|mist picks the art direction.
import * as THREE from 'three';
import { THEME, THEME_ID } from './palette.js';
import { mulberry32 } from './textures.js';
import { createWorld, MAP, SITES, ATTACKER_SPAWNS, DEFENDER_SPAWNS, ROUTES } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS, BUY_MENU } from './weapon.js';
import { createTouch } from './touch.js';
import { createBots } from './bots.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createRounds, BUY_SECONDS } from './rounds.js';
import { Sfx } from './audio.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = mulberry32(seed);

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error || 'error').slice(0, 300));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__errors.push(String(event.reason || 'rejection').slice(0, 300));
});

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(THEME.skyHorizon);
scene.fog = new THREE.Fog(new THREE.Color(THEME.fogColor), THEME.fogNear, THEME.fogFar);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 300);
scene.add(camera);
// Soft fill light riding with the camera: keeps the viewmodel readable
// without flattening the scene's long dusk shadows.
const viewLight = new THREE.PointLight('#ffe0b8', 2.0, 4, 1.5);
camera.add(viewLight);

const world = createWorld(scene);
const effects = createEffects(scene);
const player = createPlayer(world.colliders, ATTACKER_SPAWNS[4]);
const input = createInput(renderer.domElement, onLockChange);
const weapon = createWeapon(camera, effects);
// Touch controls (phones): dormant on desktop, live on touch devices or
// with ?touch=1. Pointer lock is never requested in touch mode.
const touch = createTouch({
  keys: input.state.keys,
  onLook: (dx, dy) => input.addLook(dx, dy),
  onCycleWeapon() {
    const owned = BUY_MENU.filter((id) => weapon.state.owned[id]);
    if (owned.length < 2) return;
    const cur = owned.indexOf(weapon.state.current);
    weapon.switchTo(owned[(cur + 1) % owned.length]);
    hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
  },
  onBuy() {
    if (rounds.state.phase === 'buy') hud.openBuy(rounds.state.money, weapon.state.owned);
  },
});
const touchMode = touch.state.active;
window.__touchState = touch.state;
const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const direction = new THREE.Vector3();
const tmpPoint = new THREE.Vector3();
// Spray state: consecutive shots climb and drift in a fixed per-weapon
// pattern (CS-style); the pattern resets after a short pause.
let sprayIndex = 0;
let lastShotAt = -10;
let lookDx = 0;
let lookDy = 0;
let prevAds = false;

let hp = 100;
let armor = 25;
let score = 0;
let kills = 0;
let started = false;
let frozen = false;
let elapsed = 0;
let accumulator = 0;
let lastTime = performance.now();
let lastAmmoMag = -1;
let lastAmmoReserve = -1;
let dutiesAt = 0;
let grenade = null;
let grenadeAt = 0;
let deadAt = -1;

const hud = createHud({
  onBuy(id) {
    const before = rounds.state.money;
    const after = weapon.buy(id, before);
    if (after !== before) {
      rounds.state.money = after;
      Sfx.buy();
      hud.setMoney(after);
      hud.openBuy(after, weapon.state.owned);
      hud.killfeed(`Bought ${WEAPONS[id].name}`, true);
    }
  },
});

const rounds = createRounds({
  onBuyPhase(round, money) {
    hud.setScore(rounds.state.ember, rounds.state.warden, round, 15);
    hud.setMoney(money);
    hud.setObjective(round === 1 ? 'Buy weapons — round starts soon' : 'Buy phase — spend your money');
    hud.openBuy(money, weapon.state.owned);
    hud.banner(`ROUND ${round}`, 'Buy phase — press B for the shop, 1-5 to buy', '');
  },
  onLive(round) {
    hud.closeBuy();
    hud.setObjective('Plant the charge on Depot (A) or Overpass (B)');
    hud.banner(`ROUND ${round} — GO`, 'Plant the charge or clear the Wardens', '');
    if (!shot && !touchMode) input.requestLock(); // Touch mode: no pointer lock.
  },
  onRoundEnd(emberWon, reason, ember, warden) {
    hud.setScore(ember, warden, rounds.state.round, 15);
    hud.setObjective(emberWon ? 'Round won — next round soon' : 'Round lost — regroup');
    hud.banner(emberWon ? 'ROUND WON' : 'ROUND LOST', reason, emberWon ? 'good' : 'bad');
    if (emberWon) Sfx.roundWin(); else Sfx.roundLose();
    setTimeout(() => {
      if (rounds.state.matchOver) return;
      hud.showOverlay('round', {
        title: emberWon ? `ROUND ${rounds.state.round} WON` : `ROUND ${rounds.state.round} LOST`,
        line: `${reason}. Score ${ember} — ${warden}.`,
      });
    }, 1400);
    input.releaseLock();
  },
  onMatchEnd(won, ember, warden) {
    hud.showOverlay('end', {
      won,
      line: `Final score ${ember} — ${warden}. ${won ? 'The Embers take Emberline Crossing.' : 'The Wardens held the yard.'}`,
    });
    if (won) Sfx.roundWin(); else Sfx.roundLose();
    input.releaseLock();
  },
  onPlanted(site) {
    hud.setObjective(`Charge planted on ${site.name} — defend it!`);
    hud.banner('CHARGE PLANTED', `Defend site ${site.name} until it blows`, 'good');
    hud.killfeed(`Charge planted on ${site.name}`, true);
  },
  onExplode(site) {
    effects.explode(new THREE.Vector3(site.center.x, 0.6, site.center.z));
    Sfx.explosion();
  },
  onResetRound() {
    hp = 100;
    armor = 25;
    const spawn = ATTACKER_SPAWNS[4];
    player.respawn(spawn, Math.PI);
    weapon.refill();
    bots.reset({ attacker: ATTACKER_SPAWNS, defender: DEFENDER_SPAWNS });
    bots.assignRoutes(rounds.state.round);
    hud.setHealth(hp, armor);
    hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
    grenade = null;
    deadAt = -1;
  },
});

// Debug hook (only with ?debug=1): exposes live state for automated tests.
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__game = { weapon, input, rounds, player };
}

const bots = createBots(scene, {
  colliders: world.colliders,
  shootables: world.shootables,
  effects,
  playerRef: player.state,
  attackerSpawns: ATTACKER_SPAWNS,
  defenderSpawns: DEFENDER_SPAWNS,
  routes: ROUTES,
  onPlayerDamage(amount, fromPos) {
    if (hp <= 0) return;
    const absorbed = Math.min(armor, Math.round(amount * 0.5));
    armor -= absorbed;
    hp -= (amount - absorbed);
    hud.setHealth(hp, armor);
    hud.damageFlash();
    if (fromPos) {
      // Direction the damage came from, relative to where we face.
      const dx = fromPos.x - player.state.position.x;
      const dz = fromPos.z - player.state.position.z;
      const fwdX = -Math.sin(player.state.yaw);
      const fwdZ = -Math.cos(player.state.yaw);
      const rightX = Math.cos(player.state.yaw);
      const rightZ = -Math.sin(player.state.yaw);
      const along = dx * fwdX + dz * fwdZ;
      const side = dx * rightX + dz * rightZ;
      hud.hitDirection((Math.atan2(side, along) * 180) / Math.PI);
    }
    Sfx.hurt();
    if (hp <= 0) {
      hp = 0;
      deadAt = performance.now() / 1000;
      hud.killfeed('You were eliminated', false);
      input.releaseLock();
      rounds.endRound(false, 'You were eliminated');
    }
  },
  onBotDown(bot, attacker) {
    const isPlayerKill = attacker && attacker.team === 'ember' && attacker === playerRefMarker;
    if (isPlayerKill) {
      kills += 1;
      score += 100;
      rounds.onKill('ember');
      hud.setScore(rounds.state.ember, rounds.state.warden, rounds.state.round, 15);
      hud.killfeed(`You eliminated ${bot.name}`, true);
      Sfx.kill();
    } else if (bot.team === 'warden') {
      hud.killfeed(`${bot.name} was eliminated`, true);
    } else {
      hud.killfeed(`${bot.name} was eliminated`, false);
    }
    if (bot.isCarrier && bot.team === 'ember') {
      hud.killfeed('Carrier down — plant it yourself (hold E in a site)', false);
    }
    checkRoundEnd();
  },
});

// Marker object identifying the player as an attacker for kill credit.
const playerRefMarker = { team: 'ember', position: player.state.position };

bots.spawnSquad();
bots.assignRoutes(1);
hud.setHealth(hp, armor);
hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
hud.setMoney(rounds.state.money);
hud.setScore(0, 0, 1, 15);
hud.setTimer(BUY_SECONDS);
hud.setObjective('Buy weapons — round starts soon');
hud.openBuy(rounds.state.money, weapon.state.owned);

hud.onPlay(() => {
  if (shot) return;
  Sfx.unlock();
  if (rounds.state.matchOver) {
    location.reload();
    return;
  }
  if (rounds.state.phase === 'over') {
    hud.hideOverlay();
    rounds.nextRound();
    return;
  }
  if (!started) {
    started = true;
    rounds.beginBuy();
  }
  hud.hideOverlay();
  if (!touchMode) input.requestLock();
});

function onLockChange(locked) {
  if (shot) return;
  if (!locked && rounds.state.phase === 'live' && hp > 0 && !rounds.state.matchOver) {
    hud.showOverlay('paused');
  }
}

function syncCamera() {
  const body = player.state;
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch + body.recoilPitch, body.yaw + body.recoilYaw, 0, 'YXZ');
  const ads = input.state.ads || touch.state.ads;
  const targetFov = weapon.state.current === 'dmr' && ads ? 52 : (ads ? 66 : 74);
  if (Math.abs(camera.fov - targetFov) > 0.2) {
    camera.fov += (targetFov - camera.fov) * 0.18;
    camera.updateProjectionMatrix();
  }
}

function shootables() {
  // Fresh array per shot: bot meshes merge with the world's, then drop away.
  const list = world.shootables.slice();
  for (const bot of bots.bots) {
    if (!bot.alive) continue;
    list.push(bot.headMesh, bot.torsoMesh, bot.legMeshes[0], bot.legMeshes[1]);
  }
  return list;
}

function shoot(spread) {
  if (!weapon.takeRound()) {
    if (weapon.state.current !== 'frag') Sfx.dryFire();
    return false;
  }
  if (weapon.state.current === 'frag') {
    throwGrenade();
    return true;
  }
  const now = performance.now() / 1000;
  if (now - lastShotAt > 0.35) sprayIndex = 0;
  else sprayIndex += 1;
  lastShotAt = now;
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const pool = shootables();
  const hit = raycaster.intersectObjects(pool, false)[0];
  const endPoint = hit ? hit.point.clone() : camera.position.clone().addScaledVector(direction, 80);
  effects.fireTracer(weapon.muzzlePosition(), endPoint);
  if (hit) {
    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0);
    if (hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const part = hit.object.userData.part || 'body';
      const d = weapon.def();
      const dmg = part === 'head' ? d.damageHead : part === 'leg' ? d.damageLeg : d.damageBody;
      const killed = bot.health - dmg <= 0;
      bots.damageBot(bot, dmg, part, playerRefMarker);
      score += killed ? 0 : 10;
      hud.setScore(rounds.state.ember, rounds.state.warden, rounds.state.round, 15);
      hud.hitMarker(killed, part === 'head');
      if (part === 'head' && !killed) Sfx.headshot();
      else if (killed) Sfx.kill();
      else Sfx.hit();
      effects.burstSparks(hit.point, normal, 10, 4, '#ffb347');
    } else {
      effects.burstSparks(hit.point, normal, 8, 3.5, '#d8c8a8');
      effects.puff(hit.point, 0.5, '#9a8a72', 0.7);
      effects.addDecal(hit.point, normal);
    }
  }
  weapon.pullTrigger();
  // Recoil pattern: the climb grows through a burst, the horizontal drift
  // follows the weapon's spray table — not random shake.
  const def = weapon.def();
  const climb = def.recoilPitch * (1 + Math.min(sprayIndex, 8) * 0.07);
  const yawTable = def.sprayYaw || [0];
  const drift = (yawTable[sprayIndex % yawTable.length] || 0) * (def.recoilYaw ?? 1) * 0.004;
  player.recoil(0.009 + climb, drift);
  bots.hearShot(player.state.position, 26);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
  Sfx.shot(weapon.state.current);
  return true;
}

function throwGrenade() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#3a4a2a', roughness: 0.7, metalness: 0.3 }),
  );
  camera.getWorldDirection(direction);
  mesh.position.copy(camera.position).addScaledVector(direction, 0.6);
  mesh.position.y -= 0.1;
  scene.add(mesh);
  grenade = {
    mesh,
    velocity: direction.clone().multiplyScalar(15).add(new THREE.Vector3(0, 5, 0)),
    bounces: 0,
  };
  grenadeAt = performance.now() / 1000;
  Sfx.grenadePin();
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
}

function updateGrenade(dt) {
  if (!grenade) return;
  grenade.velocity.y -= 18 * dt;
  grenade.mesh.position.addScaledVector(grenade.velocity, dt);
  const p = grenade.mesh.position;
  if (p.y <= 0.09) {
    p.y = 0.09;
    if (Math.abs(grenade.velocity.y) > 2 && grenade.bounces < 2) {
      grenade.velocity.y *= -0.42;
      grenade.velocity.x *= 0.7;
      grenade.velocity.z *= 0.7;
      grenade.bounces += 1;
    } else {
      grenade.velocity.set(0, 0, 0);
    }
  }
  if (performance.now() / 1000 - grenadeAt > 1.7) {
    const point = grenade.mesh.position.clone();
    scene.remove(grenade.mesh);
    grenade = null;
    effects.explode(point);
    Sfx.explosion();
    // Area damage with falloff.
    for (const bot of bots.bots) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.position.x - point.x, bot.position.z - point.z);
      if (d < 7) {
        const dmg = Math.round(120 * (1 - d / 7) + 20);
        bots.damageBot(bot, dmg, 'body', playerRefMarker);
      }
    }
    const pd = Math.hypot(player.state.position.x - point.x, player.state.position.z - point.z);
    if (pd < 5 && hp > 0) {
      const dmg = Math.round(70 * (1 - pd / 5) + 10);
      hp = Math.max(0, hp - dmg);
      hud.setHealth(hp, armor);
      hud.damageFlash();
    }
  }
}

function checkRoundEnd() {
  if (rounds.state.phase !== 'live' && rounds.state.phase !== 'planted') return;
  if (bots.aliveCount('warden') === 0) {
    rounds.endRound(true, 'Enemy team eliminated');
  } else if (bots.aliveCount('ember') === 0 && hp <= 0) {
    rounds.endRound(false, 'Ember team eliminated');
  }
}

function playerSiteInfo() {
  let inSite = null;
  let nearCharge = false;
  for (const site of SITES) {
    const d = Math.hypot(player.state.position.x - site.center.x, player.state.position.z - site.center.z);
    if (d < site.radius) inSite = site;
    if (rounds.state.plantedSite === site && d < 4) nearCharge = true;
  }
  return { inSite, nearCharge };
}

function step(dt) {
  elapsed += dt;
  if (!started) {
    // Before Play the round timer must not run; only ambience animates.
    effects.step(dt, elapsed);
    return;
  }
  const now = performance.now() / 1000;
  rounds.step(dt);
  if (rounds.state.phase === 'live' || rounds.state.phase === 'planted') {
    if (now - dutiesAt > 1) {
      dutiesAt = now;
      rounds.assignBotDuties(bots.bots);
    }
    player.step(dt, input.state.keys, weapon.state.ads, touch.state.moveVec);
    bots.step(dt, now, rounds);
    updateGrenade(dt);
    const { inSite, nearCharge } = playerSiteInfo();
    if (input.state.keys.has('KeyE')) {
      if (rounds.state.phase === 'live' && inSite) rounds.playerPlant(dt, inSite);
      if (rounds.state.phase === 'planted' && nearCharge) rounds.playerDefuse(dt, nearCharge);
    } else {
      rounds.state.plantProgress = 0;
      rounds.state.defuseProgress = 0;
    }
    const planting = rounds.state.phase === 'live' && input.state.keys.has('KeyE') && inSite;
    const defusing = rounds.state.phase === 'planted' && input.state.keys.has('KeyE') && nearCharge;
    if (planting) hud.setProgress('plant', rounds.state.plantProgress);
    else if (defusing) hud.setProgress('defuse', rounds.state.defuseProgress);
    else hud.setProgress(null, 0);
    hud.setTimer(rounds.state.phase === 'planted' ? rounds.state.fuse : rounds.state.timer);
    hud.setCrosshair(6 + weapon.spread(player.groundSpeed()) * 900);
    hud.minimapDraw(player.state, bots.bots, SITES, rounds.state.plantedSite);
  } else if (rounds.state.phase === 'buy') {
    player.step(dt, input.state.keys, weapon.state.ads, touch.state.moveVec);
    hud.setTimer(rounds.state.timer);
    hud.minimapDraw(player.state, bots.bots, SITES, null);
  }
  weapon.step(dt, now, (input.state.ads || touch.state.ads) ? 1 : 0, lookDx, lookDy);
  // Ammo HUD refresh: a reload finishes inside weapon.step() with no event
  // of its own — without this the display stays stale after reloading.
  if (weapon.state.mag !== lastAmmoMag || weapon.state.reserve !== lastAmmoReserve) {
    hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
    lastAmmoMag = weapon.state.mag;
    lastAmmoReserve = weapon.state.reserve;
  }
  effects.step(dt, elapsed);
}

let prevB = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    lookDx = look.x;
    lookDy = look.y;
    player.look(look.x, look.y);
    const adsNow = input.state.ads || touch.state.ads;
    if (adsNow && !prevAds) Sfx.ads();
    prevAds = adsNow;
    hud.setScope(weapon.state.current === 'dmr' && weapon.state.ads > 0.6);
    if ((input.state.firing || touch.state.firing) && weapon.ready() && hp > 0 && rounds.state.phase !== 'buy') {
      shoot(weapon.spread(player.groundSpeed()));
    }
    if (input.state.keys.has('KeyR') && weapon.reload()) Sfx.reload();
    if (input.state.keys.has('Digit1')) weapon.switchTo('sidearm');
    if (input.state.keys.has('Digit2')) weapon.switchTo('smg');
    if (input.state.keys.has('Digit3')) weapon.switchTo('rifle');
    if (input.state.keys.has('Digit4')) weapon.switchTo('dmr');
    if (input.state.keys.has('Digit5')) weapon.switchTo('frag');
    const bDown = input.state.keys.has('KeyB');
    if (bDown && !prevB && rounds.state.phase === 'buy') {
      hud.openBuy(rounds.state.money, weapon.state.owned);
      input.releaseLock();
    }
    prevB = bDown;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function runShot(name) {
  started = true;
  hud.hideOverlay();
  hud.closeBuy();
  player.state.yaw = 0;
  player.state.pitch = 0;
  rounds.beginBuy();
  if (name !== 'buy') hud.closeBuy(); // beginBuy's hook opens the shop; only the buy shot keeps it.
  hud.clearBanner(); // Staged frames are frozen before the banner's timer fires.
  // Stage the round so the frame reads as a real game, not a menu.
  rounds.state.money = 2750;
  weapon.state.owned = { sidearm: true, rifle: true };
  weapon.switchTo('rifle');
  weapon.refill();
  hud.setMoney(2750);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
  if (name === 'start' || name === 'touch') {
    player.state.position.set(11, 0, 13);
    settle(20);
    const target = new THREE.Vector3(-2, 2.5, -14);
    const dx = target.x - player.state.position.x;
    const dy = target.y - (player.state.position.y + player.state.eye);
    const dz = target.z - player.state.position.z;
    player.state.yaw = Math.atan2(-dx, -dz);
    player.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    hud.showOverlay('start');
  } else if (name === 'buy') {
    player.state.position.set(0, 0, 12);
    settle(20);
    player.state.yaw = Math.PI;
    hud.openBuy(rounds.state.money, weapon.state.owned);
    hud.setObjective('Buy phase — spend your money');
  } else if (name === 'play') {
    rounds.beginLive();
    settle(150); // Let the ROUND 1 — GO banner fade before the capture.
    hp = 100;
    armor = 25;
    hud.setHealth(hp, armor);
    player.state.position.set(0, 0, 10);
    settle(20);
    // Fire twice at the nearest visible Warden for muzzle flash + hitmarker.
    const target = bots.bots.find((b) => b.team === 'warden' && b.alive);
    if (target) {
      target.position.set(0.5, 0, 2.5); // Open plaza south of the block: no cover between.
      const dx = target.position.x - player.state.position.x;
      const dy = 1.3 - player.state.eye;
      const dz = target.position.z - player.state.position.z;
      player.state.yaw = Math.atan2(-dx, -dz);
      player.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
      syncCamera();
      shoot(0);
      settle(6);
      shoot(0);
      settle(4);
    }
    hud.setObjective('Plant the charge on Depot (A) or Overpass (B)');
  } else if (name === 'ads') {
    // DMR aim-down-sights close-up: scoped view, muzzle flash, tracer.
    rounds.beginLive();
    settle(150);
    hp = 100;
    armor = 25;
    hud.setHealth(hp, armor);
    weapon.state.owned = { sidearm: true, rifle: true, dmr: true };
    weapon.switchTo('dmr');
    weapon.refill();
    hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
    player.state.position.set(0, 0, 10);
    input.state.ads = true;
    settle(30); // Let the ADS ease converge before the capture.
    weapon.state.ads = 1;
    const target = bots.bots.find((b) => b.team === 'warden' && b.alive);
    if (target) {
      target.position.set(0.5, 0, 2.5);
      const dx = target.position.x - player.state.position.x;
      const dy = 1.3 - player.state.eye;
      const dz = target.position.z - player.state.position.z;
      player.state.yaw = Math.atan2(-dx, -dz);
      player.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
      syncCamera();
      camera.fov = 52;
      camera.updateProjectionMatrix();
      shoot(0);
      settle(2);
    }
    hud.setScope(true);
    hud.setObjective('Plant the charge on Depot (A) or Overpass (B)');
  } else if (name === 'site') {
    // Site A close-up: the Depot warehouse, dock and props. Camera stands
    // west of mid so the central block does not hide the warehouse.
    player.state.position.set(-10, 0, -6);
    settle(20);
    const dx = -15 - player.state.position.x;
    const dy = 2.5 - player.state.eye;
    const dz = -18.9 - player.state.position.z;
    player.state.yaw = Math.atan2(-dx, -dz);
    player.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    hud.setObjective('Site A — Depot warehouse');
  } else {
    rounds.state.ember = 7;
    rounds.state.warden = 5;
    rounds.state.round = 13;
    hud.setScore(7, 5, 13, 15);
    hud.setObjective('Match point — one more round');
    player.state.position.set(-4, 0, 6);
    settle(20);
    player.state.yaw = Math.PI * 0.9;
    hud.showOverlay('round', {
      title: 'ROUND 12 WON',
      line: 'Enemy team eliminated. Score 7 — 5.',
    });
  }
  hud.setScore(rounds.state.ember, rounds.state.warden, rounds.state.round, 15);
  hud.setTimer(rounds.state.phase === 'planted' ? rounds.state.fuse : rounds.state.timer);
  hud.clearBanner(); // The live branch re-banners; the frozen frame must not show it.
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.showOverlay('start');
// Touch hint must be set AFTER showOverlay: the start branch hides it.
if (touchMode) {
  const extra = document.getElementById('overlay-extra');
  extra.hidden = false;
  extra.textContent = 'Mode sentuh: joystick kiri untuk gerak, geser area kanan untuk melihat, tombol TEMBAK untuk menembak, ADS untuk membidik.';
}
syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);

void MAP;
void THEME_ID;
