export function lineBonus(lineCount) {
  return 10 * ((lineCount * (lineCount + 1)) / 2);
}

export function scorePlacement(cellsPlaced, lineCount) {
  return cellsPlaced + lineBonus(lineCount);
}
