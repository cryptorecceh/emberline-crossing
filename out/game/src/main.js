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

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedNum = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const rand = mulberry32(seedNum);

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error || 'error').slice(0, 300));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__errors.push(String(event.reason || 'rejection').slice(0, 300));
});

const gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
gl.setSize(window.innerWidth, window.innerHeight);
gl.shadowMap.enabled = true;
gl.shadowMap.type = THREE.PCFSoftShadowMap;
gl.toneMapping = THREE.ACESFilmicToneMapping;
gl.toneMappingExposure = 1.15;
gl.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(gl.domElement);

const stage = new THREE.Scene();
stage.background = new THREE.Color(THEME.skyHorizon);
stage.fog = new THREE.Fog(new THREE.Color(THEME.fogColor), THEME.fogNear, THEME.fogFar);
const view = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 300);
stage.add(view);
// Soft fill light riding with the camera: keeps the viewmodel readable
// without flattening the scene's long dusk shadows.
const fill = new THREE.PointLight('#ffe0b8', 2.0, 4, 1.5);
view.add(fill);

const yard = createWorld(stage);
const fx = createEffects(stage);
const hero = createPlayer(yard.colliders, ATTACKER_SPAWNS[4]);
const controls = createInput(gl.domElement, onLock);
const armory = createWeapon(view, fx);
// Touch controls (phones): dormant on desktop, live on touch devices or
// with ?touch=1. Pointer lock is never requested in touch mode.
const mobile = createTouch({
  keys: controls.state.keys,
  onLook: (dx, dy) => controls.addLook(dx, dy),
  onCycleWeapon() {
    const owned = BUY_MENU.filter((id) => armory.state.owned[id]);
    if (owned.length < 2) return;
    const cur = owned.indexOf(armory.state.current);
    armory.switchTo(owned[(cur + 1) % owned.length]);
    display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
  },
  onBuy() {
    if (match.state.phase === 'buy') display.openBuy(match.state.money, armory.state.owned);
  },
});
const touchMode = mobile.state.active;
window.__touchState = mobile.state;
const caster = new THREE.Raycaster();
caster.far = 90;
const aim = new THREE.Vector3();
const impact = new THREE.Vector3();
// Spray state: consecutive shots climb and drift in a fixed per-weapon
// pattern (CS-style); the pattern resets after a short pause.
let burst = 0;
let prevShotAt = -10;
let lookDX = 0;
let lookDY = 0;
let adsHeld = false;

let health = 100;
let vest = 25;
let points = 0;
let downs = 0;
let begun = false;
let held = false;
let clock = 0;
let bank = 0;
let prevFrame = performance.now();
let prevMag = -1;
let prevReserve = -1;
let lastDuty = 0;
let nade = null;
let nadeAt = 0;
let diedAt = -1;

const display = createHud({
  onBuy(id) {
    const before = match.state.money;
    const after = armory.buy(id, before);
    if (after !== before) {
      match.state.money = after;
      Sfx.buy();
      display.setMoney(after);
      display.openBuy(after, armory.state.owned);
      display.killfeed(`Bought ${WEAPONS[id].name}`, true);
    }
  },
});

const match = createRounds({
  onBuyPhase(round, money) {
    display.setScore(match.state.ember, match.state.warden, round, 15);
    display.setMoney(money);
    display.setObjective(round === 1 ? 'Buy weapons — round starts soon' : 'Buy phase — spend your money');
    display.openBuy(money, armory.state.owned);
    display.banner(`ROUND ${round}`, 'Buy phase — press B for the shop, 1-5 to buy', '');
  },
  onLive(round) {
    display.closeBuy();
    display.setObjective('Plant the charge on Depot (A) or Overpass (B)');
    display.banner(`ROUND ${round} — GO`, 'Plant the charge or clear the Wardens', '');
    if (!shot && !touchMode) controls.requestLock(); // Touch mode: no pointer lock.
  },
  onRoundEnd(emberWon, reason, ember, warden) {
    display.setScore(ember, warden, match.state.round, 15);
    display.setObjective(emberWon ? 'Round won — next round soon' : 'Round lost — regroup');
    display.banner(emberWon ? 'ROUND WON' : 'ROUND LOST', reason, emberWon ? 'good' : 'bad');
    if (emberWon) Sfx.roundWin(); else Sfx.roundLose();
    setTimeout(() => {
      if (match.state.matchOver) return;
      display.showOverlay('round', {
        title: emberWon ? `ROUND ${match.state.round} WON` : `ROUND ${match.state.round} LOST`,
        line: `${reason}. Score ${ember} — ${warden}.`,
      });
    }, 1400);
    controls.releaseLock();
  },
  onMatchEnd(won, ember, warden) {
    display.showOverlay('end', {
      won,
      line: `Final score ${ember} — ${warden}. ${won ? 'The Embers take Emberline Crossing.' : 'The Wardens held the yard.'}`,
    });
    if (won) Sfx.roundWin(); else Sfx.roundLose();
    controls.releaseLock();
  },
  onPlanted(site) {
    display.setObjective(`Charge planted on ${site.name} — defend it!`);
    display.banner('CHARGE PLANTED', `Defend site ${site.name} until it blows`, 'good');
    display.killfeed(`Charge planted on ${site.name}`, true);
  },
  onExplode(site) {
    fx.explode(new THREE.Vector3(site.center.x, 0.6, site.center.z));
    Sfx.explosion();
  },
  onResetRound() {
    health = 100;
    vest = 25;
    const spawn = ATTACKER_SPAWNS[4];
    hero.respawn(spawn, Math.PI);
    armory.refill();
    squad.reset({ attacker: ATTACKER_SPAWNS, defender: DEFENDER_SPAWNS });
    squad.assignRoutes(match.state.round);
    display.setHealth(health, vest);
    display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
    nade = null;
    diedAt = -1;
  },
});

// Debug hook (only with ?debug=1): exposes live state for automated tests.
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__game = { weapon: armory, input: controls, rounds: match, player: hero };
}

const squad = createBots(stage, {
  colliders: yard.colliders,
  shootables: yard.shootables,
  effects: fx,
  playerRef: hero.state,
  attackerSpawns: ATTACKER_SPAWNS,
  defenderSpawns: DEFENDER_SPAWNS,
  routes: ROUTES,
  onPlayerDamage(dmg, src) {
    if (health <= 0) return;
    const absorbed = Math.min(vest, Math.round(dmg * 0.5));
    vest -= absorbed;
    health -= (dmg - absorbed);
    display.setHealth(health, vest);
    display.damageFlash();
    if (src) {
      // Direction the damage came from, relative to where we face.
      const dx = src.x - hero.state.position.x;
      const dz = src.z - hero.state.position.z;
      const fwdX = -Math.sin(hero.state.yaw);
      const fwdZ = -Math.cos(hero.state.yaw);
      const rightX = Math.cos(hero.state.yaw);
      const rightZ = -Math.sin(hero.state.yaw);
      const along = dx * fwdX + dz * fwdZ;
      const side = dx * rightX + dz * rightZ;
      display.hitDirection((Math.atan2(side, along) * 180) / Math.PI);
    }
    Sfx.hurt();
    if (health <= 0) {
      health = 0;
      diedAt = performance.now() / 1000;
      display.killfeed('You were eliminated', false);
      controls.releaseLock();
      match.endRound(false, 'You were eliminated');
    }
  },
  onBotDown(bot, attacker) {
    const isPlayerKill = attacker && attacker.team === 'ember' && attacker === heroMarker;
    if (isPlayerKill) {
      downs += 1;
      points += 100;
      match.onKill('ember');
      display.setScore(match.state.ember, match.state.warden, match.state.round, 15);
      display.killfeed(`You eliminated ${bot.name}`, true);
      Sfx.kill();
    } else if (bot.team === 'warden') {
      display.killfeed(`${bot.name} was eliminated`, true);
    } else {
      display.killfeed(`${bot.name} was eliminated`, false);
    }
    if (bot.isCarrier && bot.team === 'ember') {
      display.killfeed('Carrier down — plant it yourself (hold E in a site)', false);
    }
    maybeEndRound();
  },
});

// Marker object identifying the player as an attacker for kill credit.
const heroMarker = { team: 'ember', position: hero.state.position };

squad.spawnSquad();
squad.assignRoutes(1);
display.setHealth(health, vest);
display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
display.setMoney(match.state.money);
display.setScore(0, 0, 1, 15);
display.setTimer(BUY_SECONDS);
display.setObjective('Buy weapons — round starts soon');
display.openBuy(match.state.money, armory.state.owned);

display.onPlay(() => {
  if (shot) return;
  Sfx.unlock();
  if (match.state.matchOver) {
    location.reload();
    return;
  }
  if (match.state.phase === 'over') {
    display.hideOverlay();
    match.nextRound();
    return;
  }
  if (!begun) {
    begun = true;
    match.beginBuy();
  }
  display.hideOverlay();
  if (!touchMode) controls.requestLock();
});

function onLock(locked) {
  if (shot) return;
  if (!locked && match.state.phase === 'live' && health > 0 && !match.state.matchOver) {
    display.showOverlay('paused');
  }
}

function syncView() {
  const body = hero.state;
  view.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  view.rotation.set(body.pitch + body.recoilPitch, body.yaw + body.recoilYaw, 0, 'YXZ');
  const ads = controls.state.ads || mobile.state.ads;
  const targetFov = armory.state.current === 'dmr' && ads ? 52 : (ads ? 66 : 74);
  if (Math.abs(view.fov - targetFov) > 0.2) {
    view.fov += (targetFov - view.fov) * 0.18;
    view.updateProjectionMatrix();
  }
}

function targets() {
  // Fresh array per shot: bot meshes merge with the world's, then drop away.
  const list = yard.shootables.slice();
  for (const bot of squad.bots) {
    if (!bot.alive) continue;
    list.push(bot.headMesh, bot.torsoMesh, bot.legMeshes[0], bot.legMeshes[1]);
  }
  return list;
}

function fire(spread) {
  if (!armory.takeRound()) {
    if (armory.state.current !== 'frag') Sfx.dryFire();
    return false;
  }
  if (armory.state.current === 'frag') {
    lobNade();
    return true;
  }
  const now = performance.now() / 1000;
  if (now - prevShotAt > 0.35) burst = 0;
  else burst += 1;
  prevShotAt = now;
  view.getWorldDirection(aim);
  aim.x += (rand() * 2 - 1) * spread;
  aim.y += (rand() * 2 - 1) * spread;
  aim.z += (rand() * 2 - 1) * spread;
  aim.normalize();
  stage.updateMatrixWorld(true);
  caster.set(view.position, aim);
  const pool = targets();
  const hit = caster.intersectObjects(pool, false)[0];
  const endPoint = hit ? hit.point.clone() : view.position.clone().addScaledVector(aim, 80);
  fx.fireTracer(armory.muzzlePosition(), endPoint);
  if (hit) {
    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0);
    if (hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const part = hit.object.userData.part || 'body';
      const d = armory.def();
      const dmg = part === 'head' ? d.damageHead : part === 'leg' ? d.damageLeg : d.damageBody;
      const killed = bot.health - dmg <= 0;
      squad.damageBot(bot, dmg, part, heroMarker);
      points += killed ? 0 : 10;
      display.setScore(match.state.ember, match.state.warden, match.state.round, 15);
      display.hitMarker(killed, part === 'head');
      if (part === 'head' && !killed) Sfx.headshot();
      else if (killed) Sfx.kill();
      else Sfx.hit();
      fx.burstSparks(hit.point, normal, 10, 4, '#ffb347');
    } else {
      fx.burstSparks(hit.point, normal, 8, 3.5, '#d8c8a8');
      fx.puff(hit.point, 0.5, '#9a8a72', 0.7);
      fx.addDecal(hit.point, normal);
    }
  }
  armory.pullTrigger();

  // Recoil pattern: the climb grows through a burst, the horizontal drift
  // follows the weapon's spray table — not random shake.
  const def = armory.def();
  const climb = def.recoilPitch * (1 + Math.min(burst, 8) * 0.07);
  const yawTable = def.sprayYaw || [0];
  const drift = (yawTable[burst % yawTable.length] || 0) * (def.recoilYaw ?? 1) * 0.004;
  hero.recoil(0.009 + climb, drift);
  squad.hearShot(hero.state.position, 26);
  display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
  Sfx.shot(armory.state.current);
  return true;
}

function lobNade() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#3a4a2a', roughness: 0.7, metalness: 0.3 }),
  );
  view.getWorldDirection(aim);
  mesh.position.copy(view.position).addScaledVector(aim, 0.6);
  mesh.position.y -= 0.1;
  stage.add(mesh);
  nade = {
    mesh,
    velocity: aim.clone().multiplyScalar(15).add(new THREE.Vector3(0, 5, 0)),
    bounces: 0,
  };
  nadeAt = performance.now() / 1000;
  Sfx.grenadePin();
  display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
}

function stepNade(delta) {
  if (!nade) return;
  nade.velocity.y -= 18 * delta;
  nade.mesh.position.addScaledVector(nade.velocity, delta);
  const p = nade.mesh.position;
  if (p.y <= 0.09) {
    p.y = 0.09;
    if (Math.abs(nade.velocity.y) > 2 && nade.bounces < 2) {
      nade.velocity.y *= -0.42;
      nade.velocity.x *= 0.7;
      nade.velocity.z *= 0.7;
      nade.bounces += 1;
    } else {
      nade.velocity.set(0, 0, 0);
    }
  }
  if (performance.now() / 1000 - nadeAt > 1.7) {
    const point = nade.mesh.position.clone();
    stage.remove(nade.mesh);
    nade = null;
    fx.explode(point);
    Sfx.explosion();
    // Area damage with falloff.
    for (const bot of squad.bots) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.position.x - point.x, bot.position.z - point.z);
      if (d < 7) {
        const dmg = Math.round(120 * (1 - d / 7) + 20);
        squad.damageBot(bot, dmg, 'body', heroMarker);
      }
    }
    const pd = Math.hypot(hero.state.position.x - point.x, hero.state.position.z - point.z);
    if (pd < 5 && health > 0) {
      const dmg = Math.round(70 * (1 - pd / 5) + 10);
      health = Math.max(0, health - dmg);
      display.setHealth(health, vest);
      display.damageFlash();
    }
  }
}

function maybeEndRound() {
  if (match.state.phase !== 'live' && match.state.phase !== 'planted') return;
  if (squad.aliveCount('warden') === 0) {
    match.endRound(true, 'Enemy team eliminated');
  } else if (squad.aliveCount('ember') === 0 && health <= 0) {
    match.endRound(false, 'Ember team eliminated');
  }
}

function siteInfo() {
  let inSite = null;
  let nearCharge = false;
  for (const site of SITES) {
    const d = Math.hypot(hero.state.position.x - site.center.x, hero.state.position.z - site.center.z);
    if (d < site.radius) inSite = site;
    if (match.state.plantedSite === site && d < 4) nearCharge = true;
  }
  return { inSite, nearCharge };
}

function tick(delta) {
  clock += delta;
  if (!begun) {
    // Before Play the round timer must not run; only ambience animates.
    fx.step(delta, clock);
    return;
  }
  const now = performance.now() / 1000;
  match.step(delta);
  if (match.state.phase === 'live' || match.state.phase === 'planted') {
    if (now - lastDuty > 1) {
      lastDuty = now;
      match.assignBotDuties(squad.bots);
    }
    hero.step(delta, controls.state.keys, armory.state.ads, mobile.state.moveVec);
    squad.step(delta, now, match);
    stepNade(delta);
    const { inSite, nearCharge } = siteInfo();
    if (controls.state.keys.has('KeyE')) {
      if (match.state.phase === 'live' && inSite) match.playerPlant(delta, inSite);
      if (match.state.phase === 'planted' && nearCharge) match.playerDefuse(delta, nearCharge);
    } else {
      match.state.plantProgress = 0;
      match.state.defuseProgress = 0;
    }
    const planting = match.state.phase === 'live' && controls.state.keys.has('KeyE') && inSite;
    const defusing = match.state.phase === 'planted' && controls.state.keys.has('KeyE') && nearCharge;
    if (planting) display.setProgress('plant', match.state.plantProgress);
    else if (defusing) display.setProgress('defuse', match.state.defuseProgress);
    else display.setProgress(null, 0);
    display.setTimer(match.state.phase === 'planted' ? match.state.fuse : match.state.timer);
    display.setCrosshair(6 + armory.spread(hero.groundSpeed()) * 900);
    display.minimapDraw(hero.state, squad.bots, SITES, match.state.plantedSite);
  } else if (match.state.phase === 'buy') {
    hero.step(delta, controls.state.keys, armory.state.ads, mobile.state.moveVec);
    display.setTimer(match.state.timer);
    display.minimapDraw(hero.state, squad.bots, SITES, null);
  }
  armory.step(delta, now, (controls.state.ads || mobile.state.ads) ? 1 : 0, lookDX, lookDY);
  // Ammo HUD refresh: a reload finishes inside weapon.step() with no event
  // of its own — without this the display stays stale after reloading.
  if (armory.state.mag !== prevMag || armory.state.reserve !== prevReserve) {
    display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
    prevMag = armory.state.mag;
    prevReserve = armory.state.reserve;
  }
  fx.step(delta, clock);
}

let bWasDown = false;
function loop(now) {
  requestAnimationFrame(loop);
  const delta = Math.min((now - prevFrame) / 1000, 0.1);
  prevFrame = now;
  if (!held) {
    const look = controls.takeLook();
    lookDX = look.x;
    lookDY = look.y;
    hero.look(look.x, look.y);
    const adsNow = controls.state.ads || mobile.state.ads;
    if (adsNow && !adsHeld) Sfx.ads();
    adsHeld = adsNow;
    display.setScope(armory.state.current === 'dmr' && armory.state.ads > 0.6);
    if ((controls.state.firing || mobile.state.firing) && armory.ready() && health > 0 && match.state.phase !== 'buy') {
      fire(armory.spread(hero.groundSpeed()));
    }
    if (controls.state.keys.has('KeyR') && armory.reload()) Sfx.reload();
    if (controls.state.keys.has('Digit1')) armory.switchTo('sidearm');
    if (controls.state.keys.has('Digit2')) armory.switchTo('smg');
    if (controls.state.keys.has('Digit3')) armory.switchTo('rifle');
    if (controls.state.keys.has('Digit4')) armory.switchTo('dmr');
    if (controls.state.keys.has('Digit5')) armory.switchTo('frag');
    const bDown = controls.state.keys.has('KeyB');
    if (bDown && !bWasDown && match.state.phase === 'buy') {
      display.openBuy(match.state.money, armory.state.owned);
      controls.releaseLock();
    }
    bWasDown = bDown;
    bank += delta;
    let steps = 0;
    while (bank >= STEP && steps < 5) {
      tick(STEP);
      bank -= STEP;
      steps += 1;
    }
    if (bank > STEP * 5) bank = 0;
    syncView();
  }
  gl.render(stage, view);
}

function warmup(steps) {
  for (let i = 0; i < steps; i += 1) tick(STEP);
}

function stageShot(name) {
  begun = true;
  display.hideOverlay();
  display.closeBuy();
  hero.state.yaw = 0;
  hero.state.pitch = 0;
  match.beginBuy();
  if (name !== 'buy') display.closeBuy(); // beginBuy's hook opens the shop; only the buy shot keeps it.
  display.clearBanner(); // Staged frames are frozen before the banner's timer fires.
  // Stage the round so the frame reads as a real game, not a menu.
  match.state.money = 2750;
  armory.state.owned = { sidearm: true, rifle: true };
  armory.switchTo('rifle');
  armory.refill();
  display.setMoney(2750);
  display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
  if (name === 'start' || name === 'touch') {
    hero.state.position.set(11, 0, 13);
    warmup(20);
    const target = new THREE.Vector3(-2, 2.5, -14);
    const dx = target.x - hero.state.position.x;
    const dy = target.y - (hero.state.position.y + hero.state.eye);
    const dz = target.z - hero.state.position.z;
    hero.state.yaw = Math.atan2(-dx, -dz);
    hero.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    display.showOverlay('start');
  } else if (name === 'buy') {
    hero.state.position.set(0, 0, 12);
    warmup(20);
    hero.state.yaw = Math.PI;
    display.openBuy(match.state.money, armory.state.owned);
    display.setObjective('Buy phase — spend your money');
  } else if (name === 'play') {
    match.beginLive();
    warmup(150); // Let the ROUND 1 — GO banner fade before the capture.
    health = 100;
    vest = 25;
    display.setHealth(health, vest);
    hero.state.position.set(0, 0, 10);
    warmup(20);
    // Fire twice at the nearest visible Warden for muzzle flash + hitmarker.
    const target = squad.bots.find((b) => b.team === 'warden' && b.alive);
    if (target) {
      target.position.set(0.5, 0, 2.5); // Open plaza south of the block: no cover between.
      const dx = target.position.x - hero.state.position.x;
      const dy = 1.3 - hero.state.eye;
      const dz = target.position.z - hero.state.position.z;
      hero.state.yaw = Math.atan2(-dx, -dz);
      hero.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
      syncView();
      fire(0);
      warmup(6);
      fire(0);
      warmup(4);
    }
    display.setObjective('Plant the charge on Depot (A) or Overpass (B)');
  } else if (name === 'ads') {
    // DMR aim-down-sights close-up: scoped view, muzzle flash, tracer.
    match.beginLive();
    warmup(150);
    health = 100;
    vest = 25;
    display.setHealth(health, vest);
    armory.state.owned = { sidearm: true, rifle: true, dmr: true };
    armory.switchTo('dmr');
    armory.refill();
    display.setAmmo(armory.state.mag, armory.state.reserve, armory.def().name);
    hero.state.position.set(0, 0, 10);
    controls.state.ads = true;
    warmup(30); // Let the ADS ease converge before the capture.
    armory.state.ads = 1;
    const target = squad.bots.find((b) => b.team === 'warden' && b.alive);
    if (target) {
      target.position.set(0.5, 0, 2.5);
      const dx = target.position.x - hero.state.position.x;
      const dy = 1.3 - hero.state.eye;
      const dz = target.position.z - hero.state.position.z;
      hero.state.yaw = Math.atan2(-dx, -dz);
      hero.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
      syncView();
      view.fov = 52;
      view.updateProjectionMatrix();
      fire(0);
      warmup(2);
    }
    display.setScope(true);
    display.setObjective('Plant the charge on Depot (A) or Overpass (B)');
  } else if (name === 'site') {
    // Site A close-up: the Depot warehouse, dock and props. Camera stands
    // west of mid so the central block does not hide the warehouse.
    hero.state.position.set(-10, 0, -6);
    warmup(20);
    const dx = -15 - hero.state.position.x;
    const dy = 2.5 - hero.state.eye;
    const dz = -18.9 - hero.state.position.z;
    hero.state.yaw = Math.atan2(-dx, -dz);
    hero.state.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    display.setObjective('Site A — Depot warehouse');
  } else {
    match.state.ember = 7;
    match.state.warden = 5;
    match.state.round = 13;
    display.setScore(7, 5, 13, 15);
    display.setObjective('Match point — one more round');
    hero.state.position.set(-4, 0, 6);
    warmup(20);
    hero.state.yaw = Math.PI * 0.9;
    display.showOverlay('round', {
      title: 'ROUND 12 WON',
      line: 'Enemy team eliminated. Score 7 — 5.',
    });
  }
  display.setScore(match.state.ember, match.state.warden, match.state.round, 15);
  display.setTimer(match.state.phase === 'planted' ? match.state.fuse : match.state.timer);
  display.clearBanner(); // The live branch re-banners; the frozen frame must not show it.
  paintTwice();
}

function paintTwice() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncView();
    gl.render(stage, view);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      held = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  view.aspect = window.innerWidth / window.innerHeight;
  view.updateProjectionMatrix();
  gl.setSize(window.innerWidth, window.innerHeight);
});

display.showOverlay('start');
// Touch hint must be set AFTER showOverlay: the start branch hides it.
if (touchMode) {
  const extra = document.getElementById('overlay-extra');
  extra.hidden = false;
  extra.textContent = 'Mode sentuh: joystick kiri untuk gerak, geser area kanan untuk melihat, tombol TEMBAK untuk menembak, ADS untuk membidik.';
}
syncView();
if (shot) stageShot(shot);
else requestAnimationFrame(loop);

void MAP;
void THEME_ID;
