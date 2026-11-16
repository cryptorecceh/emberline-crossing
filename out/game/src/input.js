// Emberline Crossing — input: pointer lock, keyboard, mouse. A single owner
// holds the browser's input state; the simulation reads it, never the DOM.
export function createInput(canvas, onLockChange) {
  const pressed = new Set();
  const delta = { x: 0, y: 0 };
  const inputState = { keys: pressed, firing: false, ads: false, locked: false };

  function onKeyDown(event) {
    if (event.repeat) return;
    pressed.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    pressed.delete(event.code);
  }
  function onBlur() {
    pressed.clear();
  }
  function onClick() {
    if (!inputState.locked && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  }
  function onLock() {
    inputState.locked = document.pointerLockElement === canvas;
    onLockChange(inputState.locked);
  }
  function onMouseMove(event) {
    if (!inputState.locked) return;
    delta.x += event.movementX;
    delta.y += event.movementY;
  }
  function onMouseDown(event) {
    if (!inputState.locked) return;
    if (event.button === 0) inputState.firing = true;
    if (event.button === 2) inputState.ads = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) inputState.firing = false;
    if (event.button === 2) inputState.ads = false;
  }
  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onLock);
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  function requestLock() {
    canvas.requestPointerLock();
  }
  function releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function takeLook() {
    const taken = { x: delta.x, y: delta.y };
    delta.x = 0;
    delta.y = 0;
    return taken;
  }
  // Touch drag feeds the same look queue as the mouse.
  function addLook(dx, dy) {
    delta.x += dx;
    delta.y += dy;
  }
  return { state: inputState, requestLock, releaseLock, takeLook, addLook };
}
