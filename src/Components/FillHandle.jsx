// import React, { useEffect, useRef } from "react";

// export default function FillHandle({
//   overlayRect, // { left, top, width, height }
//   selectionBounds, // { startRow, endRow, startColIdx, endColIdx }
//   clientToCell,
//   getUnionRangeFromDrag,
//   getRectForBounds,
//   onApplyFill, // (srcBounds, finalBounds) => void
// }) {
//   const dragRef = useRef({ active: false, startRange: null, previewEnd: null });

//   useEffect(() => {
//     const onMouseMove = (e) => {
//       if (!dragRef.current.active || !dragRef.current.startRange) return;
//       const endCell = clientToCell(e.clientX, e.clientY);
//       if (!endCell) return;
//       const union = getUnionRangeFromDrag(dragRef.current.startRange, endCell);
//       dragRef.current.previewEnd = union;
//     };
//     const onMouseUp = () => {
//       if (!dragRef.current.active || !dragRef.current.startRange || !dragRef.current.previewEnd) {
//         dragRef.current = { active: false, startRange: null, previewEnd: null };
//         return;
//       }
//       const src = dragRef.current.startRange;
//       const final = dragRef.current.previewEnd;
//       dragRef.current = { active: false, startRange: null, previewEnd: null };
//       if (
//         final.startRow !== src.startRow ||
//         final.endRow !== src.endRow ||
//         final.startColIdx !== src.startColIdx ||
//         final.endColIdx !== src.endColIdx
//       ) {
//         onApplyFill(src, final);
//       }
//     };
//     window.addEventListener("mousemove", onMouseMove);
//     window.addEventListener("mouseup", onMouseUp);
//     return () => {
//       window.removeEventListener("mousemove", onMouseMove);
//       window.removeEventListener("mouseup", onMouseUp);
//     };
//   }, [clientToCell, getUnionRangeFromDrag, onApplyFill]);

//   const previewRect = dragRef.current.active && dragRef.current.previewEnd
//     ? getRectForBounds(dragRef.current.previewEnd)
//     : null;

//   return (
//     <>
//       <div
//         className="absolute z-20 bg-green-600 border border-white"
//         style={{
//           left: `${overlayRect.left + overlayRect.width - 5}px`,
//           top: `${overlayRect.top + overlayRect.height - 5}px`,
//           width: '8px',
//           height: '8px',
//           cursor: 'crosshair',
//         }}
//         onMouseDown={(e) => {
//           e.stopPropagation();
//           if (!selectionBounds) return;
//           dragRef.current = {
//             active: true,
//             startRange: { ...selectionBounds },
//             previewEnd: null,
//           };
//         }}
//       />

//       {previewRect && (
//         <div
//           style={{
//             '--left': `${previewRect.left}px`,
//             '--top': `${previewRect.top}px`,
//             '--width': `${previewRect.width}px`,
//             '--height': `${previewRect.height}px`,
//           }}
//           className="pointer-events-none absolute border-2 border-blue-500 box-border z-10 left-(--left) top-(--top) w-(--width) h-(--height)"
//         />
//       )}
//     </>
//   );
// }


import React, { useEffect, useRef, useState } from "react";

export default function FillHandle({
  overlayRect, // { left, top, width, height }
  selectionBounds, // { startRow, endRow, startColIdx, endColIdx }
  clientToCell,
  getUnionRangeFromDrag,
  getRectForBounds,
  onApplyFill, // (srcBounds, finalBounds) => void
}) {
  // use state for preview so we re-render when it changes
  const dragRef = useRef({ active: false, startRange: null });
  const [previewBounds, setPreviewBounds] = useState(null);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragRef.current.active || !dragRef.current.startRange) return;
      const endCell = clientToCell(e.clientX, e.clientY);
      if (!endCell) return;
      const union = getUnionRangeFromDrag(dragRef.current.startRange, endCell);
      setPreviewBounds(union);
    };
    const onMouseUp = () => {
      if (!dragRef.current.active || !dragRef.current.startRange) {
        dragRef.current = { active: false, startRange: null };
        setPreviewBounds(null);
        return;
      }
      const src = dragRef.current.startRange;
      const final = previewBounds;
      dragRef.current = { active: false, startRange: null };
      setPreviewBounds(null);
      if (!final) return;
      if (
        final.startRow !== src.startRow ||
        final.endRow !== src.endRow ||
        final.startColIdx !== src.startColIdx ||
        final.endColIdx !== src.endColIdx
      ) {
        onApplyFill(src, final);
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [clientToCell, getUnionRangeFromDrag, onApplyFill, previewBounds]);

  const previewRect = previewBounds ? getRectForBounds(previewBounds) : null;

  return (
    <>
      <div
        className="absolute z-20 bg-green-600 border border-white"
        style={{
          left: `${overlayRect.left + overlayRect.width - 5}px`,
          top: `${overlayRect.top + overlayRect.height - 5}px`,
          width: '8px',
          height: '8px',
          cursor: 'crosshair',
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!selectionBounds) return;
          dragRef.current = {
            active: true,
            startRange: { ...selectionBounds },
          };
          setPreviewBounds(null);
        }}
      />

      {previewRect && (
        <div
          className="pointer-events-none absolute border-2 border-blue-500 box-border z-10"
          style={{
            left: previewRect.left,
            top: previewRect.top,
            width: previewRect.width,
            height: previewRect.height,
          }}
        />
      )}
    </>
  );
}