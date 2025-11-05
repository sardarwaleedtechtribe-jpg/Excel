import React, { useState, useEffect, useRef } from "react";

const columns = Array.from({ length: 18 }, (_, i) =>
  String.fromCharCode(65 + i)
)
const rows = Array.from({ length: 27 }, (_, i) => i + 1);

export default function ExcelGrid() {
  const [selectedCell, setSelectedCell] = useState({ row: 1, col: "A" });
  const [selectionRange, setSelectionRange] = useState(null); // { start: {row,col}, end: {row,col} }
  const [cellContents, setCellContents] = useState({});
  const [colWidths, setColWidths] = useState(
    columns.reduce((acc, col) => ({ ...acc, [col]: 80 }), {})
  );
  const [rowHeights, setRowHeights] = useState(
    rows.reduce((acc, row) => ({ ...acc, [row]: 25 }), {})
  );
  const inputRefs = useRef({});
  const resizingRef = useRef(null);
  const selectingRef = useRef(false);
  const dragAnchorRef = useRef(null);
  const containerRef = useRef(null);
  const fillDragRef = useRef({ active: false, startRange: null, previewEnd: null });

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
    const endCol = columns[endColIdx];
    const left = getLeftForCol(startCol);
    const top = getTopForRow(startRow);
    let width = 0;
    for (let i = startColIdx; i <= endColIdx; i++) width += colWidths[columns[i]];
    let height = 0;
    for (let r = startRow; r <= endRow; r++) height += rowHeights[r];
    return { left, top, width, height };
  };

  const selectionOverlay = getSelectionOverlayStyle();

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
    if (colIdx === -1) colIdx = Math.max(0, Math.min(columns.length - 1, columns.findIndex((_, i) => {
      return false;
    })));

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
    const endCol = columns[bounds.endColIdx];
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
          for (let r = src.endRow + 1; r <= ext.endRow; r++) {
            let value;
            if (allNums && sourceVals.length >= 1) {
              value = step !== 0 && sourceVals.length >= 2 ? String(current + step) : String(Number(sourceVals[seqIndex % sourceVals.length]));
              current = Number(value);
            } else {
              value = String(sourceVals[seqIndex % sourceVals.length] ?? "");
            }
            updates[`${r}-${columns[c]}`] = value;
            seqIndex++;
          }
        }
        if (ext.startRow < src.startRow) {
          // fill upward
          let seqIndex = 0;
          let current = allNums ? Number(sourceVals[0]) : null;
          for (let r = src.startRow - 1; r >= ext.startRow; r--) {
            let value;
            if (allNums && sourceVals.length >= 2 && step !== 0) {
              current = current - step;
              value = String(current);
            } else if (allNums && sourceVals.length >= 1) {
              const pick = sourceVals[(sourceVals.length - 1 - (seqIndex % sourceVals.length) + sourceVals.length) % sourceVals.length];
              value = String(pick ?? "");
            } else {
              const pick = sourceVals[(sourceVals.length - 1 - (seqIndex % sourceVals.length) + sourceVals.length) % sourceVals.length];
              value = String(pick ?? "");
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
          for (let c = src.endColIdx + 1; c <= ext.endColIdx; c++) {
            let value;
            if (allNums && sourceVals.length >= 1) {
              value = step !== 0 && sourceVals.length >= 2 ? String(current + step) : String(Number(sourceVals[seqIndex % sourceVals.length]));
              current = Number(value);
            } else {
              value = String(sourceVals[seqIndex % sourceVals.length] ?? "");
            }
            updates[`${r}-${columns[c]}`] = value;
            seqIndex++;
          }
        }
        if (ext.startColIdx < src.startColIdx) {
          let seqIndex = 0;
          let current = allNums ? Number(sourceVals[0]) : null;
          for (let c = src.startColIdx - 1; c >= ext.startColIdx; c--) {
            let value;
            if (allNums && sourceVals.length >= 2 && step !== 0) {
              current = current - step;
              value = String(current);
            } else if (allNums && sourceVals.length >= 1) {
              const pick = sourceVals[(sourceVals.length - 1 - (seqIndex % sourceVals.length) + sourceVals.length) % sourceVals.length];
              value = String(pick ?? "");
            } else {
              const pick = sourceVals[(sourceVals.length - 1 - (seqIndex % sourceVals.length) + sourceVals.length) % sourceVals.length];
              value = String(pick ?? "");
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

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!fillDragRef.current.active || !fillDragRef.current.startRange) return;
      const endCell = clientToCell(e.clientX, e.clientY);
      if (!endCell) return;
      const union = getUnionRangeFromDrag(fillDragRef.current.startRange, endCell);
      fillDragRef.current.previewEnd = union;
      // trigger re-render
      setSelectedCell((s) => ({ ...s }));
    };
    const onMouseUp = () => {
      if (!fillDragRef.current.active || !fillDragRef.current.startRange || !fillDragRef.current.previewEnd) {
        fillDragRef.current = { active: false, startRange: null, previewEnd: null };
        return;
      }
      const src = fillDragRef.current.startRange;
      const final = fillDragRef.current.previewEnd;
      fillDragRef.current = { active: false, startRange: null, previewEnd: null };

      // Only apply if final extends beyond source
      if (
        final.startRow !== src.startRow ||
        final.endRow !== src.endRow ||
        final.startColIdx !== src.startColIdx ||
        final.endColIdx !== src.endColIdx
      ) {
        applyFill(src, final, final.axis);
        // Update selection to final
        const start = { row: final.startRow, col: columns[final.startColIdx] };
        const end = { row: final.endRow, col: columns[final.endColIdx] };
        setSelectionRange({ start, end });
        setSelectedCell(end);
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [colWidths, rowHeights, cellContents]);

  return (
    <div className="bg-gray-100 min-h-screen flex items-start justify-start overflow-auto">
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
          const isColInRange = !!selectionBounds && colIdx >= selectionBounds.startColIdx && colIdx <= selectionBounds.endColIdx;
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
                ${(selectedCell.row === row) || (selectionBounds && row >= selectionBounds.startRow && row <= selectionBounds.endRow) ? "bg-green-200 text-green-800" : "bg-gray-100"}`}
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

              return (
                <div
                  key={`${row}-${col}`}
                  className={`relative 
                    hover:bg-green-100 
                    ${isInRange ? (isSelected && isMultiSelection ? "bg-green-200" : "bg-green-100") : ""}
                    ${isSelected && !(selectionRange && (selectionRange.start.row !== selectionRange.end.row || selectionRange.start.col !== selectionRange.end.col)) 
                      ? 'border-2 border-gray-900' 
                      : 'border border-gray-300'}
                    -mx-px -mt-px
                    ${isSelected ? 'z-10' : 'z-0'}`}
                  style={{
                    width: colWidths[col],
                    height: rowHeights[row],
                  }}
                  onMouseDown={(e) => {
                    // Start selection
                    selectingRef.current = true;
                    const anchor = e.shiftKey ? selectedCell : { row, col };
                    dragAnchorRef.current = anchor;
                    setSelectedCell(anchor);
                    setSelectionRange({ start: anchor, end: { row, col } });
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
                    className="w-full h-full bg-transparent caret-transparent items-end text-left cursor-cell focus:outline-none px-1 "
                    value={cellContents[`${row}-${col}`] || ""}
                    onChange={(e) =>
                      setCellContents((prev) => ({
                        ...prev,
                        [`${row}-${col}`]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const maxRow = rows.length;
                        if (row < maxRow) setSelectedCell({ row: row + 1, col });
                        return;
                      }

                      const colIndex = columns.indexOf(col);
                      if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) {
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
                      }
                    }}
                  />
                </div>
              );
            })}
          </React.Fragment>
        ))}
        {/* Selection overlay outline for multi-cell ranges */}
        {selectionOverlay && (selectionBounds.endRow - selectionBounds.startRow > 0 || selectionBounds.endColIdx - selectionBounds.startColIdx > 0) && (
          <div
            style={{
              '--left':     `${selectionOverlay.left}px`,
              '--top':      `${selectionOverlay.top}px`,
              '--width':    `${selectionOverlay.width}px`,
              '--height':   `${selectionOverlay.height}px`
            }}
            className="pointer-events-none absolute border-2 border-black box-border z-10 left-(--left) top-(--top) w-(--width) h-(--height)"
          />
        )}

        {/* Fill handle (small square) */}
        {selectionOverlay && (
          <div
            className="absolute z-20 bg-green-600 border border-white"
            style={{
              left: `${selectionOverlay.left + selectionOverlay.width - 5}px`,
              top: `${selectionOverlay.top + selectionOverlay.height - 5}px`,
              width: '8px',
              height: '8px',
              cursor: 'crosshair',
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!selectionBounds) return;
              fillDragRef.current = {
                active: true,
                startRange: { ...selectionBounds },
                previewEnd: null,
              };
            }}
          />
        )}

        {/* Fill preview overlay */}
        {fillDragRef.current.active && fillDragRef.current.previewEnd && (
          (() => {
            const rect = getRectForBounds(fillDragRef.current.previewEnd);
            return (
              <div
                style={{
                  '--left': `${rect.left}px`,
                  '--top': `${rect.top}px`,
                  '--width': `${rect.width}px`,
                  '--height': `${rect.height}px`,
                }}
                className="pointer-events-none absolute border-2 border-blue-500 box-border z-10 left-(--left) top-(--top) w-(--width) h-(--height)"
              />
            );
          })()
        )}
      </div>
    </div>
  );
}
