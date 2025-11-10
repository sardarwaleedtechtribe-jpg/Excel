
/**
 * FillHandleButton - The drag handle button that appears at the bottom-right
 * of the selected cell/range. Users click and drag this to fill cells.
*/

import React from "react";

export default function FillHandleButton({ overlayRect, onMouseDown }) {
  // Validate overlayRect to prevent runtime errors
  if (!overlayRect || typeof overlayRect.left !== 'number' || typeof overlayRect.width !== 'number') {
    return null;
  }

  return (
    <div
      className="absolute z-20 bg-green-600 border border-white"
      style={{
        left: `${overlayRect.left + overlayRect.width - 5}px`,
        top: `${overlayRect.top + overlayRect.height - 5}px`,
        width: '8px',
        height: '8px',
        cursor: 'crosshair',
      }}
      onMouseDown={onMouseDown}
    />
  );
}

