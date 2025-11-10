/**
 * Functions for getting display values for cells
 */

/**
 * Gets the display value for a cell (evaluates formulas if needed)
 * @param {number} row - Row number
 * @param {string} col - Column letter
 * @param {Function} getRawByKey - Function to get raw cell content
 * @param {Function} evaluateFormula - Function to evaluate formulas
 * @returns {string} - The display value for the cell
 */
export function getDisplayForCell(row, col, getRawByKey, evaluateFormula) {
  const key = `${row}-${col}`;
  const raw = getRawByKey(key) ?? "";
  if (typeof raw !== "string") return raw;
  if (!raw.startsWith("=")) return raw;
  const evaluated = evaluateFormula(raw.slice(1), row, col);
  return typeof evaluated === "number" ? String(evaluated) : String(evaluated);
}

