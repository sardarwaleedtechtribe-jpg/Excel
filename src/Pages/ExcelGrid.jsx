import React, { useState, useEffect, useRef, useMemo } from "react";
import { createFormulaUtils } from "../utils/formulas";
import FillHandle from "../Components/FillHandle";

const columns = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
);
const rows = Array.from({ length: 27 }, (_, i) => i + 1);

export default function ExcelGrid() {
  const [selectedCell, setSelectedCell] = useState({ row: 1, col: "A" });
  const [selectionRange, setSelectionRange] = useState(null); // { start: {row,col}, end: {row,col} }
  const [cellContents, setCellContents] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [editMode, setEditMode] = useState("select");
  const [isDoubleClickEdit, setIsDoubleClickEdit] = useState(false); // Track if edit mode was entered via double-click
  const [colWidths, setColWidths] = useState(
    columns.reduce((acc, col) => ({ ...acc, [col]: 80 }), {})
  );
  const [rowHeights, setRowHeights] = useState(
    rows.reduce((acc, row) => ({ ...acc, [row]: 25 }), {})
  );
  const [fillPreviewBounds, setFillPreviewBounds] = useState(null);

  // Tracks Excel-like function argument picking within parentheses
  // { key: 'row-col', stage: 'start'|'end', paramStart: number, startCell?: { row, col } }
  const [formulaPick, setFormulaPick] = useState(null);

  // Formula reference bounding box for ranges; and explicit single-cell refs for non-range formulas
  const [formulaRefBounds, setFormulaRefBounds] = useState(null);
  const [formulaSingleRefs, setFormulaSingleRefs] = useState([]); // array of bounds for A1, B3 ...

  const inputRefs = useRef({});
  const resizingRef = useRef(null);
  const selectingRef = useRef(false);
  const dragAnchorRef = useRef(null);
  const containerRef = useRef(null);

  // Autofocus selected cell
  useEffect(() => {
    const key = `${selectedCell.row}-${selectedCell.col}`;
    const el = inputRefs.current[key];
    if (el) {
      el.focus();
      try {
        const len = el.value ? el.value.length : 0;
        el.setSelectionRange(len, len);
      } catch (e) {}
    }
  }, [selectedCell]);

  // When editing a formula (leading "="), parse ranges and singles to highlight appropriately
  useEffect(() => {
    if (!editingKey) {
      setFormulaRefBounds(null);
      setFormulaSingleRefs([]);
      setFormulaPick(null);
      return;
    }
    const raw = cellContents[editingKey] ?? "";
    if (typeof raw !== "string" || !raw.startsWith("=")) {
      setFormulaRefBounds(null);
      setFormulaSingleRefs([]);
      setFormulaPick(null);
      return;
    }
    try {
      const expr = raw.slice(1);
      const covered = new Set();
      const ranges = [];
      const singles = [];

      // Helper to convert letters to index
      const colLettersToIndex = (s) => {
        let idx = 0;
        for (let i = 0; i < s.length; i++) idx = idx * 26 + (s.charCodeAt(i) - 64);
        return idx - 1;
      };

      // 1) Capture ranges first: e.g., A1:B5, AA10:AC12
      const rangeRe = /\b([A-Z]+)([1-9]\d?)\s*:\s*([A-Z]+)([1-9]\d?)\b/g;
      let m;
      while ((m = rangeRe.exec(expr)) !== null) {
        const sColIdx = colLettersToIndex(m[1].toUpperCase());
        const eColIdx = colLettersToIndex(m[3].toUpperCase());
        const sRow = Math.max(1, Math.min(rows.length, Number(m[2])));
        const eRow = Math.max(1, Math.min(rows.length, Number(m[4])));
        const startRow = Math.min(sRow, eRow);
        const endRow = Math.max(sRow, eRow);
        const startColIdx = Math.max(0, Math.min(columns.length - 1, Math.min(sColIdx, eColIdx)));
        const endColIdx = Math.max(0, Math.min(columns.length - 1, Math.max(sColIdx, eColIdx)));
        if (endRow >= startRow && endColIdx >= startColIdx) {
          ranges.push({ startRow, endRow, startColIdx, endColIdx });
          for (let i = m.index; i < m.index + m[0].length; i++) covered.add(i);
        }
      }

      // 2) Capture single refs not inside any matched range token: e.g., A1, C7
      const singleRe = /\b([A-Z]+)([1-9]\d?)\b/g;
      const seenSingles = new Set();
      while ((m = singleRe.exec(expr)) !== null) {
        let overlap = false;
        for (let i = m.index; i < m.index + m[0].length; i++) {
          if (covered.has(i)) { overlap = true; break; }
        }
        if (overlap) continue;
        const colIdx = colLettersToIndex(m[1].toUpperCase());
        const rowNum = Number(m[2]);
        if (!Number.isFinite(colIdx) || rowNum < 1 || rowNum > rows.length) continue;
        const cIdx = Math.max(0, Math.min(columns.length - 1, colIdx));
        const key = `${cIdx}-${rowNum}`;
        if (seenSingles.has(key)) continue;
        seenSingles.add(key);
        singles.push({ startRow: rowNum, endRow: rowNum, startColIdx: cIdx, endColIdx: cIdx });
      }

      // Update state: union of ranges for marching-ants; singles for discrete highlights
      if (ranges.length > 0) {
        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        for (const b of ranges) {
          minRow = Math.min(minRow, b.startRow);
          maxRow = Math.max(maxRow, b.endRow);
          minCol = Math.min(minCol, b.startColIdx);
          maxCol = Math.max(maxCol, b.endColIdx);
        }
        setFormulaRefBounds({ startRow: minRow, endRow: maxRow, startColIdx: minCol, endColIdx: maxCol });
      } else {
        setFormulaRefBounds(null);
      }
      setFormulaSingleRefs(singles);
    } catch (err) {
      setFormulaRefBounds(null);
      setFormulaSingleRefs([]);
    }
  }, [editingKey, cellContents]);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) return;
      const { type, id, startX, startY, startSize } = resizingRef.current;
      if (type === "col") {
        const newWidth = Math.max(40, startSize + (e.clientX - startX));
        setColWidths((prev) => ({ ...prev, [id]: newWidth }));
      } else if (type === "row") {
        const newHeight = Math.max(20, startSize + (e.clientY - startY));
        setRowHeights((prev) => ({ ...prev, [id]: newHeight }));
      }
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      selectingRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const getRangeBounds = (range) => {
    if (!range) return null;
    const startRow = Math.min(range.start.row, range.end.row);
    const endRow = Math.max(range.start.row, range.end.row);
    const startColIdx = Math.min(
      columns.indexOf(range.start.col),
      columns.indexOf(range.end.col)
    );
    const endColIdx = Math.max(
      columns.indexOf(range.start.col),
      columns.indexOf(range.end.col)
    );
    return { startRow, endRow, startColIdx, endColIdx };
  };

  const selectionBounds = getRangeBounds(selectionRange);

  const isInSelection = (row, col) => {
    if (!selectionRange) return false;
    const b = getRangeBounds(selectionRange);
    if (!b) return false;
    const colIdx = columns.indexOf(col);
    return (
      row >= b.startRow &&
      row <= b.endRow &&
      colIdx >= b.startColIdx &&
      colIdx <= b.endColIdx
    );
  };

  const rowHeaderWidthPx = 35; // matches the first track width
  const colHeaderHeightPx = 32; // ~2rem

  const getLeftForCol = (col) => {
    const idx = columns.indexOf(col);
    let left = rowHeaderWidthPx;
    for (let i = 0; i < idx; i++) left += colWidths[columns[i]];
    return left;
  };

  const getTopForRow = (row) => {
    let top = colHeaderHeightPx;
    for (let r = 1; r < row; r++) top += rowHeights[r];
    return top;
  };

  const getSelectionOverlayStyle = () => {
    if (!selectionBounds) return null;
    const { startRow, endRow, startColIdx, endColIdx } = selectionBounds;
    const startCol = columns[startColIdx];
    const left = getLeftForCol(startCol);
    const top = getTopForRow(startRow);
    let width = 0;
    for (let i = startColIdx; i <= endColIdx; i++) width += colWidths[columns[i]];
    let height = 0;
    for (let r = startRow; r <= endRow; r++) height += rowHeights[r];
    return { left, top, width, height };
  };

  const selectionOverlay = getSelectionOverlayStyle();

  // Prefer fill preview bounds for header highlighting when dragging the handle
  const highlightBounds = fillPreviewBounds || selectionBounds;

  const editingRawValue =
    editingKey != null ? cellContents[editingKey] ?? "" : null;
  const isEditingFormula =
    typeof editingRawValue === "string" &&
    editingRawValue.trimStart().startsWith("=");

  // Provide single-cell bounds/overlay so FillHandle shows for a single selected cell
  const selectedCellBounds = useMemo(() => {
    if (!selectedCell) return null;
    const colIdx = columns.indexOf(selectedCell.col);
    if (colIdx < 0) return null;
    return {
      startRow: selectedCell.row,
      endRow: selectedCell.row,
      startColIdx: colIdx,
      endColIdx: colIdx,
    };
  }, [selectedCell]);

  const selectedCellOverlay = useMemo(() => {
    if (!selectedCell) return null;
    const left = getLeftForCol(selectedCell.col);
    const top = getTopForRow(selectedCell.row);
    const width = colWidths[selectedCell.col];
    const height = rowHeights[selectedCell.row];
    if (typeof width !== "number" || typeof height !== "number") return null;
    return { left, top, width, height };
  }, [selectedCell, colWidths, rowHeights]);

  // Formula utilities via external module
  const getRawByKey = (key) => cellContents[key] ?? "";
  const { getDisplayForCell } = useMemo(
    () => createFormulaUtils(columns, rows.length, getRawByKey),
    [cellContents]
  );

  const clientToCell = (clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Determine column
    let left = rowHeaderWidthPx;
    let colIdx = -1;
    for (let i = 0; i < columns.length; i++) {
      const w = colWidths[columns[i]];
      if (x >= left && x <= left + w) {
        colIdx = i;
        break;
      }
      left += w;
    }
    if (colIdx === -1) colIdx = 0;

    // Determine row
    let top = colHeaderHeightPx;
    let rowNum = -1;
    for (let r = 1; r <= rows.length; r++) {
      const h = rowHeights[r];
      if (y >= top && y <= top + h) {
        rowNum = r;
        break;
      }
      top += h;
    }
    if (rowNum === -1) {
      rowNum = y < colHeaderHeightPx ? 1 : rows.length;
    }

    return { row: rowNum, col: columns[Math.max(0, Math.min(columns.length - 1, colIdx))] };
  };

  const getUnionRangeFromDrag = (startBounds, endCell) => {
    const endColIdx = columns.indexOf(endCell.col);
    const extendDown = endCell.row > startBounds.endRow;
    const extendUp = endCell.row < startBounds.startRow;
    const extendRight = endColIdx > startBounds.endColIdx;
    const extendLeft = endColIdx < startBounds.startColIdx;

    // Prefer single-axis extension like Excel
    const verticalDelta = extendDown ? endCell.row - startBounds.endRow : extendUp ? startBounds.startRow - endCell.row : 0;
    const horizontalDelta = extendRight ? endColIdx - startBounds.endColIdx : extendLeft ? startBounds.startColIdx - endColIdx : 0;

    if (Math.abs(verticalDelta) >= Math.abs(horizontalDelta)) {
      // Vertical extension
      const newStartRow = extendUp ? endCell.row : startBounds.startRow;
      const newEndRow = extendDown ? endCell.row : startBounds.endRow;
      return {
        startRow: newStartRow,
        endRow: newEndRow,
        startColIdx: startBounds.startColIdx,
        endColIdx: startBounds.endColIdx,
        axis: "vertical",
      };
    } else {
      // Horizontal extension
      const newStartColIdx = extendLeft ? endColIdx : startBounds.startColIdx;
      const newEndColIdx = extendRight ? endColIdx : startBounds.endColIdx;
      return {
        startRow: startBounds.startRow,
        endRow: startBounds.endRow,
        startColIdx: newStartColIdx,
        endColIdx: newEndColIdx,
        axis: "horizontal",
      };
    }
  };

  const getRectForBounds = (bounds) => {
    const startCol = columns[bounds.startColIdx];
    const left = getLeftForCol(startCol);
    const top = getTopForRow(bounds.startRow);
    let width = 0;
    for (let i = bounds.startColIdx; i <= bounds.endColIdx; i++) width += colWidths[columns[i]];
    let height = 0;
    for (let r = bounds.startRow; r <= bounds.endRow; r++) height += rowHeights[r];
    return { left, top, width, height };
  };

  const getValuesFromRange = (bounds) => {
    const values = [];
    for (let r = bounds.startRow; r <= bounds.endRow; r++) {
      const rowVals = [];
      for (let c = bounds.startColIdx; c <= bounds.endColIdx; c++) {
        const key = `${r}-${columns[c]}`;
        rowVals.push(cellContents[key] || "");
      }
      values.push(rowVals);
    }
    return values;
  };

  const isNumeric = (v) => v !== "" && !isNaN(Number(v));

  // Detect text patterns like "Item 1", "Item 2" or "tm:1", "tm:2"
  const detectTextPattern = (values) => {
    if (values.length < 2) return null;
    
    // Try to parse each value as: prefix + separator + number
    const patterns = [];
    for (const val of values) {
      if (typeof val !== "string" || val === "") return null;
      
      // Match pattern: text prefix + separator (space, colon, dash, etc.) + number at the end
      const match = val.match(/^(.+?)([\s:\-])(\d+)$/);
      if (!match) return null;
      
      patterns.push({
        prefix: match[1],
        separator: match[2],
        number: Number(match[3]),
        full: val
      });
    }
    
    // Check if all values have the same prefix and separator
    const firstPrefix = patterns[0].prefix;
    const firstSeparator = patterns[0].separator;
    if (!patterns.every(p => p.prefix === firstPrefix && p.separator === firstSeparator)) {
      return null;
    }
    
    // Check if numbers form a sequence with constant step
    const numbers = patterns.map(p => p.number);
    if (numbers.length >= 2) {
      const diffs = [];
      for (let i = 1; i < numbers.length; i++) {
        diffs.push(numbers[i] - numbers[i - 1]);
      }
      const same = diffs.every((d) => d === diffs[0]);
      if (same) {
        return {
          prefix: firstPrefix,
          separator: firstSeparator,
          numbers: numbers,
          step: diffs[0],
          isValid: true
        };
      }
    }
    
    return null;
  };

  // Generate next value in text pattern sequence
  const generateTextPatternValue = (pattern, currentNumber, step) => {
    return `${pattern.prefix}${pattern.separator}${currentNumber}`;
  };

  // Adjust cell references in a formula based on row/column offset
  const adjustFormulaReferences = (formula, rowOffset, colOffset) => {
    if (typeof formula !== "string" || !formula.startsWith("=")) {
      return formula;
    }

    // Helper to convert column letter to index (A=0, B=1, ..., Z=25, AA=26, etc.)
    const colLetterToIndex = (colStr) => {
      let idx = 0;
      for (let i = 0; i < colStr.length; i++) {
        idx = idx * 26 + (colStr.charCodeAt(i) - 64);
      }
      return idx - 1;
    };

    // Helper to convert column index to letter (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
    const colIndexToLetter = (idx) => {
      let result = "";
      idx = idx + 1; // Convert to 1-based
      while (idx > 0) {
        idx--;
        result = String.fromCharCode(65 + (idx % 26)) + result;
        idx = Math.floor(idx / 26);
      }
      return result;
    };

    // Adjust a single cell reference (e.g., A1 -> A2 if rowOffset=1)
    const adjustCellRef = (match, colLetter, rowNum) => {
      const colIdx = colLetterToIndex(colLetter.toUpperCase());
      const newColIdx = colIdx + colOffset;
      const newRow = Number(rowNum) + rowOffset;
      
      // Validate bounds
      if (newColIdx < 0 || newRow < 1) {
        return match; // Keep original if out of bounds
      }
      
      const newColLetter = colIndexToLetter(newColIdx);
      return `${newColLetter}${newRow}`;
    };

    // Adjust a range reference (e.g., A1:B1 -> A2:B2)
    const adjustRangeRef = (match, col1, row1, col2, row2) => {
      const col1Idx = colLetterToIndex(col1.toUpperCase());
      const col2Idx = colLetterToIndex(col2.toUpperCase());
      const newCol1Idx = col1Idx + colOffset;
      const newCol2Idx = col2Idx + colOffset;
      const newRow1 = Number(row1) + rowOffset;
      const newRow2 = Number(row2) + rowOffset;
      
      // Validate bounds
      if (newCol1Idx < 0 || newCol2Idx < 0 || newRow1 < 1 || newRow2 < 1) {
        return match; // Keep original if out of bounds
      }
      
      const newCol1Letter = colIndexToLetter(newCol1Idx);
      const newCol2Letter = colIndexToLetter(newCol2Idx);
      return `${newCol1Letter}${newRow1}:${newCol2Letter}${newRow2}`;
    };

    let adjusted = formula;
    const placeholders = [];
    let placeholderIndex = 0;

    // First, adjust range references (A1:B5 format) and replace with placeholders
    // This prevents single ref replacement from matching parts of ranges
    adjusted = adjusted.replace(/\b([A-Z]+)(\d{1,2})\s*:\s*([A-Z]+)(\d{1,2})\b/gi, (match, col1, row1, col2, row2) => {
      const adjustedRange = adjustRangeRef(match, col1, row1, col2, row2);
      const placeholder = `__RANGE_PLACEHOLDER_${placeholderIndex}__`;
      placeholders.push(adjustedRange);
      placeholderIndex++;
      return placeholder;
    });

    // Then adjust single cell references (A1 format)
    adjusted = adjusted.replace(/\b([A-Z]+)(\d{1,2})\b/gi, (match, colLetter, rowNum) => {
      return adjustCellRef(match, colLetter, rowNum);
    });

    // Finally, restore the range placeholders
    placeholders.forEach((range, index) => {
      adjusted = adjusted.replace(`__RANGE_PLACEHOLDER_${index}__`, range);
    });

    return adjusted;
  };

  const applyFill = (sourceBounds, finalBounds, axis) => {
    // Determine the extension area only (outside original source)
    const ext = { ...finalBounds };
    const src = { ...sourceBounds };
    const updates = {};

    if (axis === "vertical") {
      // For each column independently
      for (let c = src.startColIdx; c <= src.endColIdx; c++) {
        const sourceVals = [];
        for (let r = src.startRow; r <= src.endRow; r++) {
          sourceVals.push(cellContents[`${r}-${columns[c]}`] || "");
        }

        // Check for text pattern first (e.g., "Item 1", "Item 2" or "tm:1", "tm:2")
        const textPattern = detectTextPattern(sourceVals);
        
        const allNums = sourceVals.every(isNumeric);
        let step = 0;
        if (allNums && sourceVals.length >= 2) {
          const diffs = [];
          for (let i = 1; i < sourceVals.length; i++) diffs.push(Number(sourceVals[i]) - Number(sourceVals[i - 1]));
          const same = diffs.every((d) => d === diffs[0]);
          step = same ? diffs[0] : 0;
        }

        if (ext.endRow > src.endRow) {
          // fill downward
          let seqIndex = 0;
          let current = allNums ? Number(sourceVals[sourceVals.length - 1]) : null;
          let currentTextNumber = textPattern ? textPattern.numbers[textPattern.numbers.length - 1] : null;
          for (let r = src.endRow + 1; r <= ext.endRow; r++) {
            let value;
            const sourceVal = sourceVals[seqIndex % sourceVals.length] ?? "";
            const sourceRow = src.startRow + (seqIndex % sourceVals.length);
            
            // Check if source value is a formula
            if (typeof sourceVal === "string" && sourceVal.startsWith("=")) {
              // Calculate row offset (how many rows down from source)
              const rowOffset = r - sourceRow;
              const colOffset = 0; // No column change when filling vertically
              value = adjustFormulaReferences(sourceVal, rowOffset, colOffset);
            } else if (textPattern) {
              // Use text pattern
              currentTextNumber = currentTextNumber + textPattern.step;
              value = generateTextPatternValue(textPattern, currentTextNumber, textPattern.step);
            } else if (allNums && sourceVals.length >= 1) {
              value = step !== 0 && sourceVals.length >= 2 ? String(current + step) : String(Number(sourceVals[seqIndex % sourceVals.length]));
              current = Number(value);
            } else {
              value = String(sourceVal);
            }
            updates[`${r}-${columns[c]}`] = value;
            seqIndex++;
          }
        }
        if (ext.startRow < src.startRow) {
          // fill upward
          let seqIndex = 0;
          let current = allNums ? Number(sourceVals[0]) : null;
          let currentTextNumber = textPattern ? textPattern.numbers[0] : null;
          for (let r = src.startRow - 1; r >= ext.startRow; r--) {
            let value;
            const sourceIndex = (sourceVals.length - 1 - (seqIndex % sourceVals.length) + sourceVals.length) % sourceVals.length;
            const sourceVal = sourceVals[sourceIndex] ?? "";
            const sourceRow = src.startRow + sourceIndex;
            
            // Check if source value is a formula
            if (typeof sourceVal === "string" && sourceVal.startsWith("=")) {
              // Calculate row offset (how many rows up from source, negative)
              const rowOffset = r - sourceRow;
              const colOffset = 0; // No column change when filling vertically
              value = adjustFormulaReferences(sourceVal, rowOffset, colOffset);
            } else if (textPattern) {
              // Use text pattern (going backward)
              currentTextNumber = currentTextNumber - textPattern.step;
              value = generateTextPatternValue(textPattern, currentTextNumber, textPattern.step);
            } else if (allNums && sourceVals.length >= 2 && step !== 0) {
              current = current - step;
              value = String(current);
            } else if (allNums && sourceVals.length >= 1) {
              value = String(sourceVal);
            } else {
              value = String(sourceVal);
            }
            updates[`${r}-${columns[c]}`] = value;
            seqIndex++;
          }
        }
      }
    } else if (axis === "horizontal") {
      // For each row independently
      for (let r = src.startRow; r <= src.endRow; r++) {
        const sourceVals = [];
        for (let c = src.startColIdx; c <= src.endColIdx; c++) {
          sourceVals.push(cellContents[`${r}-${columns[c]}`] || "");
        }
        
        // Check for text pattern first (e.g., "Item 1", "Item 2" or "tm:1", "tm:2")
        const textPattern = detectTextPattern(sourceVals);
        
        const allNums = sourceVals.every(isNumeric);
        let step = 0;
        if (allNums && sourceVals.length >= 2) {
          const diffs = [];
          for (let i = 1; i < sourceVals.length; i++) diffs.push(Number(sourceVals[i]) - Number(sourceVals[i - 1]));
          const same = diffs.every((d) => d === diffs[0]);
          step = same ? diffs[0] : 0;
        }

        if (ext.endColIdx > src.endColIdx) {
          let seqIndex = 0;
          let current = allNums ? Number(sourceVals[sourceVals.length - 1]) : null;
          let currentTextNumber = textPattern ? textPattern.numbers[textPattern.numbers.length - 1] : null;
          for (let c = src.endColIdx + 1; c <= ext.endColIdx; c++) {
            let value;
            const sourceVal = sourceVals[seqIndex % sourceVals.length] ?? "";
            const sourceColIdx = src.startColIdx + (seqIndex % sourceVals.length);
            
            // Check if source value is a formula
            if (typeof sourceVal === "string" && sourceVal.startsWith("=")) {
              // Calculate column offset (how many columns right from source)
              const rowOffset = 0; // No row change when filling horizontally
              const colOffset = c - sourceColIdx;
              value = adjustFormulaReferences(sourceVal, rowOffset, colOffset);
            } else if (textPattern) {
              // Use text pattern
              currentTextNumber = currentTextNumber + textPattern.step;
              value = generateTextPatternValue(textPattern, currentTextNumber, textPattern.step);
            } else if (allNums && sourceVals.length >= 1) {
              value = step !== 0 && sourceVals.length >= 2 ? String(current + step) : String(Number(sourceVals[seqIndex % sourceVals.length]));
              current = Number(value);
            } else {
              value = String(sourceVal);
            }
            updates[`${r}-${columns[c]}`] = value;
            seqIndex++;
          }
        }
        if (ext.startColIdx < src.startColIdx) {
          let seqIndex = 0;
          let current = allNums ? Number(sourceVals[0]) : null;
          let currentTextNumber = textPattern ? textPattern.numbers[0] : null;
          for (let c = src.startColIdx - 1; c >= ext.startColIdx; c--) {
            let value;
            const sourceIndex = (sourceVals.length - 1 - (seqIndex % sourceVals.length) + sourceVals.length) % sourceVals.length;
            const sourceVal = sourceVals[sourceIndex] ?? "";
            const sourceColIdx = src.startColIdx + sourceIndex;
            
            // Check if source value is a formula
            if (typeof sourceVal === "string" && sourceVal.startsWith("=")) {
              // Calculate column offset (how many columns left from source, negative)
              const rowOffset = 0; // No row change when filling horizontally
              const colOffset = c - sourceColIdx;
              value = adjustFormulaReferences(sourceVal, rowOffset, colOffset);
            } else if (textPattern) {
              // Use text pattern (going backward)
              currentTextNumber = currentTextNumber - textPattern.step;
              value = generateTextPatternValue(textPattern, currentTextNumber, textPattern.step);
            } else if (allNums && sourceVals.length >= 2 && step !== 0) {
              current = current - step;
              value = String(current);
            } else if (allNums && sourceVals.length >= 1) {
              value = String(sourceVal);
            } else {
              value = String(sourceVal);
            }
            updates[`${r}-${columns[c]}`] = value;
            seqIndex++;
          }
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      setCellContents((prev) => ({ ...prev, ...updates }));
    }
  };

  // Marquee (marching-ants) SVG rectangle. Uses a CSS animation on stroke-dashoffset.
  const MarqueeBorder = ({ left, top, width, height, color = "black", strokeWidth = 2, dashArray = "6 4", zIndex = 60 }) => {
    if (width == null || height == null) return null;
    // Padding so stroke is fully visible (stroke is centered on rect path)
    const pad = strokeWidth;
    const svgW = Math.max(0, width + pad * 2);
    const svgH = Math.max(0, height + pad * 2);
    return (
      <svg
        className="pointer-events-none absolute"
        style={{
          left: left - pad,
          top: top - pad,
          width: svgW,
          height: svgH,
          overflow: "visible",
          zIndex,
        }}
      >
        <rect
          x={pad / 2}
          y={pad / 2}
          width={Math.max(0, width + (pad - strokeWidth))}
          height={Math.max(0, height + (pad - strokeWidth))}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          style={{ vectorEffect: "non-scaling-stroke", animation: "dash 1s linear infinite" }}
        />
      </svg>
    );
  };

  // CSS keyframes for marching ants. We'll inject a small style tag to ensure the animation exists.
  const marchingAntsStyle = `
    @keyframes dash {
      to { stroke-dashoffset: -20; }
    }
  `;

  return (
    <div className="bg-gray-100 min-h-screen flex items-start justify-start overflow-auto">
      {/* Inject marching-ants keyframes */}
      <style>{marchingAntsStyle}</style>

      <div
        className="grid border select-none relative"
        style={{
          gridTemplateColumns: `35px ${columns
            .map((c) => `${colWidths[c]}px`)
            .join(" ")}`,
          gridTemplateRows: `2rem ${rows
            .map((r) => `${rowHeights[r]}px`)
            .join(" ")}`,
        }}
        ref={containerRef}
      >
        {/* Empty top-left corner */}
        <div className="bg-gray-300 border border-gray-400" />

        {/* Column headers */}
        {columns.map((col) => {
          const colIdx = columns.indexOf(col);
          const isColInRange = !!highlightBounds && colIdx >= highlightBounds.startColIdx && colIdx <= highlightBounds.endColIdx;
          const isActiveCol = selectedCell.col === col || isColInRange;
          return (
            <div
              key={col}
              className={`relative flex items-center justify-center text-black border border-gray-300 font-semibold 
                ${isActiveCol ? "bg-green-200 text-green-800" : "bg-gray-100"}`}
            >
              {col}
              {/* Column resize handle */}
              <div
                onMouseDown={(e) =>
                  (resizingRef.current = {
                    type: "col",
                    id: col,
                    startX: e.clientX,
                    startSize: colWidths[col],
                  })
                }
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-green-400"
              />
            </div>
          );
        })}

        {/* Rows + Cells */}
        {rows.map((row) => (
          <React.Fragment key={row}>
            {/* Row header */}
            <div
              className={`relative flex items-center justify-end text-black border border-gray-400 font-semibold pr-1
                ${(selectedCell.row === row) || (highlightBounds && row >= highlightBounds.startRow && row <= highlightBounds.endRow) ? "bg-green-200 text-green-800" : "bg-gray-100"}`}
              style={{ height: rowHeights[row] }}
            >
              {row}
              {/* Row resize handle */}
              <div
                onMouseDown={(e) =>
                  (resizingRef.current = {
                    type: "row",
                    id: row,
                    startY: e.clientY,
                    startSize: rowHeights[row],
                  })
                }
                className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-green-400"
              />
            </div>

            {/* Cells */}
            {columns.map((col) => {
              const isSelected = selectedCell.row === row && selectedCell.col === col;
              const isInRange = isInSelection(row, col);
              const isMultiSelection = !!selectionBounds && (selectionBounds.endRow > selectionBounds.startRow || selectionBounds.endColIdx > selectionBounds.startColIdx);
              const showActiveBorder =
                isSelected &&
                !isEditingFormula &&
                !(selectionRange &&
                  (selectionRange.start.row !== selectionRange.end.row ||
                    selectionRange.start.col !== selectionRange.end.col));

              return (
                <div
                  key={`${row}-${col}`}
                  className={`relative 
                    hover:bg-green-100 
                    ${isInRange ? (isSelected && isMultiSelection ? "bg-green-200" : "bg-green-100") : ""}
                    ${showActiveBorder ? 'border-2 border-gray-900' : 'border border-gray-300'}
                    -mx-px -mt-px
                    ${isSelected ? 'z-10' : 'z-0'}`}
                  style={{
                    width: colWidths[col],
                    height: rowHeights[row],
                  }}
                  onMouseDown={(e) => {
                    // If we're editing another cell that contains a formula (starts with '='),
                    // optionally insert the clicked cell reference into that formula at the caret instead
                    const clickedKey = `${row}-${col}`;
                    const currentEditingKey = editingKey;
                    if (currentEditingKey && currentEditingKey !== clickedKey) {
                      const rawEditing = cellContents[currentEditingKey] ?? "";
                      if (typeof rawEditing === "string" && rawEditing.startsWith("=")) {
                        const editEl = inputRefs.current[currentEditingKey];
                        const selStart = editEl && typeof editEl.selectionStart === "number" ? editEl.selectionStart : rawEditing.length;
                        const selEnd = editEl && typeof editEl.selectionEnd === "number" ? editEl.selectionEnd : selStart;

                        const hasSelection = selEnd > selStart;

                        const getPrevNonWhitespaceChar = (value, index) => {
                          for (let i = index - 1; i >= 0; i--) {
                            const ch = value[i];
                            if (ch && !/\s/.test(ch)) return ch;
                          }
                          return undefined;
                        };

                        const triggers = new Set(["=", "+", "-", "*", "/", "^", ":", ",", "("]);
                        const prevChar = getPrevNonWhitespaceChar(rawEditing, selStart);
                        const shouldInsertRef =
                          (formulaPick && formulaPick.key === currentEditingKey) ||
                          hasSelection ||
                          prevChar === undefined ||
                          triggers.has(prevChar);

                        if (shouldInsertRef) {
                          e.preventDefault();
                          e.stopPropagation();

                          const ref = `${col}${row}`;

                          // If we are in function picking mode for this editing cell, constrain insertion
                          if (formulaPick && formulaPick.key === currentEditingKey) {
                            // Determine current parameter substring boundaries: from paramStart to next ')' or ','
                            const paramStart = Math.min(formulaPick.paramStart ?? 0, rawEditing.length);
                            let scanIdx = paramStart;
                            let paramEnd = rawEditing.length;
                            for (let i = paramStart; i < rawEditing.length; i++) {
                              const ch = rawEditing[i];
                              if (ch === ')' || ch === ',') { paramEnd = i; break; }
                            }

                            const segment = rawEditing.slice(paramStart, paramEnd);
                            const colonIdx = segment.indexOf(':');

                            let newSegment;
                            let newCaretOffsetFromStart;
                            if (formulaPick.stage === 'start') {
                              // Replace entire segment up to ':'/end with the single ref
                              newSegment = ref + (colonIdx >= 0 ? segment.slice(colonIdx) : segment.slice(segment.length));
                              newCaretOffsetFromStart = ref.length + (colonIdx >= 0 ? segment.length - segment.length : 0);
                              // Highlight single cell
                              setSelectionRange({ start: { row, col }, end: { row, col } });
                              setFormulaPick((prev) => prev ? { ...prev, startCell: { row, col } } : prev);
                            } else {
                              // stage === 'end' -> ensure a ':' exists and replace the part after ':' with ref
                              if (colonIdx === -1) {
                                newSegment = (formulaPick.startCell ? `${formulaPick.startCell.col}${formulaPick.startCell.row}` : '') + ':' + ref;
                              } else {
                                newSegment = segment.slice(0, colonIdx + 1) + ref;
                              }
                              newCaretOffsetFromStart = newSegment.length;

                              // Highlight range from startCell to clicked
                              const start = formulaPick.startCell || { row, col };
                              const startColIdx = columns.indexOf(start.col);
                              const endColIdx = columns.indexOf(col);
                              const b = {
                                startRow: Math.min(start.row, row),
                                endRow: Math.max(start.row, row),
                                startColIdx: Math.min(startColIdx, endColIdx),
                                endColIdx: Math.max(startColIdx, endColIdx),
                              };
                              const startCellForRange = { row: b.startRow, col: columns[b.startColIdx] };
                              const endCellForRange = { row: b.endRow, col: columns[b.endColIdx] };
                              setSelectionRange({ start: startCellForRange, end: endCellForRange });
                            }

                            const newRaw = rawEditing.slice(0, paramStart) + newSegment + rawEditing.slice(paramEnd);
                            setCellContents((prev) => ({ ...prev, [currentEditingKey]: newRaw }));

                            // keep focus and caret on the original editing cell
                            setTimeout(() => {
                              const el = inputRefs.current[currentEditingKey];
                              if (el) {
                                el.focus();
                                try {
                                  const caret = paramStart + newCaretOffsetFromStart;
                                  el.setSelectionRange(caret, caret);
                                } catch (err) {}
                              }
                            }, 0);

                            // keep selectedCell on the cell being edited
                            const [editRowStr, editCol] = currentEditingKey.split("-");
                            setSelectedCell({ row: Number(editRowStr), col: editCol });
                            return;
                          }

                          // Default behavior (not in constrained picking)
                          const newRaw = rawEditing.slice(0, selStart) + ref + rawEditing.slice(selEnd);
                          setCellContents((prev) => ({ ...prev, [currentEditingKey]: newRaw }));

                          setTimeout(() => {
                            const el = inputRefs.current[currentEditingKey];
                            if (el) {
                              el.focus();
                              try {
                                el.setSelectionRange(selStart + ref.length, selStart + ref.length);
                              } catch (err) {}
                            }
                          }, 0);

                          setSelectionRange({ start: { row, col }, end: { row, col } });

                          const [editRowStr, editCol] = currentEditingKey.split("-");
                          setSelectedCell({ row: Number(editRowStr), col: editCol });
                          return;
                        }
                      }
                    }

                    // Start selection (normal behavior when not inserting into formula)
                    selectingRef.current = true;
                    setEditMode("select");
                    setEditingKey(null);
                    setIsDoubleClickEdit(false);
                    const anchor = e.shiftKey ? selectedCell : { row, col };
                    dragAnchorRef.current = anchor;
                    setSelectedCell(anchor);
                    // Only create selection range for Shift+click or drag; simple click clears range (like arrow keys)
                    if (e.shiftKey) {
                      setSelectionRange({ start: anchor, end: { row, col } });
                    } else {
                      setSelectionRange(null);
                    }
                  }}
                  onDoubleClick={() => {
                    const keyHere = `${row}-${col}`;
                    setSelectedCell({ row, col });
                    setEditingKey(keyHere);
                    setEditMode("edit");
                    setIsDoubleClickEdit(true); // Mark as double-click edit mode
                    setTimeout(() => {
                      const el = inputRefs.current[keyHere];
                      if (el) {
                        el.focus();
                        try {
                          const len = el.value ? el.value.length : 0;
                          el.setSelectionRange(len, len);
                        } catch (e) {}
                      }
                    }, 0);
                  }}
                  onMouseEnter={() => {
                    // Update selection when dragging
                    if (!selectingRef.current || !dragAnchorRef.current) return;
                    setSelectionRange({ start: dragAnchorRef.current, end: { row, col } });
                  }}
                  onMouseUp={() => {
                    selectingRef.current = false;
                  }}
                >
                  <input
                    ref={(el) => (inputRefs.current[`${row}-${col}`] = el)}
                    type="text"
                    className="w-full h-full bg-transparent items-end text-left cursor-cell focus:outline-none px-1 "
                    value={
                      editingKey === `${row}-${col}`
                        ? (cellContents[`${row}-${col}`] || "")
                        : getDisplayForCell(row, col)
                    }
                    style={{ lineHeight: `${rowHeights[row]}px`, caretColor: (editMode === 'edit' && editingKey === `${row}-${col}`) ? undefined : 'transparent' }}
                    readOnly={!(editMode === 'edit' && editingKey === `${row}-${col}`)}
                    onChange={(e) =>
                      setCellContents((prev) => ({
                        ...prev,
                        [`${row}-${col}`]: e.target.value,
                      }))
                    }
                    onFocus={() => setSelectedCell({ row, col })}
                    onBlur={() => { 
                      if (editingKey === `${row}-${col}`) {
                        setEditingKey(null); 
                        setEditMode('select');
                        setIsDoubleClickEdit(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      const keyHere = `${row}-${col}`;
                      const inEditHere = editMode === 'edit' && editingKey === keyHere;
                      if (!inEditHere) {
                        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
                        const isErase = e.key === 'Backspace' || e.key === 'Delete';
                        if (isPrintable || isErase) {
                          e.preventDefault();
                          const nextVal = isErase ? '' : e.key;
                          setCellContents((prev) => ({ ...prev, [keyHere]: nextVal }));
                          setSelectionRange(null);
                          setEditingKey(keyHere);
                          setEditMode('edit');
                          setIsDoubleClickEdit(false); // Mark as single-click+type edit mode
                          setTimeout(() => {
                            const el = inputRefs.current[keyHere];
                            if (el) {
                              el.focus();
                              try {
                                const caret = (isErase ? 0 : nextVal.length);
                                el.setSelectionRange(caret, caret);
                              } catch (_) {}
                            }
                          }, 0);
                          return;
                        }
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const maxRow = rows.length;
                        if (e.shiftKey) {
                          if (row > 1) setSelectedCell({ row: Math.max(row - 1, 1), col });
                        } else {
                          if (row < maxRow) setSelectedCell({ row: row + 1, col });
                        }
                        // Exit edit mode when pressing Enter
                        if (inEditHere) {
                          setEditingKey(null);
                          setEditMode("select");
                          setIsDoubleClickEdit(false);
                        }
                        return;
                      }

                      // Handle Tab and Shift+Tab to move right/left like Excel
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const currentColIndex = columns.indexOf(col);
                        const newColIndex = e.shiftKey
                          ? Math.max(currentColIndex - 1, 0)
                          : Math.min(currentColIndex + 1, columns.length - 1);
                        const newCol = columns[newColIndex];
                        setSelectedCell({ row, col: newCol });
                        setSelectionRange(null);
                        setEditingKey(null);
                        setEditMode("select");
                        setIsDoubleClickEdit(false);
                        return;
                      }

                      const colIndex = columns.indexOf(col);
                      if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                        // If in edit mode but NOT from double-click, arrow keys should move between cells
                        // If in edit mode from double-click, allow default behavior (cursor moves within cell)
                        if (!inEditHere || (inEditHere && !isDoubleClickEdit)) {
                          e.preventDefault();
                          let newRow = row;
                          let newColIndex = colIndex;
                          if (e.key === "ArrowDown")
                            newRow = Math.min(row + 1, rows.length);
                          if (e.key === "ArrowUp")
                            newRow = Math.max(row - 1, 1);
                          if (e.key === "ArrowRight")
                            newColIndex = Math.min(colIndex + 1, columns.length - 1);
                          if (e.key === "ArrowLeft")
                            newColIndex = Math.max(colIndex - 1, 0);
                          const newCol = columns[newColIndex];
                          setSelectedCell({ row: newRow, col: newCol });
                          setSelectionRange(null);
                          setEditingKey(null);
                          setEditMode("select");
                          setIsDoubleClickEdit(false);
                        }
                        // If inEditHere && isDoubleClickEdit, allow default behavior (cursor moves within cell)
                      }

                      // Track function argument picking within parentheses like Excel
                      // Start picking when user types '(' after a function token or any '('
                      try {
                        const el = inputRefs.current[keyHere];
                        const raw = cellContents[keyHere] ?? "";
                        const caret = el && typeof el.selectionStart === 'number' ? el.selectionStart : raw.length;

                        if (e.key === '(') {
                          // Next char position after insert becomes paramStart; use caret+1 prediction
                          const nextParamStart = caret + 1;
                          setFormulaPick({ key: keyHere, stage: 'start', paramStart: nextParamStart, startCell: undefined });
                          return;
                        }

                        // Typing ':' moves to end stage for current param
                        if (e.key === ':' && formulaPick && formulaPick.key === keyHere) {
                          setFormulaPick((prev) => prev ? { ...prev, stage: 'end' } : prev);
                          return;
                        }

                        // Comma or closing paren ends current picking session
                        if ((e.key === ',' || e.key === ')') && formulaPick && formulaPick.key === keyHere) {
                          setFormulaPick(null);
                          return;
                        }
                      } catch (_) {}
                    }}
                  />
                </div>
              );
            })}
          </React.Fragment>
        ))}
        {/* Selection overlay outline for multi-cell ranges */}
        {!isEditingFormula && selectionOverlay && (selectionBounds.endRow - selectionBounds.startRow > 0 || selectionBounds.endColIdx - selectionBounds.startColIdx > 0) && (
          <div
            className="pointer-events-none absolute border-2 border-black box-border z-10"
            style={{
              left: selectionOverlay.left,
              top: selectionOverlay.top,
              width: selectionOverlay.width,
              height: selectionOverlay.height,
            }}
          />
        )}

        {/* If editing a formula and there are range references, show a union marching-ants border around them */}
        {formulaRefBounds && (
          (() => {
            const rect = getRectForBounds(formulaRefBounds);
            return (
              <MarqueeBorder
                left={rect.left}
                top={rect.top}
                width={rect.width}
                height={rect.height}
                color="#3b82f6" /* blue */
                strokeWidth={2}
                dashArray="8 4"
                zIndex={80}
              />
            );
          })()
        )}

        {/* If editing a formula and there are explicit single refs (e.g., =A1+A4), draw discrete borders per cell */}
        {formulaSingleRefs && formulaSingleRefs.length > 0 && formulaSingleRefs.map((b, i) => {
          const rect = getRectForBounds(b);
          if (!rect) return null;
          return (
            <MarqueeBorder
              key={`single-ref-${i}`}
              left={rect.left}
              top={rect.top}
              width={rect.width}
              height={rect.height}
              color="#3b82f6"
              strokeWidth={2}
              dashArray="8 4"
              zIndex={80}
            />
          );
        })}

        {/* Fill handle component - also show for single selected cell */}
        {!isEditingFormula && (selectionOverlay || selectedCellOverlay) && (
          <FillHandle
            overlayRect={selectionOverlay || selectedCellOverlay}
            selectionBounds={selectionBounds || selectedCellBounds}
            clientToCell={clientToCell}
            getUnionRangeFromDrag={getUnionRangeFromDrag}
            getRectForBounds={getRectForBounds}
            onApplyFill={(src, final) => {
              applyFill(src, final, final.axis);
              const start = { row: final.startRow, col: columns[final.startColIdx] };
              const end = { row: final.endRow, col: columns[final.endColIdx] };
              setSelectionRange({ start, end });
              setSelectedCell(end);
            }}
            onPreviewChange={(bounds) => setFillPreviewBounds(bounds)}
          />
        )}
      </div>
    </div>
  );
}
// WORKING (with marching ants border for selection & formula references)