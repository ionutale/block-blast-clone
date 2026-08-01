export function setupInput(canvas, handlers) {
  let dragging = false;
  let pointerId = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (dragging) return;
    if (handlers.hitTestTray(e.clientX, e.clientY) === -1) return;
    dragging = true;
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    handlers.onDragStart(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    e.preventDefault();
    handlers.onDragMove(e.clientX, e.clientY);
  });

  function end(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    handlers.onDragEnd(e.clientX, e.clientY);
  }

  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
