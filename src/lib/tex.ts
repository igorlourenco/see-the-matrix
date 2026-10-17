/** Small helpers for building KaTeX strings. Colors must be hex (KaTeX rejects oklch). */
import { fmt } from './format'
import type { Mat2, Vec2 } from './linalg'

export const color = (hex: string, tex: string) => `\\textcolor{${hex}}{${tex}}`
export const n = (x: number) => fmt(x)
/** Wrap negatives in parentheses when they're multiplied: 2·(−1), not 2·−1. */
export const p = (x: number) => (x < 0 ? `(${fmt(x)})` : fmt(x))

export const ihat = (hex: string) => color(hex, '\\hat{\\imath}')
export const jhat = (hex: string) => color(hex, '\\hat{\\jmath}')

export const col = (v: Vec2, hex?: string) => {
  const tex = `\\begin{bmatrix} ${n(v[0])} \\\\ ${n(v[1])} \\end{bmatrix}`
  return hex ? color(hex, tex) : tex
}

/** A with its columns colored like î and ĵ on the canvas. */
export const matrix = (A: Mat2, colors?: { i: string; j: string }) => {
  const ci = (x: number) => (colors ? color(colors.i, n(x)) : n(x))
  const cj = (x: number) => (colors ? color(colors.j, n(x)) : n(x))
  return `\\begin{bmatrix} ${ci(A.i[0])} & ${cj(A.j[0])} \\\\ ${ci(A.i[1])} & ${cj(A.j[1])} \\end{bmatrix}`
}

/** "v1" → v₁ in bold; anything else is shown as-is. */
export const vecName = (name: string) => {
  const m = /^([A-Za-z]+)_?(\d+)$/.exec(name)
  if (m) return `\\mathbf{${m[1]}}_{${m[2]}}`
  return `\\textbf{${name.replace(/_/g, '\\_')}}`
}
