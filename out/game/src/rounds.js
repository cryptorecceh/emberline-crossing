// Emberline Crossing — rounds. Buy phase, live round, plant/defuse, economy
// and match end. One state machine owns every round fact; main.js only reads
// it and draws it.
import { SITES } from './world.js';
import { Sfx } from './audio.js';

export const BUY_SECONDS = 18;
export const ROUND_SECONDS = 100;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 5;
export const FUSE_SECONDS = 40;
export const MAX_ROUNDS = 15;
export const WIN_ROUNDS = 8;

const WIN_MONEY = 3250;
const LOSS_MONEY = 1900;
const KILL_MONEY = 300;
const PLANT_MONEY = 300;

export function createRounds(hooks) {
  const state = {
    phase: 'buy', // buy | live | planted | over
    round: 1,
    ember: 0,
    warden: 0,
    money: 800,
    timer: BUY_SECONDS,
    plantSite: null,
    plantedSite: null,
    plantProgress: 0,
    defuseProgress: 0,
    fuse: 0,
    plantingBot: null,
    defusingBot: null,
    matchOver: false,
    winner: null,
  };

  function beginBuy() {
    state.phase = 'buy';
    state.timer = BUY_SECONDS;
    state.plantSite = null;
    state.plantedSite = null;
    state.plantProgress = 0;
    state.defuseProgress = 0;
    state.fuse = 0;
    state.plantingBot = null;
    state.defusingBot = null;
    hooks.onBuyPhase(state.round, state.money);
  }

  function beginLive() {
    state.phase = 'live';
    state.timer = ROUND_SECONDS;
    // Pick the plant target: the carrier's lane decides the site.
    state.plantSite = SITES[Math.random() < 0.5 ? 0 : 1];
    hooks.onLive(state.round);
  }

  function endRound(emberWon, reason) {
    if (state.phase === 'over') return;
    state.phase = 'over';
    if (emberWon) {
      state.ember += 1;
      state.money += WIN_MONEY;
    } else {
      state.warden += 1;
      state.money += LOSS_MONEY;
    }
    if (state.ember >= WIN_ROUNDS || state.warden >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      state.matchOver = true;
      state.winner = state.ember > state.warden ? 'ember' : 'warden';
      hooks.onMatchEnd(state.winner === 'ember', state.ember, state.warden);
      return;
    }
    hooks.onRoundEnd(emberWon, reason, state.ember, state.warden);
  }

  function nextRound() {
    state.round += 1;
    hooks.onResetRound();
    beginBuy();
  }

  function plantCharge() {
    state.plantedSite = state.plantSite;
    state.plantSite = null;
    state.phase = 'planted';
    state.fuse = FUSE_SECONDS;
    state.plantProgress = 0;
    state.money += PLANT_MONEY;
    Sfx.planted();
    hooks.onPlanted(state.plantedSite);
  }

  function explodeCharge() {
    endRound(true, 'The charge detonated on site ' + state.plantedSite.name);
  }

  // Player holds E inside a site to plant.
  function playerPlant(dt, inSite) {
    if (state.phase !== 'live' || !inSite) {
      state.plantProgress = 0;
      return;
    }
    state.plantProgress += dt / PLANT_SECONDS;
    if (Math.floor(state.plantProgress * 4) !== Math.floor((state.plantProgress - dt / PLANT_SECONDS) * 4)) {
      Sfx.plantBeep();
    }
    if (state.plantProgress >= 1) plantCharge();
  }

  // Player holds E near the planted charge to defuse.
  function playerDefuse(dt, nearCharge) {
    if (state.phase !== 'planted' || !nearCharge) {
      state.defuseProgress = 0;
      return;
    }
    state.defuseProgress += dt / DEFUSE_SECONDS;
    if (state.defuseProgress >= 1) {
      state.defuseProgress = 0;
      endRound(false, 'Charge defused by the Wardens');
    }
  }

  // Bot carrier plants when the site is clear.
  function onBotPlant(bot, dt) {
    if (state.phase !== 'live' || state.plantSite === null) return;
    state.plantProgress += dt / PLANT_SECONDS;
    if (state.plantProgress >= 1) {
      plantCharge();
      bot.state = 'hold';
    }
  }

  // Bot defuser defuses when the site is clear.
  function onBotDefuse(bot, dt) {
    if (state.phase !== 'planted') return;
    state.defuseProgress += dt / DEFUSE_SECONDS;
    if (state.defuseProgress >= 1) {
      state.defuseProgress = 0;
      endRound(false, 'Charge defused by the Wardens');
      bot.state = 'hold';
    }
  }

  function onKill(killerTeam) {
    if (killerTeam === 'ember') state.money += KILL_MONEY;
  }

  function step(dt) {
    if (state.phase === 'buy') {
      state.timer -= dt;
      if (state.timer <= 0) beginLive();
    } else if (state.phase === 'live') {
      state.timer -= dt;
      if (state.timer <= 0) endRound(false, 'Time expired — Wardens hold the yard');
    } else if (state.phase === 'planted') {
      state.fuse -= dt;
      state.timer = state.fuse;
      if (state.fuse <= 0) {
        hooks.onExplode(state.plantedSite);
        explodeCharge();
      }
    }
  }

  function assignBotDuties(bots) {
    // Carrier plants at the chosen site; the rest push their lanes.
    const carrier = bots.find((b) => b.team === 'ember' && b.isCarrier && b.alive);
    if (carrier && state.plantSite) {
      carrier.state = 'plant';
      carrier.route = [];
    }
    // Defenders rotate once the charge is planted.
    if (state.plantedSite) {
      const defusers = bots.filter((b) => b.team === 'warden' && b.alive);
      if (defusers.length > 0) {
        defusers[0].state = 'defuse';
        defusers[0].route = [];
        for (const b of defusers.slice(1)) {
          b.state = 'rotate';
          b.route = [];
        }
      }
    }
  }

  return {
    state, beginBuy, beginLive, endRound, nextRound, plantCharge, explodeCharge,
    playerPlant, playerDefuse, onBotPlant, onBotDefuse, onKill, step,
    assignBotDuties,
  };
}
