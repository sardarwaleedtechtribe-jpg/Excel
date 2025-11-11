import React from "react";
import { useMoveDrag } from "./hooks/useMoveDrag";
import MoveHandlePreview from "./MoveHandlePreview";

/**
 * MoveHandle - Component that detects when the cursor is over the border of a selected cell/range
 * and allows dragging to move the cell contents to another location.
 * 
 * @param {Object} overlayRect - The position and size of the overlay { left, top, width, height }
 * @param {Object} selectionBounds - The selected cell/range bounds { startRow, endRow, startColIdx, endColIdx }
 * @param {Function} clientToCell - Converts client coordinates to cell coordinates
 * @param {Function} getRectForBounds - Converts bounds to pixel rectangle coordinates
 * @param {Function} colToIndex - Converts column letter to index
 * @param {Function} onMoveCells - Callback when cells are moved (srcBounds, destBounds)
 * @param {Function} onPreviewChange - Optional callback when preview bounds change
 */
const BORDER_WIDTH = 4; // Width of the border detection zone in pixels
const FILL_HANDLE_SIZE = 8; // Size of the fill handle to exclude from border detection

export default function MoveHandle({
  overlayRect,
  selectionBounds,
  clientToCell,
  getRectForBounds,
  colToIndex,
  onMoveCells,
  onPreviewChange,
}) {
  const { previewBounds, startDrag } = useMoveDrag({
    clientToCell,
    getRectForBounds,
    colToIndex,
    onMoveCells,
    onPreviewChange,
    selectionBounds,
  });

  // Convert preview bounds to pixel coordinates for rendering
  const previewRect = previewBounds ? getRectForBounds(previewBounds) : null;

  // Handle mouse down on the border
  const handleMouseDown = (e) => {
    e.stopPropagation();
    const startCell = clientToCell(e.clientX, e.clientY);
    if (startCell) {
      startDrag(startCell);
    }
  };

  // Create border detection zones
  if (!overlayRect) return null;

  const { left, top, width, height } = overlayRect;
  const right = left + width;
  const bottom = top + height;

  return (
    <>
      {/* Top border */}
      <div
        className="absolute"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${BORDER_WIDTH}px`,
          cursor: 'move',
          pointerEvents: 'auto',
          zIndex: 15,
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => { document.body.style.cursor = 'move'; }}
        onMouseLeave={() => { 
          if (!document.documentElement.classList.contains('move-dragging')) {
            document.body.style.cursor = ''; 
          }
        }}
      />
      
      {/* Bottom border (excluding fill handle area) */}
      <div
        className="absolute"
        style={{
          left: `${left}px`,
          top: `${bottom - BORDER_WIDTH}px`,
          width: `${width - FILL_HANDLE_SIZE}px`,
          height: `${BORDER_WIDTH}px`,
          cursor: 'move',
          pointerEvents: 'auto',
          zIndex: 15,
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => { document.body.style.cursor = 'move'; }}
        onMouseLeave={() => { 
          if (!document.documentElement.classList.contains('move-dragging')) {
            document.body.style.cursor = ''; 
          }
        }}
      />
      
      {/* Left border */}
      <div
        className="absolute"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${BORDER_WIDTH}px`,
          height: `${height}px`,
          cursor: 'move',
          pointerEvents: 'auto',
          zIndex: 15,
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => { document.body.style.cursor = 'move'; }}
        onMouseLeave={() => { 
          if (!document.documentElement.classList.contains('move-dragging')) {
            document.body.style.cursor = ''; 
          }
        }}
      />
      
      {/* Right border */}
      <div
        className="absolute"
        style={{
          left: `${right - BORDER_WIDTH}px`,
          top: `${top}px`,
          width: `${BORDER_WIDTH}px`,
          height: `${height}px`,
          cursor: 'move',
          pointerEvents: 'auto',
          zIndex: 15,
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => { document.body.style.cursor = 'move'; }}
        onMouseLeave={() => { 
          if (!document.documentElement.classList.contains('move-dragging')) {
            document.body.style.cursor = ''; 
          }
        }}
      />

      {/* The preview rectangle showing where cells will be moved */}
      <MoveHandlePreview previewRect={previewRect} />
    </>
  );
}

