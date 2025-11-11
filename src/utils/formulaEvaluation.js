/**
 * Core formula evaluation logic
 */

import { colInRange } from "./cellUtils.js";

/**
 * Evaluates a formula expression
 * @param {string} formulaExpr - The formula expression (without leading "=")
 * @param {number} currentRow - Current row number
 * @param {string} currentCol - Current column letter
 * @param {Set} visiting - Set of cells currently being visited (for cycle detection)
 * @param {string[]} columns - Array of valid column letters
 * @param {number} rowsLength - Total number of rows
 * @param {Function} evaluateFunctions - Function to evaluate Excel functions
 * @param {Function} getCellValueByKey - Function to get cell value by key
 * @returns {number|string} - The evaluated result
 */
export function evaluateFormula(
  formulaExpr,
  currentRow,
  currentCol, 
  visiting = new Set(),
  columns,
  rowsLength,
  evaluateFunctions,
  getCellValueByKey
) {
  const currentKey = `${currentRow}-${currentCol}`;
  if (visiting.has(currentKey)) return "#CYCLE";
  visiting.add(currentKey);
  try {
    let expr = evaluateFunctions(formulaExpr, visiting);
    expr = expr.replace(/\b([A-R])(\d{1,2})\b/gi, (m, c, r) => {
      const col = c.toUpperCase();
      const row = Number(r);
      if (!colInRange(col, columns) || row < 1 || row > rowsLength) return "0";
      const key = `${row}-${col}`;
      const v = getCellValueByKey(key, new Set(visiting));
      const num = typeof v === "number" ? v : Number(v);
      return String(isNaN(num) ? 0 : num);
    });
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) return "#ERR";
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    if (typeof result === "number") {
      if (!isFinite(result)) return "#ERR";
      return result;
    }
    return String(result);
  } catch (e) {
    return "#ERR";
  } finally {
    visiting.delete(currentKey);
  }
}

