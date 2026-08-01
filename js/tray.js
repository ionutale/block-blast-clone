import { SHAPES, COLORS } from './shapes.js';

export const TRAY_SIZE = 3;

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

export function generatePieces(count) {
  const pool = [...SHAPES];
  const pieces = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = randomInt(pool.length);
    const [shape] = pool.splice(idx, 1);
    pieces.push({
      id: `${i}-${randomInt(1e9)}`,
      shape,
      color: COLORS[randomInt(COLORS.length)],
      used: false,
    });
  }
  return pieces;
}

export function createTray() {
  return { pieces: generatePieces(TRAY_SIZE) };
}

export function markUsed(tray, pieceId) {
  const piece = tray.pieces.find((p) => p.id === pieceId);
  if (piece) piece.used = true;
}

export function allUsed(tray) {
  return tray.pieces.every((p) => p.used);
}

export function unusedPieces(tray) {
  return tray.pieces.filter((p) => !p.used);
}
