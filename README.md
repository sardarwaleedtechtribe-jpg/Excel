## Excel-like Grid (React + Vite) — Project Guide

This app implements a mini spreadsheet: select cells, type values or formulas, auto-fill with a drag handle, and evaluate functions like SUM/AVG/MIN/MAX. Read this file top-to-bottom to understand what happens and where.

### Quick start
- Install: `npm install`
- Run: `npm run dev`
- Open the app and try:
  - Click a cell and type text, a number, or a formula like `=A1+B1` or `=SUM(A1:B3)`
  - Double‑click a cell to edit in place
  - Drag the green square (bottom-right of selection) to auto‑fill numbers, text patterns (e.g., `Item 1`), or shift formulas

### Key files
- Grid UI and interactions: `src/Pages/ExcelGrid.jsx`
- Fill handle components: 
  - `src/Components/FillHandle.jsx`
  - `src/Components/FillHandleButton.jsx`
  - `src/Components/FillHandlePreview.jsx`
  - Hook: `src/Components/hooks/useFillHandleDrag.js`
- Formula system (display + evaluation):
  - Factory/wiring: `src/utils/formulas.js`
  - Display decision (raw vs evaluated): `src/utils/cellDisplay.js`
  - Cell value fetch (supports recursion): `src/utils/cellValue.js`
  - Expression evaluation: `src/utils/formulaEvaluation.js`
  - Function calls (SUM/AVG/MIN/MAX): `src/utils/functionEvaluation.js`
  - Range expansion (e.g., `A1:B3`): `src/utils/rangeExpansion.js`

### How the app works (end-to-end)
1) Render a 26×26 grid (A–Z, 1–26) and manage UI state
   - `ExcelGrid.jsx` holds state like `selectedCell`, `selectionRange`, `cellContents`, edit mode, and row/column sizes.
   - Each grid cell is a single `<input>` that shows either the raw text (when editing) or a display value (when not editing).

2) Displaying values vs formulas
   - When not editing, a cell’s value comes from `getDisplayForCell(row, col)`.
   - If the raw value starts with `=`, it is treated as a formula and evaluated; otherwise it’s shown as-is.
   - This display logic is created by `createFormulaUtils(...)` in `src/utils/formulas.js`, which wires together:
     - `cellDisplay` → decides to evaluate or not
     - `formulaEvaluation` → parses A1 refs and basic math
     - `functionEvaluation` → handles `SUM/AVG/AVERAGE/MIN/MAX`
     - `rangeExpansion` → turns `A1:B3` into numbers
     - `cellValue` → recursively resolves referenced cells

3) Editing cells
   - Single‑click then type: starts editing that cell.
   - Double‑click: enters in‑place edit mode (arrow keys move inside the text).
   - While typing a formula, clicking another cell inserts its reference (e.g., `A1`). Ranges can be built (`A1:B5`) and are highlighted.

4) Selection and fill handle
   - Selecting multiple cells shows a border. A small green square appears at the bottom‑right of the selection (or a single cell).
   - Dragging that square shows a blue preview (computed by `useFillHandleDrag`) and, on mouse up, applies the fill via `applyFill` in `ExcelGrid.jsx`.
   - Auto‑fill rules:
     - Numbers: continues sequences with constant step (e.g., 1,3 → 5,7,...).
     - Text+number patterns: auto-increment like `Item 1` → `Item 2` or `tm:3` → `tm:4`. Works with or without separators (space/colon/dash).
     - Formulas: references are shifted by the drag offset (rows/columns). Both single refs (`A1`) and ranges (`A1:B2`) are adjusted.

5) The custom drag hook
   - `useFillHandleDrag` attaches global mouse listeners, tracks the union of start and current drag range, emits a live preview, and calls back to apply the fill when you release the mouse.
   - This keeps drag logic independent from the UI components and easy to reason about.

### Supported formulas and syntax
- Basic arithmetic: `+ - * / ( )`
- Cell references: `A1`, `B5`, … (limited to the rendered grid)
- Ranges: `A1:B3`
- Functions (case‑insensitive): 
  - `SUM(...)`
  - `AVG(...)` / `AVERAGE(...)`
  - `MIN(...)`
  - `MAX(...)`

Examples:
- `=A1+B1`
- `=SUM(A1:A5)`
- `=AVERAGE(A1:B3)`

### Keyboard and mouse behavior (high level)
- Enter: moves down (Shift+Enter moves up); exits edit mode if editing
- Tab: moves right (Shift+Tab moves left)
- Arrow keys (not editing or single‑click edit): move selection
- Double‑click: edit inside the cell text
- Shift+Click/Drag: extend selection
- Drag green square: auto‑fill (numbers, text patterns, formulas with adjusted refs)

### Notes and limitations
- Grid is currently 26 columns (A–Z) × 26 rows (1–26).
- Non‑numeric values inside math are treated as 0 during evaluation.
- Errors (bad expression, invalid refs, division by zero) render as `#ERR`. Circular references render as `#CYCLE`.

### Where to change things
- Grid size or headers: `src/Pages/ExcelGrid.jsx` (`columns`, `rows` and sizing state)
- Fill behavior (sequence rules, pattern detection, formula shifting): `applyFill` and helpers inside `src/Pages/ExcelGrid.jsx`
- Supported functions or parsing: `src/utils/functionEvaluation.js`, `src/utils/formulaEvaluation.js`
- Drag UX: `src/Components/hooks/useFillHandleDrag.js` and `src/Components/FillHandle*.jsx`

If you need a specific tweak, search these files first. This structure keeps rendering (grid), behavior (drag, fill), and evaluation (formulas) clearly separated so you can modify each area confidently.

### Project structure

```text
my-app/
├─ src/
│  ├─ Pages/
│  │  └─ ExcelGrid.jsx                 # Main spreadsheet UI and logic (selection, editing, fill, sizing)
│  ├─ Components/
│  │  ├─ FillHandle.jsx                # Orchestrates drag handle + preview using the custom hook
│  │  ├─ FillHandleButton.jsx          # The small green square at selection bottom-right
│  │  ├─ FillHandlePreview.jsx         # Blue preview rectangle during drag
│  │  └─ hooks/
│  │     └─ useFillHandleDrag.js       # Custom hook for drag lifecycle, preview, and apply callback
│  ├─ utils/
│  │  ├─ formulas.js                   # Factory that wires all formula utilities together
│  │  ├─ cellDisplay.js                # Decides raw vs evaluated display for a cell
│  │  ├─ cellValue.js                  # Resolves a cell's value (supports recursion and cycles)
│  │  ├─ formulaEvaluation.js          # Core evaluator: refs → numbers, math evaluation, errors
│  │  ├─ functionEvaluation.js         # Implements SUM/AVG/AVERAGE/MIN/MAX over refs/ranges/numbers
│  │  └─ rangeExpansion.js             # Expands ranges like A1:B3 into numeric arrays
│  └─ main.jsx / App.jsx ...           # Standard React/Vite app bootstrap (not modified for grid logic)
├─ README.md                           # This guide
└─ package.json                        # Dependencies/scripts
```

- `Pages/ExcelGrid.jsx`: Single source of truth for grid state. Handles selection, editing modes, keyboard/mouse behavior, formula highlighting, auto‑fill application, and row/column sizing.
- `Components/FillHandle*`: Pure view + small coordination. All heavy drag logic lives in the hook; components render the handle and preview.
- `Components/hooks/useFillHandleDrag.js`: Manages drag state with global mouse listeners. Emits live preview bounds and triggers `onApplyFill` on mouse up.
- `utils/*`: Pure logic for formulas and display. Safe to unit test and reuse; no React here.
