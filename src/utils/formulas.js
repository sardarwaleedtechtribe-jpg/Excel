/**
 * Main formula utilities module that composes all formula-related functions
 */

import { getCellValueByKey as getCellValueByKeyFn } from "./cellValue.js";
import { expandRange as expandRangeFn } from "./rangeExpansion.js";
import { evaluateFunctions as evaluateFunctionsFn } from "./functionEvaluation.js";
import { evaluateFormula as evaluateFormulaFn } from "./formulaEvaluation.js";
import { getDisplayForCell as getDisplayForCellFn } from "./cellDisplay.js";

/**
 * Creates formula utilities with all dependencies properly bound
 * @param {string[]} columns - Array of valid column letters
 * @param {number} rowsLength - Total number of rows
 * @param {Function} getRawByKey - Function to get raw cell content by key
 * @returns {Object} - Object containing evaluateFormula and getDisplayForCell functions
 */
export function createFormulaUtils(columns, rowsLength, getRawByKey) {
  // Create closures for functions that need circular dependencies
  // We'll define these using let so they can reference each other
  let evaluateFormulaBound;
  let getCellValueByKeyBound;
  let expandRangeBound;
  let evaluateFunctionsBound;

  // Create getCellValueByKey with bound dependencies
  getCellValueByKeyBound = (key, visiting) => {
    return getCellValueByKeyFn(
      key,
      visiting,
      getRawByKey,
      (formulaExpr, row, col, vis) => evaluateFormulaBound(formulaExpr, row, col, vis)
    );
  };

  // Create expandRange with bound dependencies
  expandRangeBound = (startRef, endRef, visiting) => {
    return expandRangeFn(
      startRef,
      endRef,
      visiting, 
      columns,
      getCellValueByKeyBound
    );
  };

  // Create evaluateFunctions with bound dependencies
  evaluateFunctionsBound = (expr, visiting) => {
    return evaluateFunctionsFn(
      expr,
      visiting,
      expandRangeBound,
      getCellValueByKeyBound
    );
  };

  // Create evaluateFormula with bound dependencies
  evaluateFormulaBound = (formulaExpr, currentRow, currentCol, visiting = new Set()) => {
    return evaluateFormulaFn(
      formulaExpr,
      currentRow,
      currentCol,
      visiting,
      columns,
      rowsLength,
      evaluateFunctionsBound,
      getCellValueByKeyBound
    );
  };

  // Create getDisplayForCell with bound dependencies
  const getDisplayForCellBound = (row, col) => {
    return getDisplayForCellFn(row, col, getRawByKey, evaluateFormulaBound);
  };

  return {
    evaluateFormula: evaluateFormulaBound,
    getDisplayForCell: getDisplayForCellBound,
  };
}