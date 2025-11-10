/**
 * Utility functions for cell operations
 */

/**
 * Clamps a number to 0 if it's not finite
 * @param {number} n - The number to clamp
 * @returns {number} - The clamped number
 */
export function clampNumber(n) {
  return Number.isFinite(n) ? n : 0;
}

/**
 * Checks if a column is in the valid range
 * @param {string} c - The column letter
 * @param {string[]} columns - Array of valid column letters
 * @returns {boolean} - True if column is in range
 */
export function colInRange(c, columns) {
  return columns.indexOf(c) >= 0;
}

