/**
 * Core 2D linear algebra.
 *
 * Pure functions only: no React, no DOM. The canvas, the math panel and the
 * code panel are all derived from these, which is what keeps them in sync.
 */

/** A 2D vector [x, y]. */
export type Vec2 = readonly [number, number]

/**
 * A 2×2 matrix, stored by its COLUMNS.
 *
 *         î  ĵ
 *   A = [ a  b ]      A.i = [a, c]   where î = [1, 0] lands
 *       [ c  d ]      A.j = [b, d]   where ĵ = [0, 1] lands
 *
 * Storing columns instead of rows is deliberate, because it's the central idea
 * of the app: a matrix is only a record of where the two basis vectors land.
 */
export interface Mat2 {
  i: Vec2
  j: Vec2
}

/** Tolerance for "is this zero?" checks. User input has finite precision. */
export const TOL = 1e-6

export const IDENTITY: Mat2 = { i: [1, 0], j: [0, 1] }

// ---------------------------------------------------------------------------
// Vectors
// ---------------------------------------------------------------------------

export const add = (u: Vec2, v: Vec2): Vec2 => [u[0] + v[0], u[1] + v[1]]
export const scale = (k: number, v: Vec2): Vec2 => [k * v[0], k * v[1]]
export const dot = (u: Vec2, v: Vec2) => u[0] * v[0] + u[1] * v[1]
export const length = (v: Vec2) => Math.hypot(v[0], v[1])
export const approx = (x: number, y: number, tol = TOL) => Math.abs(x - y) < tol

export const normalize = (v: Vec2): Vec2 => {
  const len = length(v)
  return len < TOL ? [0, 0] : [v[0] / len, v[1] / len]
}

// ---------------------------------------------------------------------------
// Matrices
// ---------------------------------------------------------------------------

/** Named entries, for when you want the textbook letters. */
export const entries = (A: Mat2) => ({ a: A.i[0], b: A.j[0], c: A.i[1], d: A.j[1] })

/** Build a matrix from rows, the way NumPy and textbooks write it. */
export const fromRows = (rows: readonly [Vec2, Vec2]): Mat2 => ({
  i: [rows[0][0], rows[1][0]],
  j: [rows[0][1], rows[1][1]],
})

/**
 * Matrix-vector product A·v, written the way it should be understood.
 *
 * v = [x, y] means "x steps along î plus y steps along ĵ". The transformation
 * moves î to A.i and ĵ to A.j but keeps the same recipe (x, y), so
 *
 *   A·v = x·A.i + y·A.j
 *
 * This is the same number-crunching as the row-times-column rule, grouped by
 * column instead of by row.
 */
export const apply = (A: Mat2, v: Vec2): Vec2 => add(scale(v[0], A.i), scale(v[1], A.j))

/**
 * Composition: first apply A, then B (written B·A, read right to left).
 * The columns of B·A are where B sends A's columns.
 */
export const multiply = (B: Mat2, A: Mat2): Mat2 => ({ i: apply(B, A.i), j: apply(B, A.j) })

export const matApprox = (A: Mat2, B: Mat2, tol = TOL) =>
  approx(A.i[0], B.i[0], tol) &&
  approx(A.i[1], B.i[1], tol) &&
  approx(A.j[0], B.j[0], tol) &&
  approx(A.j[1], B.j[1], tol)

/**
 * Determinant: the signed factor by which A scales areas.
 *
 * The unit square (spanned by î and ĵ, area 1) becomes the parallelogram
 * spanned by A.i and A.j, whose signed area is ad − bc.
 *   |det| > 1 → areas grow;  |det| < 1 → areas shrink
 *   det < 0   → orientation flipped (ĵ is now clockwise from î, like a mirror)
 *   det = 0   → the plane is squashed onto a line (or a point)
 */
export const det = (A: Mat2) => {
  const { a, b, c, d } = entries(A)
  return a * d - b * c
}

export const trace = (A: Mat2) => A.i[0] + A.j[1]

/**
 * Inverse: the transformation that undoes A, so A⁻¹·(A·v) = v.
 *
 *   [a b]⁻¹      1    [ d  -b]
 *   [c d]    = ─────  [-c   a]
 *              ad−bc
 *
 * Doesn't exist when det = 0: once the plane is squashed onto a line, many
 * inputs share each output and there's no way to tell which one you started from.
 */
export function inverse(A: Mat2): Mat2 | null {
  const D = det(A)
  if (Math.abs(D) < TOL) return null
  const { a, b, c, d } = entries(A)
  return fromRows([
    [d / D, -b / D],
    [-c / D, a / D],
  ])
}

/**
 * Straight-line interpolation between two matrices, entry by entry.
 * The animation draws lerp(I, A, t) for t going from 0 to 1.
 */
export const lerpMatrix = (A: Mat2, B: Mat2, t: number): Mat2 => ({
  i: [A.i[0] + (B.i[0] - A.i[0]) * t, A.i[1] + (B.i[1] - A.i[1]) * t],
  j: [A.j[0] + (B.j[0] - A.j[0]) * t, A.j[1] + (B.j[1] - A.j[1]) * t],
})

// ---------------------------------------------------------------------------
// Eigenvalues and eigenvectors
// ---------------------------------------------------------------------------

export interface EigenPair {
  value: number
  /** Unit vector along the eigen-line. */
  vector: Vec2
}

export type Eigen =
  /** Two different lines that stay on their own span. */
  | { kind: 'distinct'; pairs: [EigenPair, EigenPair] }
  /** Only one such line (e.g. a shear). */
  | { kind: 'repeated'; pair: EigenPair }
  /** A = λI: every vector stays on its span and scales by λ. */
  | { kind: 'every'; value: number }
  /** No real eigenvectors: every vector gets rotated off its span. */
  | { kind: 'complex'; re: number; im: number }

/**
 * Eigenvalues: the λ for which A·v = λ·v has a non-zero solution v.
 *
 * Rearranged: (A − λI)·v = 0. A non-zero v can only be squashed to 0 if
 * A − λI squashes space, meaning det(A − λI) = 0. For a 2×2 matrix that
 * expands to the quadratic
 *
 *   λ² − tr(A)·λ + det(A) = 0
 *
 * so the quadratic formula finds the eigenvalues.
 */
export function eigen(A: Mat2): Eigen {
  const tr = trace(A)
  const D = det(A)
  const disc = tr * tr - 4 * D

  if (disc < -TOL) {
    return { kind: 'complex', re: tr / 2, im: Math.sqrt(-disc) / 2 }
  }

  if (Math.abs(disc) <= TOL) {
    const value = tr / 2
    const lambdaI: Mat2 = { i: [value, 0], j: [0, value] }
    if (matApprox(A, lambdaI)) return { kind: 'every', value }
    return { kind: 'repeated', pair: { value, vector: eigenvectorFor(A, value) } }
  }

  const root = Math.sqrt(disc)
  const l1 = (tr + root) / 2
  const l2 = (tr - root) / 2
  return {
    kind: 'distinct',
    pairs: [
      { value: l1, vector: eigenvectorFor(A, l1) },
      { value: l2, vector: eigenvectorFor(A, l2) },
    ],
  }
}

/**
 * Solve (A − λI)·v = 0 for one known λ.
 *
 * Each row (p, q) of A − λI says p·x + q·y = 0, so v must be perpendicular
 * to that row: v = (−q, p). We use whichever row is longer, because a
 * near-zero row gives a numerically junk direction.
 */
function eigenvectorFor(A: Mat2, lambda: number): Vec2 {
  const { a, b, c, d } = entries(A)
  const row1: Vec2 = [a - lambda, b]
  const row2: Vec2 = [c, d - lambda]
  const row = length(row1) >= length(row2) ? row1 : row2
  const v = normalize([-row[1], row[0]])
  // Pick a consistent sign so the arrow doesn't flip around as values change.
  const flip = v[0] < -TOL || (Math.abs(v[0]) <= TOL && v[1] < 0)
  const [x, y] = flip ? scale(-1, v) : v
  return [x + 0, y + 0] // `+ 0` turns -0 into 0
}

// ---------------------------------------------------------------------------
// Naming the transformation
// ---------------------------------------------------------------------------

export interface Classification {
  name: string
  detail: string
}

const toDegrees = (rad: number) => (rad * 180) / Math.PI
const round = (x: number, digits = 2) => Number(x.toFixed(digits)) || 0

/** Put a name on a matrix. Checks run from most specific to most general. */
export function classify(A: Mat2): Classification {
  const { a, b, c, d } = entries(A)
  const D = det(A)

  if (matApprox(A, { i: [0, 0], j: [0, 0] })) {
    return { name: 'Zero map', detail: 'Every vector collapses to the origin.' }
  }

  if (Math.abs(D) < TOL) {
    if (matApprox(multiply(A, A), A)) {
      return {
        name: 'Projection',
        detail:
          'Squashes the plane onto a line. Applying it twice changes nothing more (A·A = A): once a vector is on the line, it stays put.',
      }
    }
    return {
      name: 'Singular (rank 1)',
      detail: 'î and ĵ land on the same line, so the whole plane collapses onto that line.',
    }
  }

  if (matApprox(A, IDENTITY)) {
    return { name: 'Identity', detail: 'Nothing moves. î and ĵ stay where they started.' }
  }

  // Columns perpendicular and equal length: the grid stays square.
  // That's a rotation or a reflection, possibly with a uniform scale.
  const k = length(A.i)
  if (approx(dot(A.i, A.j), 0) && approx(k, length(A.j))) {
    const scaleNote = approx(k, 1) ? '' : `, then scale everything by ${round(k)}×`
    if (D > 0) {
      const angle = round(toDegrees(Math.atan2(c, a)))
      if (approx(angle, 0)) {
        return { name: `Uniform scale ×${round(k)}`, detail: 'Every vector stretches by the same amount, keeping its direction.' }
      }
      return {
        name: `Rotation by ${angle}°${approx(k, 1) ? '' : ` + scale ×${round(k)}`}`,
        detail: `Rotate the whole plane ${angle > 0 ? 'counter-clockwise' : 'clockwise'} by ${Math.abs(angle)}°${scaleNote}. The grid stays square.`,
      }
    }
    // A reflection across the line at angle φ sends î to (cos 2φ, sin 2φ).
    let phi = toDegrees(Math.atan2(c, a)) / 2
    if (phi <= -90) phi += 180
    if (phi > 90) phi -= 180
    return {
      name: `Reflection${approx(k, 1) ? '' : ` + scale ×${round(k)}`}`,
      detail: `Mirror the plane across the line at ${round(phi)}° from the x-axis${scaleNote}. Orientation flips.`,
    }
  }

  if (approx(b, 0) && approx(c, 0)) {
    const flips = a < 0 || d < 0 ? ' A negative factor also flips that axis.' : ''
    return {
      name: 'Axis scale',
      detail: `Stretch x by ${round(a)} and y by ${round(d)}, independently.${flips}`,
    }
  }

  // det = 1 and trace = 2 means both eigenvalues are 1. If A isn't the
  // identity, that's a shear: one line stays fixed and everything else
  // slides parallel to it.
  if (approx(D, 1) && approx(trace(A), 2)) {
    return {
      name: 'Shear',
      detail: 'One line stays fixed and everything slides parallel to it. Area is preserved (det = 1).',
    }
  }

  return D > 0
    ? { name: 'General linear map', detail: 'A mix of stretching, rotating and shearing. Orientation is preserved.' }
    : { name: 'General linear map (flipped)', detail: 'A mix of stretching, rotating and shearing, and orientation flips (det < 0).' }
}

// ---------------------------------------------------------------------------
// Composition: apply A, then B, then C, ...
// ---------------------------------------------------------------------------

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)

/** Fraction of each stage spent moving; the rest is a short pause before the next matrix. */
const MOVE_FRACTION = 0.8

/** Multiply a chain applied in order: [A, B, C] → C·B·A. */
export const chainProduct = (mats: readonly Mat2[]): Mat2 => mats.reduce((acc, M) => multiply(M, acc), IDENTITY)

/** Which stage animation progress t ∈ [0, 1] is in, and how far through its motion (0..1). */
export function stageAt(stages: number, t: number): { index: number; s: number } {
  const u = clamp01(t)
  const index = Math.min(stages - 1, Math.floor(u * stages))
  const local = u * stages - index
  return { index, s: clamp01(local / MOVE_FRACTION) }
}

/**
 * The matrix drawn at animation progress t ∈ [0, 1].
 *
 * One matrix: a straight blend from I to A.
 * A chain [A, B, C, ...], one stage each. During a stage, everything before it
 * is already applied and the new matrix is blended in on top:
 *   M = lerp(I, C, s) · (B · A)
 * Blending I → C *after* the earlier ones (instead of blending entries of
 * the final product) is what makes each stage look like C acting on space
 * that's already transformed.
 */
export function sceneMatrixAt(mats: readonly Mat2[], t: number): Mat2 {
  if (mats.length === 1) return lerpMatrix(IDENTITY, mats[0], t)
  const { index, s } = stageAt(mats.length, t)
  const before = chainProduct(mats.slice(0, index))
  return multiply(lerpMatrix(IDENTITY, mats[index], easeInOut(s)), before)
}
