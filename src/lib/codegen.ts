import { fmt } from './format'
import type { Mat2, Vec2 } from './linalg'

export interface CodegenInput {
  A: Mat2
  vectors: readonly { name: string; coords: Vec2 }[]
  showEigen: boolean
  showInverse: boolean
}

const num = (n: number) => fmt(n, 4)
const arr = (v: Vec2) => `np.array([${num(v[0])}, ${num(v[1])}])`

/**
 * State → NumPy source. The output must stay parseable by `parseCode`
 * (round-trip tested in parser.test.ts), so the code panel can feed edits back.
 */
export function generateCode({ A, vectors, showEigen, showInverse }: CodegenInput): string {
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

  if (vectors.length > 0) {
    lines.push('', '# Input vectors: coordinates = "how much î, how much ĵ"')
    for (const v of vectors) lines.push(`${v.name} = ${arr(v.coords)}`)

    lines.push('', '# A @ v is the same recipe applied to the NEW basis vectors')
    for (const v of vectors) {
      lines.push(`print("A @ ${v.name} =", A @ ${v.name}, "=", ${v.name}[0] * i_hat + ${v.name}[1] * j_hat)`)
    }
  }

  lines.push(
    '',
    '# Determinant: how much areas scale (float math, hence the rounding)',
    'print("det(A) =", round(float(np.linalg.det(A)), 6))',
  )

  if (showEigen) {
    lines.push(
      '',
      '# Eigenvectors: directions that stay on their own line; each column is one',
      'eigenvalues, eigenvectors = np.linalg.eig(A)',
      'print("eigenvalues:", eigenvalues)',
      'print("eigenvectors (columns):")',
      'print(eigenvectors)',
    )
  }

  if (showInverse) {
    lines.push(
      '',
      '# The inverse undoes A, but only exists when det != 0',
      'if abs(np.linalg.det(A)) > 1e-9:',
      '    print("inverse:")',
      '    print(np.linalg.inv(A))',
      'else:',
      '    print("A is singular: no inverse")',
    )
  }

  return lines.join('\n') + '\n'
}
