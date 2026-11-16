// Emberline Crossing — input: pointer lock, keyboard, mouse. One place owns
// the browser's input state; the simulation reads it, never the DOM.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const look = { x: 0, y: 0 };
  const state = { keys, firing: false, ads: false, locked: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('click', () => {
    if (!state.locked && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    onLockChange(state.locked);
  });
  document.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    look.x += event.movementX;
    look.y += event.movementY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (!state.locked) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.ads = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.ads = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function requestLock() {
    canvas.requestPointerLock();
  }
  function releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function takeLook() {
    const taken = { x: look.x, y: look.y };
    look.x = 0;
    look.y = 0;
    return taken;
  }
  // Touch drag feeds the same look queue as the mouse.
  function addLook(dx, dy) {
    look.x += dx;
    look.y += dy;
  }
  return { state, requestLock, releaseLock, takeLook, addLook };
}
