/**
 * useFillHandleDrag - Custom hook that handles the drag logic for the fill handle.
 * 
 * @param {Function} clientToCell - Converts client coordinates to cell coordinates
 * @param {Function} getUnionRangeFromDrag - Calculates the union range from drag start to end
 * @param {Function} onApplyFill - Callback when fill is applied (srcBounds, finalBounds)
 * @param {Function} onPreviewChange - Optional callback when preview bounds change
 * @param {Object} selectionBounds - The initial selection bounds to start dragging from
 * @returns {Object} - { previewBounds, startDrag }
*/
import { useEffect, useRef, useState, useCallback } from "react";
export function useFillHandleDrag({
  clientToCell,
  getUnionRangeFromDrag,
  onApplyFill,
  onPreviewChange,
  selectionBounds,
}) { 
  const dragRef = useRef({ active: false, startRange: null });
  const previewBoundsRef = useRef(null); // Use ref to avoid stale closures
  
  // Store function refs to avoid recreating event listeners on every render
  const clientToCellRef = useRef(clientToCell);
  const getUnionRangeFromDragRef = useRef(getUnionRangeFromDrag);
  const onApplyFillRef = useRef(onApplyFill);
  const onPreviewChangeRef = useRef(onPreviewChange);
  
  const [previewBounds, setPreviewBounds] = useState(null);

  // Update function refs when they change
  useEffect(() => {
    clientToCellRef.current = clientToCell;
    getUnionRangeFromDragRef.current = getUnionRangeFromDrag;
    onApplyFillRef.current = onApplyFill;
    onPreviewChangeRef.current = onPreviewChange;
  }, [clientToCell, getUnionRangeFromDrag, onApplyFill, onPreviewChange]);

  // Start dragging from the given selection bounds
  const startDrag = useCallback(() => {
    if (!selectionBounds) return;
    dragRef.current = {
      active: true,
      startRange: { ...selectionBounds },
    };
    previewBoundsRef.current = null;
    setPreviewBounds(null);
    // Force crosshair cursor on all elements during drag
    document.documentElement.classList.add('fill-handle-dragging');
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
    
    // Inject style to override all cursor styles during drag
    const styleId = 'fill-handle-cursor-override';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .fill-handle-dragging * {
          cursor: crosshair !important;
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
      
      const union = getUnionRangeFromDragRef.current(dragRef.current.startRange, endCell);
      previewBoundsRef.current = union;
      setPreviewBounds(union);
      if (onPreviewChangeRef.current) {
        onPreviewChangeRef.current(union);
      }
    };

    const onMouseUp = () => {
      // Restore cursor and user selection
      document.documentElement.classList.remove('fill-handle-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      if (!dragRef.current.active || !dragRef.current.startRange) {
        dragRef.current = { active: false, startRange: null };
        previewBoundsRef.current = null;
        setPreviewBounds(null);
        if (onPreviewChangeRef.current) {
          onPreviewChangeRef.current(null);
        }
        return;
      }

      const src = dragRef.current.startRange;
      const final = previewBoundsRef.current; // Use ref to get latest value
      dragRef.current = { active: false, startRange: null };
      previewBoundsRef.current = null;
      setPreviewBounds(null);
      if (onPreviewChangeRef.current) {
        onPreviewChangeRef.current(null);
      }

      // Only apply fill if the bounds actually changed
      if (!final) return;
      if (
        final.startRow !== src.startRow ||
        final.endRow !== src.endRow ||
        final.startColIdx !== src.startColIdx ||
        final.endColIdx !== src.endColIdx
      ) {
        onApplyFillRef.current(src, final);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      // Cleanup: restore cursor if component unmounts during drag
      if (dragRef.current.active) {
        document.documentElement.classList.remove('fill-handle-dragging');
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

