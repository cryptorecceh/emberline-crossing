// Emberline Crossing — touch controls for phones. Left virtual joystick
// for movement, right-side drag to look/aim, thumb buttons for fire, ADS,
// reload, jump, crouch, weapon cycle and buy. Pointer lock is never used
// in touch mode; on desktop this module stays dormant (state all false,
// no elements shown). Activate with ?touch=1 for testing on desktop.

function makeButton(id, label, cls = '') {
  const b = document.createElement('div');
  b.id = id;
  b.className = `tbtn ${cls}`;
  b.textContent = label;
  b.setAttribute('role', 'button');
  return b;
}

export function createTouch({ keys, onLook, onCycleWeapon, onBuy }) {
  const state = {
    active: false,
    firing: false,
    ads: false,
    moveVec: { x: 0, y: 0 },
  };
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('touch') === '1';
  const isTouch = forced || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return { state };

  state.active = true;
  document.body.classList.add('touch');

  const layer = document.createElement('div');
  layer.id = 'touch-ui';
  document.body.appendChild(layer);

  // --- Virtual joystick (bottom-left) ---
  const stick = document.createElement('div');
  stick.id = 'stick';
  const knob = document.createElement('div');
  knob.id = 'stick-knob';
  stick.appendChild(knob);
  layer.appendChild(stick);
  const STICK_R = 46;
  let stickId = null;
  function stickCenter() {
    const r = stick.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function stickMove(clientX, clientY) {
    const c = stickCenter();
    let dx = clientX - c.x;
    let dy = clientY - c.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // Up on the stick = forward; right = strafe right.
    state.moveVec.x = dx / STICK_R;
    state.moveVec.y = -dy / STICK_R;
  }
  function stickEnd() {
    stickId = null;
    state.moveVec.x = 0;
    state.moveVec.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  }
  stick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    stickId = t.identifier;
    stickMove(t.clientX, t.clientY);
  }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) stickMove(t.clientX, t.clientY);
    }
  }, { passive: false });
  stick.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) stickEnd();
    }
  });
  stick.addEventListener('touchcancel', stickEnd);

  // --- Look drag: any touch on the game area (not a button) aims ---
  const game = document.getElementById('game');
  let lookId = null;
  let lastX = 0;
  let lastY = 0;
  function isButtonTarget(target) {
    return target.closest && target.closest('.tbtn, #stick, #buy, #overlay, #topbar');
  }
  game.addEventListener('touchstart', (e) => {
    if (lookId !== null || isButtonTarget(e.target)) return;
    const t = e.changedTouches[0];
    if (!t) return;
    lookId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
    e.preventDefault();
  }, { passive: false });
  game.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      onLook(t.clientX - lastX, t.clientY - lastY);
      lastX = t.clientX;
      lastY = t.clientY;
      e.preventDefault();
    }
  }, { passive: false });
  function lookEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) lookId = null;
    }
  }
  game.addEventListener('touchend', lookEnd);
  game.addEventListener('touchcancel', lookEnd);

  // --- Thumb buttons ---
  function holdButton(id, label, cls, onDown, onUp) {
    const b = makeButton(id, label, cls);
    const down = (e) => {
      e.preventDefault();
      onDown();
    };
    const up = (e) => {
      e.preventDefault();
      if (onUp) onUp();
    };
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    // Mouse too, so the controls are testable on desktop with ?touch=1.
    b.addEventListener('mousedown', down);
    b.addEventListener('mouseup', up);
    layer.appendChild(b);
    return b;
  }
  function tapButton(id, label, cls, onTap) {
    const b = makeButton(id, label, cls);
    const tap = (e) => {
      e.preventDefault();
      onTap();
    };
    b.addEventListener('touchstart', tap, { passive: false });
    b.addEventListener('click', tap);
    layer.appendChild(b);
    return b;
  }

  holdButton('btn-fire', 'TEMBAK', 'big', () => { state.firing = true; }, () => { state.firing = false; });
  holdButton('btn-ads', 'ADS', '', () => { state.ads = true; }, () => { state.ads = false; });
  holdButton('btn-reload', 'R', '', () => { keys.add('KeyR'); }, () => { keys.delete('KeyR'); });
  holdButton('btn-jump', 'LOMPAT', '', () => { keys.add('Space'); }, () => { keys.delete('Space'); });
  holdButton('btn-crouch', 'JONGKOK', '', () => { keys.add('ControlLeft'); }, () => { keys.delete('ControlLeft'); });
  tapButton('btn-weapon', 'SENJATA', '', () => { onCycleWeapon(); });
  tapButton('btn-buy', 'BELI', '', () => { onBuy(); });

  return { state };
}
