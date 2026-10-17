/**
 * Live math, derived from the store. Read-only: you edit the math through the
 * inputs, the canvas or the code.
 *
 * Every block reads the same way: a numbered label (what this is), a headline
 * (the answer in words), the math (how), then a note (why it matters).
 */
import type { ReactNode } from 'react'
import { fmt } from '../lib/format'
import { apply, approx, classify, det, eigen, entries, inverse, TOL, trace, type Mat2, type Vec2 } from '../lib/linalg'
import { col, color, ihat, jhat, matrix, n, p, vecName } from '../lib/tex'
import { useScene, type VectorItem } from '../state/store'
import { toHex, usePalette } from '../state/theme'
import { VecName } from './inputs'
import { Tex } from './Tex'

const num = (x: number) => fmt(x).replace('-', '−')

export function MathPanel() {
  const A = useScene((s) => s.A)
  const vectors = useScene((s) => s.vectors)
  const toggles = useScene((s) => s.toggles)
  const tc = useTexColors()

  const blocks: { key: string; render: (step: number) => ReactNode }[] = [
    { key: 'matrix', render: (step) => <MatrixBlock step={step} A={A} tc={tc} /> },
    ...(toggles.type ? [{ key: 'type', render: (step: number) => <TypeBlock step={step} A={A} /> }] : []),
    ...vectors.map((v) => ({ key: v.id, render: (step: number) => <VectorBlock step={step} A={A} v={v} tc={tc} /> })),
    { key: 'det', render: (step) => <DetBlock step={step} A={A} tc={tc} /> },
    ...(toggles.eigen ? [{ key: 'eigen', render: (step: number) => <EigenBlock step={step} A={A} tc={tc} /> }] : []),
    ...(toggles.inverse ? [{ key: 'inverse', render: (step: number) => <InverseBlock step={step} A={A} /> }] : []),
  ]

  return (
    <div className="flex flex-col divide-y divide-rule text-sm leading-relaxed">
      {blocks.map((b, k) => (
        <div key={b.key}>{b.render(k + 1)}</div>
      ))}
    </div>
  )
}

type TexColors = ReturnType<typeof useTexColors>

function useTexColors() {
  const pal = usePalette()
  return {
    i: toHex(pal.ihat),
    j: toHex(pal.jhat),
    eigen: toHex(pal.eigen),
    detPos: toHex(pal.detPos),
    detNeg: toHex(pal.detNeg),
    vectors: pal.vectors.map(toHex),
  }
}

function MatrixBlock({ step, A, tc }: { step: number; A: Mat2; tc: TexColors }) {
  return (
    <Block step={step} label="The matrix" title="Its columns are where î and ĵ land">
      <Tex block tex={`A = \\begin{bmatrix} ${ihat(tc.i)} & ${jhat(tc.j)} \\end{bmatrix} = ${matrix(A, tc)}`} />
      <Note>
        <I /> = [1, 0] lands on [{num(A.i[0])}, {num(A.i[1])}], and <J /> = [0, 1] lands on [{num(A.j[0])},{' '}
        {num(A.j[1])}]. That's all a matrix is.
      </Note>
    </Block>
  )
}

function TypeBlock({ step, A }: { step: number; A: Mat2 }) {
  const { name, detail } = classify(A)
  return (
    <Block step={step} label="Kind of transformation" title={name}>
      <Note>{detail}</Note>
    </Block>
  )
}

/**
 * The key derivation:
 *   A·v = x·î + y·ĵ   (with î, ĵ = the NEW basis vectors, i.e. A's columns)
 */
function VectorBlock({ step, A, v, tc }: { step: number; A: Mat2; v: VectorItem; tc: TexColors }) {
  const vc = tc.vectors[v.colorIndex]
  const [x, y] = v.coords
  const { a, b, c, d } = entries(A)
  const result = apply(A, v.coords)
  const name = vecName(v.name)

  const tex = String.raw`\begin{aligned}
A${name} &= ${matrix(A, tc)} ${col(v.coords, vc)} \\
&= ${n(x)}\,${ihat(tc.i)} + ${p(y)}\,${jhat(tc.j)} \\
&= ${n(x)} ${col(A.i, tc.i)} + ${p(y)} ${col(A.j, tc.j)} \\
&= \begin{bmatrix} ${p(x)}\cdot${p(a)} + ${p(y)}\cdot${p(b)} \\ ${p(x)}\cdot${p(c)} + ${p(y)}\cdot${p(d)} \end{bmatrix}
 = ${col(result, vc)}
\end{aligned}`

  return (
    <Block
      step={step}
      label="Applying A"
      title={
        <span className="text-[19px] tracking-normal" style={{ color: vc }}>
          <VecName name={v.name} /> <span className="font-mathrm font-normal">=</span> <Pair v={v.coords} />{' '}
          <span className="font-mathrm font-normal text-ink-3">↦</span> <Pair v={result} />
        </span>
      }
    >
      <Note>
        The coordinates are a recipe: {num(x)} of <I /> plus {num(y)} of <J />. A keeps the recipe and swaps in the{' '}
        <em>new</em> <I /> and <J />.
      </Note>
      <Tex block tex={tex} />
    </Block>
  )
}

function DetBlock({ step, A, tc }: { step: number; A: Mat2; tc: TexColors }) {
  const { a, b, c, d } = entries(A)
  const D = det(A)
  const flat = Math.abs(D) < TOL
  const scaleWords = approx(Math.abs(D), 1) ? 'Areas are preserved' : `Areas scale by ${num(Math.abs(D))}×`
  const title = flat ? 'Space collapses onto a line' : D < 0 ? `Space flips, and ${scaleWords.toLowerCase()}` : scaleWords
  const note = flat
    ? 'det = 0: every area becomes 0. Information is lost, so A has no inverse.'
    : D < 0
      ? 'det < 0 means orientation flipped: ĵ is now clockwise from î, like a mirror image.'
      : `The unit square (area 1) becomes the hatched parallelogram (area ${num(D)}).`

  return (
    <Block step={step} label="Determinant" title={title}>
      <Tex
        block
        tex={`\\det(A) = ad - bc = ${p(a)}\\cdot${p(d)} - ${p(b)}\\cdot${p(c)} = ${color(D < 0 ? tc.detNeg : tc.detPos, n(D))}`}
      />
      <Note>{note}</Note>
    </Block>
  )
}

function EigenBlock({ step, A, tc }: { step: number; A: Mat2; tc: TexColors }) {
  const tr = trace(A)
  const D = det(A)
  const e = eigen(A)
  const poly = `\\det(A - \\lambda I) = ${characteristic(tr, D)} = 0`

  let title: string
  let result: ReactNode
  let note: ReactNode
  if (e.kind === 'complex') {
    title = 'No real eigenvectors'
    result = <Tex block tex={`\\lambda = ${complexPair(e.re, e.im)}`} />
    note = 'No real solutions: every vector gets rotated off its own line. Rotations look like this.'
  } else if (e.kind === 'every') {
    title = 'Every vector is an eigenvector'
    result = <Tex block tex={`\\lambda = ${color(tc.eigen, n(e.value))}`} />
    note = `A only scales: everything stretches by ${num(e.value)} and keeps its direction.`
  } else {
    const pairs = e.kind === 'distinct' ? e.pairs : [e.pair]
    title = pairs.length === 1 ? 'One line stays on its span' : 'Two lines stay on their span'
    result = pairs.map(({ value, vector }, k) => (
      <Tex key={k} block tex={`\\lambda_${k + 1} = ${color(tc.eigen, n(value))}, \\quad \\mathbf{u}_${k + 1} = ${col(vector)}`} />
    ))
    note = (
      <>
        Vectors on the dashed {pairs.length === 1 ? 'line' : 'lines'} only get scaled by λ
        {pairs.some((pr) => pr.value < 0) ? ' (negative λ flips them to the other side)' : ''}.
        {e.kind === 'repeated' ? ' Only one such line exists, typical of a shear.' : ''}
      </>
    )
  }

  return (
    <Block step={step} label="Eigenvectors" title={title}>
      <Note>
        Directions where <Tex tex="A\mathbf{u} = \lambda\mathbf{u}" />. They exist when:
      </Note>
      <Tex block tex={poly} />
      {result}
      <Note>{note}</Note>
    </Block>
  )
}

function InverseBlock({ step, A }: { step: number; A: Mat2 }) {
  const inv = inverse(A)
  const { a, b, c, d } = entries(A)
  if (!inv) {
    return (
      <Block step={step} label="Inverse" title="No inverse">
        <Note>
          det = 0 means many inputs land on the same output, so there's no way to undo A and know where you started.
        </Note>
      </Block>
    )
  }
  const D = det(A)
  const adjugate = `\\begin{bmatrix} ${n(d)} & ${n(-b)} \\\\ ${n(-c)} & ${n(a)} \\end{bmatrix}`
  return (
    <Block step={step} label="Inverse" title="A can be undone">
      <Tex
        block
        tex={`A^{-1} = \\frac{1}{\\det A} ${approx(D, 1) ? adjugate : `\\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix} = \\frac{1}{${n(D)}} ${adjugate}`} = ${matrix(inv)}`}
      />
      <Note>
        <Tex tex="A^{-1}(A\mathbf{v}) = \mathbf{v}" />. Its columns are where <I /> and <J /> must start so that A sends
        them back to [1, 0] and [0, 1].
      </Note>
    </Block>
  )
}

function Block({ step, label, title, children }: { step: number; label: string; title?: ReactNode; children: ReactNode }) {
  return (
    <section className="px-5 pt-5 pb-6">
      <p className="flex items-baseline gap-2.5 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
        <span className="tabular-nums">{String(step).padStart(2, '0')}</span>
        <span>{label}</span>
      </p>
      {title && <h3 className="mt-1.5 font-display text-[17px] leading-snug font-semibold tracking-tight text-ink">{title}</h3>}
      <div className="mt-2.5 flex flex-col gap-1">{children}</div>
    </section>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-2">{children}</p>
}


function Pair({ v }: { v: Vec2 }) {
  return (
    <span className="font-mathrm font-normal">
      [{num(v[0])}, {num(v[1])}]
    </span>
  )
}

/** λ² − (tr A)λ + det A, dropping zero terms and unit coefficients. */
function characteristic(tr: number, D: number) {
  let s = '\\lambda^2'
  if (!approx(tr, 0)) s += ` ${tr > 0 ? '-' : '+'} ${approx(Math.abs(tr), 1) ? '' : n(Math.abs(tr))}\\lambda`
  if (!approx(D, 0)) s += ` ${D > 0 ? '+' : '-'} ${n(Math.abs(D))}`
  return s
}

function complexPair(re: number, im: number) {
  const imag = approx(im, 1) ? 'i' : `${n(im)}i`
  return approx(re, 0) ? `\\pm ${imag}` : `${n(re)} \\pm ${imag}`
}

const I = () => <span className="font-math text-ihat italic">î</span>
const J = () => <span className="font-math text-jhat italic">ĵ</span>
