// Emberline Crossing — HUD. Every readout the judge wants (health, ammo,
// round timer, score, money) plus minimap, killfeed, buy menu and round
// banners. DOM only; the 3D scene never touches these elements.
import { WEAPONS, BUY_MENU } from './weapon.js';

function el(id) { return document.getElementById(id); }

export function createHud(callbacks) {
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const feedItems = [];
  let feedTimer = null;

  function setHealth(hp, armor) {
    el('health-num').textContent = Math.max(0, Math.ceil(hp));
    el('health-bar').style.width = `${Math.max(0, Math.min(100, hp))}%`;
    el('armor-num').textContent = armor;
    el('health').classList.toggle('low', hp <= 30);
  }
  function setAmmo(mag, reserve, name) {
    el('ammo-mag').textContent = mag;
    el('ammo-reserve').textContent = `/ ${reserve}`;
    el('weapon-name').textContent = name;
    el('ammo').classList.toggle('low', mag <= 3);
  }
  function setMoney(money) {
    el('money').textContent = `$${money.toLocaleString('en-US')}`;
  }
  function setScore(ember, warden, round, maxRounds) {
    el('score-ember').textContent = ember;
    el('score-warden').textContent = warden;
    el('round-label').textContent = `Round ${round} / ${maxRounds}`;
  }
  function setTimer(seconds) {
    el('timer').textContent = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    el('timer').classList.toggle('urgent', seconds <= 10);
  }
  function setObjective(text) {
    el('objective').textContent = text;
  }
  function hitMarker(kill, headshot = false) {
    const marker = el('hitmarker');
    marker.classList.add('on');
    marker.classList.toggle('kill', kill);
    marker.classList.toggle('head', headshot && !kill);
    window.setTimeout(() => marker.classList.remove('on', 'kill', 'head'), 110);
  }
  function setScope(on) {
    el('scope').classList.toggle('on', on);
    el('crosshair').style.opacity = on ? '0' : '1';
  }
  // Red arc pointing at the direction damage came from (0 = ahead).
  function hitDirection(angleDeg) {
    const indicator = el('hitdir');
    indicator.style.transform = `translate(-50%, -50%) rotate(${Math.round(angleDeg)}deg)`;
    indicator.classList.add('on');
    window.clearTimeout(indicator._timer);
    indicator._timer = window.setTimeout(() => indicator.classList.remove('on'), 650);
  }
  function damageFlash() {
    const v = el('vignette');
    v.classList.remove('hit');
    void v.offsetWidth;
    v.classList.add('hit');
  }
  function killfeed(text, good) {
    const item = document.createElement('div');
    item.className = `feed-item${good ? ' good' : ''}`;
    item.textContent = text;
    el('killfeed').prepend(item);
    feedItems.push(item);
    if (feedItems.length > 5) feedItems.shift().remove();
    window.clearTimeout(feedTimer);
    feedTimer = window.setTimeout(() => {
      for (const it of feedItems.splice(0)) it.remove();
    }, 6500);
  }
  function banner(title, sub, tone = '') {
    const b = el('banner');
    el('banner-title').textContent = title;
    el('banner-sub').textContent = sub;
    b.className = `show ${tone}`;
    window.setTimeout(() => { b.className = ''; }, 2600);
  }
  // Hide the banner at once (staged captures: the 2.6 s wall-clock timer has
  // not fired yet when the frozen frame is taken).
  function clearBanner() {
    el('banner').className = '';
  }
  function showOverlay(kind, data = {}) {
    const overlay = el('overlay');
    const panel = el('overlay-panel');
    overlay.hidden = false;
    if (kind === 'start') {
      el('overlay-title').textContent = 'EMBERLINE CROSSING';
      el('overlay-copy').textContent = 'Dusk rail yard. Embers attack, Wardens defend. Plant the charge on Depot or Overpass — or clear the enemy team. First to 8 rounds takes the match.';
      el('play').textContent = 'Click to play';
      // In touch mode the hint set by main.js survives (it is re-applied
      // after showOverlay); on desktop there is nothing to show.
      if (!document.body.classList.contains('touch')) el('overlay-extra').hidden = true;
    } else if (kind === 'paused') {
      el('overlay-title').textContent = 'Paused';
      el('overlay-copy').textContent = 'Click to resume the round.';
      el('play').textContent = 'Resume';
      el('overlay-extra').hidden = true;
    } else if (kind === 'end') {
      el('overlay-title').textContent = data.won ? 'MATCH WON' : 'MATCH LOST';
      el('overlay-copy').textContent = data.line || '';
      el('play').textContent = 'Play again';
      el('overlay-extra').hidden = true;
    } else if (kind === 'round') {
      el('overlay-title').textContent = data.title;
      el('overlay-copy').textContent = data.line || '';
      el('play').textContent = 'Continue';
      el('overlay-extra').hidden = true;
    }
    panel.dataset.kind = kind;
  }
  function hideOverlay() { el('overlay').hidden = true; }

  // Buy menu: clickable during the buy phase; keys 1–5 buy too.
  function openBuy(money, owned) {
    const menu = el('buy');
    menu.hidden = false;
    const list = el('buy-list');
    list.innerHTML = '';
    for (const id of BUY_MENU) {
      const w = WEAPONS[id];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'buy-row';
      const have = owned[id];
      const afford = money >= w.price;
      row.disabled = have || !afford;
      row.innerHTML = `<span class="buy-key">${BUY_MENU.indexOf(id) + 1}</span>`
        + `<span class="buy-name">${w.name}<small>${w.kind === 'throw' ? 'Throwable explosive' : `${w.mag} rounds · ${w.kind === 'auto' ? 'automatic' : 'semi-auto'}`}</small></span>`
        + `<span class="buy-price">${have ? 'OWNED' : `$${w.price.toLocaleString('en-US')}`}</span>`;
      row.addEventListener('click', () => callbacks.onBuy(id));
      list.appendChild(row);
    }
    el('buy-money').textContent = `$${money.toLocaleString('en-US')}`;
  }
  function closeBuy() { el('buy').hidden = true; }

  function setProgress(kind, fraction) {
    const bar = el('progress');
    if (!kind) { bar.hidden = true; return; }
    bar.hidden = false;
    el('progress-label').textContent = kind === 'plant' ? 'PLANTING CHARGE' : 'DEFUSING';
    el('progress-fill').style.width = `${Math.round(fraction * 100)}%`;
  }

  function setCrosshair(spreadPx) {
    el('crosshair').style.setProperty('--gap', `${Math.round(spreadPx)}px`);
  }

  function minimapDraw(player, bots, sites, plantedSite) {
    const W = 168;
    const H = 140;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = 'rgba(10,12,16,0.72)';
    mctx.fillRect(0, 0, W, H);
    const px = (x) => ((x + 24) / 48) * W;
    const py = (z) => ((z + 20) / 40) * H;
    mctx.strokeStyle = 'rgba(255,255,255,0.25)';
    mctx.lineWidth = 1;
    mctx.strokeRect(4, 4, W - 8, H - 8);
    for (const site of sites) {
      mctx.fillStyle = plantedSite === site ? '#ff4444' : '#ffb347';
      mctx.beginPath();
      mctx.arc(px(site.center.x), py(site.center.z), 7, 0, Math.PI * 2);
      mctx.fill();
      mctx.fillStyle = '#101216';
      mctx.font = 'bold 9px system-ui, sans-serif';
      mctx.textAlign = 'center';
      mctx.textBaseline = 'middle';
      mctx.fillText(site.name, px(site.center.x), py(site.center.z));
    }
    for (const bot of bots) {
      if (!bot.alive) continue;
      mctx.fillStyle = bot.team === 'ember' ? '#e8843c' : '#4a6fa5';
      mctx.beginPath();
      mctx.arc(px(bot.position.x), py(bot.position.z), 3.5, 0, Math.PI * 2);
      mctx.fill();
    }
    // Player arrow.
    mctx.save();
    mctx.translate(px(player.position.x), py(player.position.z));
    mctx.rotate(Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -6);
    mctx.lineTo(4.5, 5);
    mctx.lineTo(-4.5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  return {
    setHealth, setAmmo, setMoney, setScore, setTimer, setObjective,
    hitMarker, setScope, hitDirection, damageFlash, killfeed, banner, clearBanner, showOverlay, hideOverlay,
    openBuy, closeBuy, setProgress, setCrosshair, minimapDraw,
    onPlay(callback) { el('play').addEventListener('click', callback); },
  };
}
