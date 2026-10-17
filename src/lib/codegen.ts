import { fmt } from './format'
import { AFTER_NAMES, chainLetters } from './chain'
import type { Mat2, Vec2 } from './linalg'

export interface CodegenInput {
  A: Mat2
  /** Matrices applied after A, in order (B, C, ...). */
  after: readonly Mat2[]
  vectors: readonly { name: string; coords: Vec2 }[]
  showEigen: boolean
  showInverse: boolean
}

const num = (n: number) => fmt(n, 4)
const arr = (v: Vec2) => `np.array([${num(v[0])}, ${num(v[1])}])`
const rows = (M: Mat2) => `np.array([[${num(M.i[0])}, ${num(M.j[0])}], [${num(M.i[1])}, ${num(M.j[1])}]])`

/**
 * State → NumPy source. The output must stay parseable by `parseCode`
 * (round-trip tested in parser.test.ts), so the code panel can feed edits back.
 */
export function generateCode({ A, after, vectors, showEigen, showInverse }: CodegenInput): string {
  const compose = after.length > 0
  const M = compose ? 'M' : 'A'
  const letters = chainLetters(after.length)
  const lines: string[] = [
    'import numpy as np',
    'np.set_printoptions(suppress=True, precision=4)',
    '',
    '# Where the basis vectors land after the transformation',
    `i_hat = ${arr(A.i)}`,
    `j_hat = ${arr(A.j)}`,
    '',
    '# A matrix IS its columns: [where î lands, where ĵ lands]',
    'A = np.column_stack([i_hat, j_hat])',
    'print("A =")',
    'print(A)',
  ]

  if (compose) {
    const product = [...letters].reverse().join(' @ ')
    const reversed = letters.join(' @ ')
    lines.push('', '# Then apply these, in order. NumPy rows: [[row 1], [row 2]]')
    after.forEach((X, k) => lines.push(`${AFTER_NAMES[k]} = ${rows(X)}`))
    lines.push(
      '',
      '# The whole chain is ONE matrix. Read right to left: A acts first',
      `M = ${product}`,
      `print("M = ${product} =")`,
      'print(M)',
      `print("order matters, ${reversed} =")`,
      `print(${reversed})`,
    )
  }

  if (vectors.length > 0) {
    lines.push('', '# Input vectors: coordinates = "how much î, how much ĵ"')
    for (const v of vectors) lines.push(`${v.name} = ${arr(v.coords)}`)

    if (compose) {
      const nested = (v: string) => letters.reduce((inner, L) => `${L} @ ${inner === v ? v : `(${inner})`}`, v)
      lines.push('', `# Applying M is the same as applying ${letters.join(', then ')}`)
      for (const v of vectors) lines.push(`print("M @ ${v.name} =", M @ ${v.name}, "=", ${nested(v.name)})`)
    } else {
      lines.push('', '# A @ v is the same recipe applied to the NEW basis vectors')
      for (const v of vectors) {
        lines.push(`print("A @ ${v.name} =", A @ ${v.name}, "=", ${v.name}[0] * i_hat + ${v.name}[1] * j_hat)`)
      }
    }
  }

  lines.push(
    '',
    '# Determinant: how much areas scale (float math, hence the rounding)',
    `print("det(${M}) =", round(float(np.linalg.det(${M})), 6))`,
  )

  if (showEigen) {
    lines.push(
      '',
      '# Eigenvectors: directions that stay on their own line; each column is one',
      `eigenvalues, eigenvectors = np.linalg.eig(${M})`,
      'print("eigenvalues:", eigenvalues)',
      'print("eigenvectors (columns):")',
      'print(eigenvectors)',
    )
  }

  if (showInverse) {
    lines.push(
      '',
      '# The inverse undoes A, but only exists when det != 0',
      `if abs(np.linalg.det(${M})) > 1e-9:`,
      '    print("inverse:")',
      `    print(np.linalg.inv(${M}))`,
      'else:',
      `    print("${M} is singular: no inverse")`,
    )
  }

  return lines.join('\n') + '\n'
}
