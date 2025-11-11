/**
 * useMoveDrag - Custom hook that handles the drag logic for moving cells.
 * 
 * @param {Function} clientToCell - Converts client coordinates to cell coordinates
 * @param {Function} getRectForBounds - Converts bounds to pixel rectangle coordinates
 * @param {Function} colToIndex - Converts column letter to index
 * @param {Function} onMoveCells - Callback when cells are moved (srcBounds, destBounds)
 * @param {Function} onPreviewChange - Optional callback when preview bounds change
 * @param {Object} selectionBounds - The initial selection bounds to start dragging from
 * @returns {Object} - { previewBounds, startDrag }
*/
import { useEffect, useRef, useState, useCallback } from "react";

export function useMoveDrag({
  clientToCell,
  getRectForBounds,
  colToIndex,
  onMoveCells,
  onPreviewChange,
  selectionBounds,
}) { 
  const dragRef = useRef({ active: false, startRange: null, startCell: null });
  const previewBoundsRef = useRef(null);
  
  // Store function refs to avoid recreating event listeners on every render
  const clientToCellRef = useRef(clientToCell);
  const getRectForBoundsRef = useRef(getRectForBounds);
  const colToIndexRef = useRef(colToIndex);
  const onMoveCellsRef = useRef(onMoveCells);
  const onPreviewChangeRef = useRef(onPreviewChange);
  
  const [previewBounds, setPreviewBounds] = useState(null);

  // Update function refs when they change
  useEffect(() => {
    clientToCellRef.current = clientToCell;
    getRectForBoundsRef.current = getRectForBounds;
    colToIndexRef.current = colToIndex;
    onMoveCellsRef.current = onMoveCells;
    onPreviewChangeRef.current = onPreviewChange;
  }, [clientToCell, getRectForBounds, colToIndex, onMoveCells, onPreviewChange]);

  // Start dragging from the given selection bounds
  const startDrag = useCallback((startCell) => {
    if (!selectionBounds) return;
    dragRef.current = {
      active: true,
      startRange: { ...selectionBounds },
      startCell: startCell,
    };
    previewBoundsRef.current = null;
    setPreviewBounds(null);
    // Force move cursor on all elements during drag
    document.documentElement.classList.add('move-dragging');
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
    
    // Inject style to override all cursor styles during drag
    const styleId = 'move-cursor-override';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .move-dragging * {
          cursor: move !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, [selectionBounds]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragRef.current.active || !dragRef.current.startRange) return;
      
      const endCell = clientToCellRef.current(e.clientX, e.clientY);
      if (!endCell) return;
      
      // Calculate destination bounds based on the start range and the end cell
      const src = dragRef.current.startRange;
      const rowCount = src.endRow - src.startRow + 1;
      const colCount = src.endColIdx - src.startColIdx + 1;
      
      // Convert column letter to index
      const destStartColIdx = colToIndexRef.current(endCell.col);
      if (destStartColIdx === null || destStartColIdx === undefined) return;
      
      // Calculate destination bounds
      // The destination top-left will be at endCell
      const destStartRow = endCell.row;
      const destEndRow = destStartRow + rowCount - 1;
      const destEndColIdx = destStartColIdx + colCount - 1;
      
      const preview = {
        startRow: destStartRow,
        endRow: destEndRow,
        startColIdx: destStartColIdx,
        endColIdx: destEndColIdx,
      };
      
      previewBoundsRef.current = preview;
      setPreviewBounds(preview);
      if (onPreviewChangeRef.current) {
        onPreviewChangeRef.current(preview);
      }
    };

    const onMouseUp = () => {
      // Restore cursor and user selection
      document.documentElement.classList.remove('move-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      if (!dragRef.current.active || !dragRef.current.startRange) {
        dragRef.current = { active: false, startRange: null, startCell: null };
        previewBoundsRef.current = null;
        setPreviewBounds(null);
        if (onPreviewChangeRef.current) {
          onPreviewChangeRef.current(null);
        }
        return;
      }

      const src = dragRef.current.startRange;
      const final = previewBoundsRef.current;
      dragRef.current = { active: false, startRange: null, startCell: null };
      previewBoundsRef.current = null;
      setPreviewBounds(null);
      if (onPreviewChangeRef.current) {
        onPreviewChangeRef.current(null);
      }

      // Only apply move if we have valid destination
      if (final && onMoveCellsRef.current) {
        onMoveCellsRef.current(src, final);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      // Cleanup: restore cursor if component unmounts during drag
      if (dragRef.current.active) {
        document.documentElement.classList.remove('move-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []); // Empty dependency array - functions are accessed via refs

  return {
    previewBounds,
    startDrag,
  };
}

