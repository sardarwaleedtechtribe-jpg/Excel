/**  * Functions for expanding cell ranges (e.g., A1:B3) */ /**
 * Expands a cell range reference into an array of numeric values
 * @param {string} startRef - Start cell reference (e.g., "A1")
 * @param {string} endRef - End cell reference (e.g., "B3")
 * @param {Set} visiting - Set of cells currently being visited (for cycle detection)
 * @param {string[]} columns - Array of valid column letters
 * @param {Function} getCellValueByKey - Function to get cell value by key
 * @returns {number[]} - Array of numeric values from the range
 */
export function expandRange(
  startRef,
  endRef,
  visiting,
  columns,
  getCellValueByKey
) {
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
}