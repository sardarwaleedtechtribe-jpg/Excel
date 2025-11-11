import React from "react";

/**
 * MoveHandlePreview - Shows a preview border of where the cells will be moved
 * when the user drags the selection border.
 */
export default function MoveHandlePreview({ previewRect }) {
  // Validate previewRect to prevent runtime errors
  if (!previewRect || typeof previewRect.left !== 'number' || typeof previewRect.width !== 'number') {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute border-2 border-orange-500 box-border z-10 bg-orange-100 bg-opacity-30"
      style={{
        left: previewRect.left,
        top: previewRect.top,
        width: previewRect.width,
        height: previewRect.height,
      }}
    />
  );
}

