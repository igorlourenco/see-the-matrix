/**
 * Format a number for display: at most `decimals` places, no trailing zeros,
 * and never "-0" (which shows up a lot after rotations).
 */
export function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return String(n)
  const rounded = Number(n.toFixed(decimals))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/**
 * Snap a dragged coordinate: magnetic to integers (nice numbers in the math
 * panel), otherwise one decimal.
 */
export function snap(x: number): number {
  const r = Math.round(x)
  if (Math.abs(x - r) < 0.15) return r
  return Math.round(x * 10) / 10
}
