import React from "react";
import FillHandleButton from "./FillHandleButton";
import FillHandlePreview from "./FillHandlePreview";
import { useFillHandleDrag } from "./hooks/useFillHandleDrag";

/**
 * FillHandle - Main component that displays a fill handle button and preview
 * for Excel-like cell filling functionality.
 * 
 * @param {Object} overlayRect - The position and size of the overlay { left, top, width, height }
 * @param {Object} selectionBounds - The selected cell/range bounds { startRow, endRow, startColIdx, endColIdx }
 * @param {Function} clientToCell - Converts client coordinates to cell coordinates
 * @param {Function} getUnionRangeFromDrag - Calculates the union range from drag start to end
 * @param {Function} getRectForBounds - Converts bounds to pixel rectangle coordinates
 * @param {Function} onApplyFill - Callback when fill is applied (srcBounds, finalBounds)
 * @param {Function} onPreviewChange - Optional callback when preview bounds change
 */

export default function FillHandle({
  overlayRect, // { left, top, width, height }
  selectionBounds, // { startRow, endRow, startColIdx, endColIdx }
  clientToCell,
  getUnionRangeFromDrag,
  getRectForBounds,
  onApplyFill, // (srcBounds, finalBounds) => void 
  onPreviewChange, // optional: (previewBounds|null) => void
}) {
  // Use custom hook to handle all drag logic
  const { previewBounds, startDrag } = useFillHandleDrag({
    clientToCell,
    getUnionRangeFromDrag,
    onApplyFill,
    onPreviewChange,
    selectionBounds,
  });

  // Convert preview bounds to pixel coordinates for rendering
  const previewRect = previewBounds ? getRectForBounds(previewBounds) : null;

  // Handle mouse down on the drag handle button
  const handleMouseDown = (e) => {
    e.stopPropagation();
    startDrag();
  };

  return (
    <>
      {/* The green drag handle button at the bottom-right of the selection */}
      <FillHandleButton overlayRect={overlayRect} onMouseDown={handleMouseDown} />

      {/* The blue preview rectangle showing where cells will be filled */}
      <FillHandlePreview previewRect={previewRect} />
    </>
  );
}