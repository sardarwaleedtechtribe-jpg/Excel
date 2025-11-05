export function createFormulaUtils(columns, rowsLength, getRawByKey) {
  const clampNumber = (n) => (Number.isFinite(n) ? n : 0);

  const colInRange = (c) => columns.indexOf(c) >= 0;

  const getCellValueByKey = (key, visiting) => {
    const raw = getRawByKey(key) ?? "";
    if (typeof raw !== "string") return raw;
    if (!raw.startsWith("=")) return isNaN(Number(raw)) ? raw : Number(raw);
    const coords = key.split("-");
    const row = Number(coords[0]);
    const col = coords[1];
    return evaluateFormula(raw.slice(1), row, col, visiting);
  };

  const expandRange = (startRef, endRef, visiting) => {
    const refToRowCol = (ref) => ({ row: Number(ref.slice(1)), col: ref[0] });
    const a = refToRowCol(startRef);
    const b = refToRowCol(endRef);
    const startRow = Math.min(a.row, b.row);
    const endRow = Math.max(a.row, b.row);
    const startColIdx = Math.min(columns.indexOf(a.col), columns.indexOf(b.col));
    const endColIdx = Math.max(columns.indexOf(a.col), columns.indexOf(b.col));
    const vals = [];
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startColIdx; c <= endColIdx; c++) {
        const k = `${r}-${columns[c]}`;
        const v = getCellValueByKey(k, visiting);
        const num = typeof v === "number" ? v : Number(v);
        vals.push(isNaN(num) ? 0 : num);
      }
    }
    return vals;
  };

  const evaluateFunctions = (expr, visiting) => {
    let prev;
    const fnRegex = /(SUM|AVG|MIN|MAX)\s*\(([^()]*)\)/gi;
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
  };

  const evaluateFormula = (formulaExpr, currentRow, currentCol, visiting = new Set()) => {
    const currentKey = `${currentRow}-${currentCol}`;
    if (visiting.has(currentKey)) return "#CYCLE";
    visiting.add(currentKey);
    try {
      let expr = evaluateFunctions(formulaExpr, visiting);
      expr = expr.replace(/\b([A-R])(\d{1,2})\b/gi, (m, c, r) => {
        const col = c.toUpperCase();
        const row = Number(r);
        if (!colInRange(col) || row < 1 || row > rowsLength) return "0";
        const key = `${row}-${col}`;
        const v = getCellValueByKey(key, new Set(visiting));
        const num = typeof v === "number" ? v : Number(v);
        return String(isNaN(num) ? 0 : num);
      });
      if (!/^[0-9+\-*/().\s]+$/.test(expr)) return "#ERR";
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr});`)();
      if (typeof result === "number" && isFinite(result)) return result;
      return String(result);
    } catch (e) {
      return "#ERR";
    } finally {
      visiting.delete(currentKey);
    }
  };

  const getDisplayForCell = (row, col) => {
    const key = `${row}-${col}`;
    const raw = getRawByKey(key) ?? "";
    if (typeof raw !== "string") return raw;
    if (!raw.startsWith("=")) return raw;
    const evaluated = evaluateFormula(raw.slice(1), row, col);
    return typeof evaluated === "number" ? String(evaluated) : String(evaluated);
  };

  return { evaluateFormula, getDisplayForCell };
}


