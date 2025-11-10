/**
 * Functions for evaluating Excel-like functions (SUM, AVG, MIN, MAX)
 */

import { clampNumber } from "./cellUtils.js";

/**
 * Evaluates Excel-like functions in an expression (SUM, AVG, AVERAGE, MIN, MAX)
 * @param {string} expr - The expression containing functions
 * @param {Set} visiting - Set of cells currently being visited (for cycle detection)
 * @param {Function} expandRange - Function to expand cell ranges
 * @param {Function} getCellValueByKey - Function to get cell value by key
 * @returns {string} - The expression with functions evaluated
 */
export function evaluateFunctions(expr, visiting, expandRange, getCellValueByKey) {
  let prev;
  // Accept AVG and AVERAGE; case-insensitive
  const fnRegex = /(SUM|AVG|AVERAGE|MIN|MAX)\s*\(([^()]*)\)/gi;
  do {
    prev = expr;
    expr = expr.replace(fnRegex, (_, fnName, inner) => {
      const args = inner
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const values = [];
      for (const token of args) {
        const rangeMatch = /^([A-R]\d{1,2})\s*:\s*([A-R]\d{1,2})$/i.exec(token);
        if (rangeMatch) {
          values.push(
            ...expandRange(
              rangeMatch[1].toUpperCase(),
              rangeMatch[2].toUpperCase(),
              visiting
            )
          );
          continue;
        }
        const refMatch = /^([A-R])(\d{1,2})$/i.exec(token);
        if (refMatch) {
          const k = `${Number(refMatch[2])}-${refMatch[1].toUpperCase()}`;
          const v = getCellValueByKey(k, visiting);
          const num = typeof v === "number" ? v : Number(v);
          values.push(isNaN(num) ? 0 : num);
          continue;
        }
        const num = Number(token);
        values.push(isNaN(num) ? 0 : num);
      }
      if (values.length === 0) return "0";
      const sum = values.reduce((a, b) => a + b, 0);
      switch (fnName.toUpperCase()) {
        case "SUM":
          return String(clampNumber(sum));
        case "AVG":
        case "AVERAGE":
          return String(clampNumber(sum / values.length));
        case "MIN":
          return String(clampNumber(Math.min(...values)));
        case "MAX":
          return String(clampNumber(Math.max(...values)));
        default:
          return "0";
      }
    });
  } while (expr !== prev);
  return expr;
}

