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

  return (
    <div className="bg-gray-100 min-h-screen flex items-start justify-start overflow-auto">
      <div
        className="grid border select-none"
        style={{
          gridTemplateColumns: `35px ${columns
            .map((c) => `${colWidths[c]}px`)
            .join(" ")}`,
          gridTemplateRows: `2rem ${rows
            .map((r) => `${rowHeights[r]}px`)
            .join(" ")}`,
        }}
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

              return (
                <div
                  key={`${row}-${col}`}
                  className={`border border-gray-300 hover:bg-green-100 rounded-none 
                    ${isInRange ? "bg-green-100" : ""} ${isSelected ? "border-green-600 border-2" : ""}`}
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
      </div>
    </div>
  );
}
