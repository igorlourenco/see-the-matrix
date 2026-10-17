import { describe, expect, it } from 'vitest'
import { generateCode } from './codegen'
import { parseCode } from './parser'

const scene = (src: string) => {
  const r = parseCode(src)
  if (!r.ok) throw new Error(`line ${r.line}: ${r.error}`)
  return r.scene
}

describe('parseCode', () => {
  it('round-trips generated code', () => {
    const src = generateCode({
      A: { i: [2, 1], j: [-1, 1.5] },
      vectors: [
        { name: 'v1', coords: [2, 3] },
        { name: 'v2', coords: [-0.25, 7] },
      ],
      showEigen: true,
      showInverse: true,
    })
    expect(scene(src)).toEqual({
      basis: { i: [2, 1], j: [-1, 1.5] },
      vectors: [
        { name: 'v1', coords: [2, 3] },
        { name: 'v2', coords: [-0.25, 7] },
      ],
    })
  })

  it('reads A = np.array as ROWS', () => {
    expect(scene('A = np.array([[2, -1], [1, 1]])').basis).toEqual({ i: [2, 1], j: [-1, 1] })
  })

  it('evaluates scalar math and variables', () => {
    const s = scene(`
theta = np.pi / 2
i_hat = np.array([np.cos(theta), np.sin(theta)])
j_hat = np.array([-2 ** 2, 1 / 2])
`)
    expect(s.basis.i![0]).toBeCloseTo(0)
    expect(s.basis.i![1]).toBeCloseTo(1)
    expect(s.basis.j).toEqual([-4, 0.5])
  })

  it('joins multi-line brackets and ignores comments', () => {
    const s = scene(`v = np.array([  # a comment
      3,
      4,   # another
    ])`)
    expect(s.vectors).toEqual([{ name: 'v', coords: [3, 4] }])
  })

  it('A wins over later i_hat edits, like Python', () => {
    const s = scene(`
i_hat = np.array([1, 0])
j_hat = np.array([0, 1])
A = np.column_stack([i_hat, j_hat])
i_hat = np.array([5, 5])
`)
    expect(s.basis).toEqual({ i: [1, 0], j: [0, 1] })
  })

  it('skips Python it does not understand', () => {
    const s = scene(`
v1 = np.array([1, 2])
w = A @ v1
eigenvalues, eigenvectors = np.linalg.eig(A)
print("hi # not a comment")
`)
    expect(s.vectors).toEqual([{ name: 'v1', coords: [1, 2] }])
  })

  it('reports errors with line numbers', () => {
    expect(parseCode('\n\nv1 = np.array([1, 2')).toMatchObject({ ok: false, line: 3 })
    expect(parseCode('i_hat = np.array([1, 2, 3])')).toMatchObject({ ok: false, line: 1 })
    expect(parseCode('v = np.array([1, foo])')).toMatchObject({ ok: false, error: "unknown name 'foo'" })
  })
})
