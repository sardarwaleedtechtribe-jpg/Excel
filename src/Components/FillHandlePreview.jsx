import React from "react";

/**
 * FillHandlePreview - Shows a blue border preview of the cells that will be filled
 * when the user drags the fill handle.
 */
export default function FillHandlePreview({ previewRect }) {
  // Validate previewRect to prevent runtime errors
  if (!previewRect || typeof previewRect.left !== 'number' || typeof previewRect.width !== 'number') {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute border-2 border-blue-500 box-border z-10"
      style={{
        left: previewRect.left,
        top: previewRect.top,
        width: previewRect.width,
        height: previewRect.height,
      }}
    />
  );
}

