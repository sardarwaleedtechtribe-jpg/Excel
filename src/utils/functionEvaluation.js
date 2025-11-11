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
  // Accept AVG and AVERAGE; add PRODUCT, COUNT, IF; case-insensitive
  const fnRegex = /(SUM|AVG|MIN|MAX|PRODUCT|COUNT|IF)\s*\(([^()]*)\)/gi;
  do {
    prev = expr;
    expr = expr.replace(fnRegex, (_, fnName, inner) => {
      const upperName = fnName.toUpperCase();

      // Helper: split arguments by top-level commas (no nested parentheses or quoted commas in this scope)
      const splitArgs = (s) =>
        s
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

      // Helper: collect numeric values from args (numbers, refs, ranges)
      const collectNumericValues = (argTokens) => {
        const values = [];
        for (const token of argTokens) {
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
        return values;
      };

      // Helper: evaluate a simple condition like A1>10 or 5<=B2 etc.
      const evaluateCondition = (condStr) => {
        let s = String(condStr).trim();
        // Replace Excel-like operators
        s = s.replace(/<>/g, "!=");
        // Replace equality single '=' within condition with '==' if it looks like a comparator (not assignment context here)
        // Only replace when it's between numbers/refs/spaces
        s = s.replace(/(?<=[\w)\s])=(?=[\s\w(])/g, "==");
        // Replace cell refs with their numeric values
        s = s.replace(/\b([A-R])(\d{1,2})\b/gi, (m, c, r) => {
          const k = `${Number(r)}-${c.toUpperCase()}`;
          const v = getCellValueByKey(k, visiting);
          const num = typeof v === "number" ? v : Number(v);
          return String(isNaN(num) ? 0 : num);
        });
        // Validate allowed chars for safe eval
        if (!/^[0-9+\-*/().\s<>!=]+$/.test(s)) return false;
        try {
          // eslint-disable-next-line no-new-func
          const result = Function(`"use strict"; return (${s});`)();
          return Boolean(result);
        } catch {
          return false;
        }
      };

      // Helper: evaluate a branch token to either number string or quoted string wrapped for formula stage
      const evaluateBranch = (token) => {
        const t = token.trim();
        // Quoted string literal
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
          // Normalize to double-quoted literal for downstream
          const inner = t.slice(1, -1);
          return `"${inner}"`;
        }
        // Single cell reference
        const refMatch = /^([A-R])(\d{1,2})$/i.exec(t);
        if (refMatch) {
          const k = `${Number(refMatch[2])}-${refMatch[1].toUpperCase()}`;
          const v = getCellValueByKey(k, visiting);
          if (typeof v === "number") return String(v);
          const asNum = Number(v);
          if (!isNaN(asNum)) return String(asNum);
          // Non-numeric from cell -> wrap as string literal
          return `"${String(v)}"`;
        }
        // Number literal
        const asNum = Number(t);
        if (!isNaN(asNum)) return String(asNum);
        // Fallback: treat as string literal
        return `"${t}"`;
      };

      const args = splitArgs(inner);

      if (upperName === "IF") {
        // Expect IF(condition, trueValue, falseValue)
        if (args.length < 2) return "0";
        const condition = args[0];
        const trueToken = args[1] ?? "0";
        const falseToken = args[2] ?? "0";
        const condVal = evaluateCondition(condition);
        const chosen = condVal ? trueToken : falseToken;
        return evaluateBranch(chosen);
      }

      const values = collectNumericValues(args);
      if (values.length === 0) return "0";
      const sum = values.reduce((a, b) => a + b, 0);
      switch (upperName) {
        case "SUM":
          return String(clampNumber(sum));
        case "AVG":
        // case "AVERAGE":
          return String(clampNumber(sum / values.length));
        case "MIN":
          return String(clampNumber(Math.min(...values)));
        case "MAX":
          return String(clampNumber(Math.max(...values)));
        case "PRODUCT": {
          const product = values.reduce((a, b) => a * b, 1);
          return String(clampNumber(product));
        }
        case "COUNT": {
          const count = values.reduce((acc, v) => (typeof v === "number" && !isNaN(v) ? acc + 1 : acc), 0);
          return String(count);
        }
        default:
          return "0";
      }
    });
  } while (expr !== prev);
  return expr;
}

