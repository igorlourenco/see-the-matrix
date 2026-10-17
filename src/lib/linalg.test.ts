import { describe, expect, it } from 'vitest'
import { apply, classify, det, eigen, fromRows, IDENTITY, inverse, multiply, type Mat2 } from './linalg'

const A: Mat2 = { i: [2, 1], j: [-1, 1] } // [[2, -1], [1, 1]]

describe('apply', () => {
  it('is x·(new î) + y·(new ĵ)', () => {
    // 2·[2, 1] + 3·[-1, 1] = [1, 5]
    expect(apply(A, [2, 3])).toEqual([1, 5])
  })
  it('sends î and ĵ to the columns', () => {
    expect(apply(A, [1, 0])).toEqual(A.i)
    expect(apply(A, [0, 1])).toEqual(A.j)
  })
})

describe('det / inverse', () => {
  it('computes ad − bc', () => expect(det(A)).toBe(3))
  it('inverse undoes A', () => {
    const inv = inverse(A)!
    const [x, y] = apply(inv, apply(A, [2, 3]))
    expect(x).toBeCloseTo(2)
    expect(y).toBeCloseTo(3)
  })
  it('has no inverse when singular', () => expect(inverse({ i: [1, 0.5], j: [2, 1] })).toBeNull())
  it('fromRows reads rows like NumPy', () => expect(fromRows([[2, -1], [1, 1]])).toEqual(A))
  it('multiply composes (B after A)', () => {
    const rot: Mat2 = { i: [0, 1], j: [-1, 0] }
    expect(multiply(rot, rot)).toEqual({ i: [-1, 0], j: [-0, -1] })
  })
})

describe('eigen', () => {
  it('diagonal: the axes, with the diagonal entries', () => {
    const e = eigen({ i: [3, 0], j: [0, 0.5] })
    expect(e.kind).toBe('distinct')
    if (e.kind !== 'distinct') return
    expect(e.pairs[0].value).toBe(3)
    expect(e.pairs[0].vector).toEqual([1, 0])
    expect(e.pairs[1].value).toBe(0.5)
    expect(e.pairs[1].vector).toEqual([0, 1])
  })
  it('eigenvectors satisfy A·v = λ·v', () => {
    const M: Mat2 = { i: [3, 1], j: [1, 2] }
    const e = eigen(M)
    if (e.kind !== 'distinct') throw new Error('expected distinct')
    for (const { value, vector } of e.pairs) {
      const Av = apply(M, vector)
      expect(Av[0]).toBeCloseTo(value * vector[0])
      expect(Av[1]).toBeCloseTo(value * vector[1])
    }
  })
  it('shear: one repeated eigenvalue, one line', () => {
    const e = eigen({ i: [1, 0], j: [1, 1] })
    expect(e).toEqual({ kind: 'repeated', pair: { value: 1, vector: [1, 0] } })
  })
  it('rotation: complex', () => expect(eigen({ i: [0, 1], j: [-1, 0] }).kind).toBe('complex'))
  it('uniform scale: every vector', () => expect(eigen({ i: [2, 0], j: [0, 2] })).toEqual({ kind: 'every', value: 2 }))
})

describe('classify', () => {
  const name = (M: Mat2) => classify(M).name
  it('names the presets', () => {
    expect(name(IDENTITY)).toBe('Identity')
    expect(name({ i: [0, 1], j: [-1, 0] })).toBe('Rotation by 90°')
    expect(name({ i: [1, 0], j: [1, 1] })).toBe('Shear')
    expect(name({ i: [2, 0], j: [0, 2] })).toBe('Uniform scale ×2')
    expect(name({ i: [3, 0], j: [0, 0.5] })).toBe('Axis scale')
    expect(name({ i: [-1, 0], j: [0, 1] })).toBe('Reflection')
    expect(name({ i: [0.5, 0.5], j: [0.5, 0.5] })).toBe('Projection')
    expect(name({ i: [1, 0.5], j: [2, 1] })).toBe('Singular (rank 1)')
    expect(name(A)).toBe('General linear map')
  })
  it('finds the reflection line', () => {
    expect(classify({ i: [-1, 0], j: [0, 1] }).detail).toContain('90°')
    expect(classify({ i: [0, 1], j: [1, 0] }).detail).toContain('45°')
  })
})
