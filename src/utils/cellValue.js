/**
 * Functions for retrieving and evaluating cell values
 */

/**
 * Gets the value of a cell by its key, handling formulas recursively
 * @param {string} key - Cell key in format "row-col"
 * @param {Set} visiting - Set of cells currently being visited (for cycle detection)
 * @param {Function} getRawByKey - Function to get raw cell content
 * @param {Function} evaluateFormula - Function to evaluate formulas
 * @returns {number|string} - The cell value
 */
export function getCellValueByKey(key, visiting, getRawByKey, evaluateFormula) {
  const raw = getRawByKey(key) ?? "";
  if (typeof raw !== "string") return raw;
  if (!raw.startsWith("=")) return isNaN(Number(raw)) ? raw : Number(raw);
  const coords = key.split("-");
  const row = Number(coords[0]);
  const col = coords[1];
  return evaluateFormula(raw.slice(1), row, col, visiting);
}

