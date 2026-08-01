export const SIZE = 8;

export function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function canPlace(board, shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const br = row + r;
      const bc = col + c;
      if (br < 0 || br >= SIZE || bc < 0 || bc >= SIZE) return false;
      if (board[br][bc] !== null) return false;
    }
  }
  return true;
}

export function placePiece(board, shape, row, col, color) {
  const next = cloneBoard(board);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) next[row + r][col + c] = color;
    }
  }
  return next;
}

export function getFullLines(board) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r++) {
    if (board[r].every((cell) => cell !== null)) rows.push(r);
  }
  for (let c = 0; c < SIZE; c++) {
    if (board.every((row) => row[c] !== null)) cols.push(c);
  }
  return { rows, cols };
}

export function clearLines(board, { rows, cols }) {
  const next = cloneBoard(board);
  for (const r of rows) next[r] = Array(SIZE).fill(null);
  for (const c of cols) {
    for (let r = 0; r < SIZE; r++) next[r][c] = null;
  }
  return next;
}

export function anyPlacementPossible(board, shapes) {
  for (const shape of shapes) {
    for (let r = 0; r <= SIZE - shape.length; r++) {
      for (let c = 0; c <= SIZE - shape[0].length; c++) {
        if (canPlace(board, shape, r, c)) return true;
      }
    }
  }
  return false;
}
