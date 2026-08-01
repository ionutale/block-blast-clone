export const LEVELS = [
  { id: 1, goal: { type: 'lines', target: 2 }, moves: 8 },
  { id: 2, goal: { type: 'lines', target: 3 }, moves: 10 },
  { id: 3, goal: { type: 'score', target: 100 }, moves: 9 },
  { id: 4, goal: { type: 'lines', target: 4 }, moves: 12 },
  { id: 5, goal: { type: 'score', target: 130 }, moves: 11 },
  { id: 6, goal: { type: 'lines', target: 5 }, moves: 14 },
  { id: 7, goal: { type: 'score', target: 150 }, moves: 12 },
  { id: 8, goal: { type: 'lines', target: 6 }, moves: 16 },
  { id: 9, goal: { type: 'score', target: 160 }, moves: 13 },
  { id: 10, goal: { type: 'lines', target: 7 }, moves: 18 },
  { id: 11, goal: { type: 'score', target: 170 }, moves: 14 },
  { id: 12, goal: { type: 'lines', target: 8 }, moves: 20 },
  { id: 13, goal: { type: 'score', target: 180 }, moves: 15 },
  { id: 14, goal: { type: 'lines', target: 9 }, moves: 22 },
  { id: 15, goal: { type: 'score', target: 190 }, moves: 16 },
  { id: 16, goal: { type: 'lines', target: 10 }, moves: 24 },
  { id: 17, goal: { type: 'score', target: 210 }, moves: 17 },
  { id: 18, goal: { type: 'lines', target: 12 }, moves: 26 },
  { id: 19, goal: { type: 'score', target: 250 }, moves: 20 },
  { id: 20, goal: { type: 'lines', target: 15 }, moves: 28 },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id);
}

export function calcStars(level, movesLeft) {
  if (movesLeft >= Math.ceil(level.moves / 3)) return 3;
  if (movesLeft >= 1) return 2;
  return 1;
}
