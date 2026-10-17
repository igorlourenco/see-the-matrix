/**
 * Live math, derived from the store. Read-only: you edit the math through the
 * inputs, the canvas or the code.
 *
 * Every block reads the same way: a numbered label (what this is), a headline
 * (the answer in words), the math (how), then a note (why it matters).
 */
import type { ReactNode } from 'react'
import { fmt } from '../lib/format'
import { AFTER_NAMES, chainLetters, productName } from '../lib/chain'
import { apply, approx, chainProduct, classify, det, eigen, entries, inverse, matApprox, TOL, trace, type Mat2, type Vec2 } from '../lib/linalg'
import { col, color, ihat, jhat, matrix, n, p, vecName } from '../lib/tex'
import { chainOf, useScene, type VectorItem } from '../state/store'
import { toHex, usePalette } from '../state/theme'
import { VecName } from './inputs'
import { Tex } from './Tex'

const num = (x: number) => fmt(x).replace('-', '−')

/** How the transformation on screen is written: A alone, or BA when composing. */
interface Sym {
  tex: string
  /** For powers like the inverse: (BA)⁻¹, not BA⁻¹. */
  texGroup: string
  words: string
}
const symFor = (afterCount: number): Sym => {
  const name = productName(afterCount)
  return { tex: name, texGroup: afterCount ? `(${name})` : name, words: name }
}

export function MathPanel() {
  const A = useScene((s) => s.A)
  const after = useScene((s) => s.after)
  const compose = after.length > 0
  const vectors = useScene((s) => s.vectors)
  const toggles = useScene((s) => s.toggles)
  const tc = useTexColors()
  const T = chainProduct(chainOf(A, after))
  const sym = symFor(after.length)

  const blocks: { key: string; render: (step: number) => ReactNode }[] = [
    { key: 'matrix', render: (step) => <MatrixBlock step={step} A={A} tc={tc} first={compose} /> },
    ...(compose ? [{ key: 'compose', render: (step: number) => <CompositionBlock step={step} A={A} after={after} tc={tc} /> }] : []),
    ...(toggles.type ? [{ key: 'type', render: (step: number) => <TypeBlock step={step} A={T} sym={sym} composed={compose} /> }] : []),
    ...vectors.map((v) => ({ key: v.id, render: (step: number) => <VectorBlock step={step} A={T} v={v} tc={tc} sym={sym} /> })),
    { key: 'det', render: (step) => <DetBlock step={step} A={T} tc={tc} sym={sym} /> },
    ...(toggles.eigen ? [{ key: 'eigen', render: (step: number) => <EigenBlock step={step} A={T} tc={tc} sym={sym} /> }] : []),
    ...(toggles.inverse ? [{ key: 'inverse', render: (step: number) => <InverseBlock step={step} A={T} sym={sym} /> }] : []),
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

function MatrixBlock({ step, A, tc, first }: { step: number; A: Mat2; tc: TexColors; first: boolean }) {
  return (
    <Block step={step} label={first ? 'First: the matrix A' : 'The matrix'} title="Its columns are where î and ĵ land">
      <Tex block tex={`A = \\begin{bmatrix} ${ihat(tc.i)} & ${jhat(tc.j)} \\end{bmatrix} = ${matrix(A, tc)}`} />
      <Note>
        <I /> = [1, 0] lands on [{num(A.i[0])}, {num(A.i[1])}], and <J /> = [0, 1] lands on [{num(A.j[0])},{' '}
        {num(A.j[1])}]. That's all a matrix is.
      </Note>
    </Block>
  )
}

/**
 * Composition: "apply A, then B, then C" is the single matrix CBA.
 * Each column of the product follows î (or ĵ) through the chain:
 *   (CBA)·î = C(B(A·î)): see where A sends î, then where B sends that, then C.
 */
function CompositionBlock({ step, A, after, tc }: { step: number; A: Mat2; after: readonly Mat2[]; tc: TexColors }) {
  const count = after.length
  const mats = [A, ...after]
  const letters = chainLetters(count)
  const name = productName(count)
  const total = chainProduct(mats)
  const reversedName = letters.join('')
  const reversed = chainProduct([...mats].reverse())
  const commute = matApprox(reversed, total)
  const prefix = (m: number) => AFTER_NAMES.slice(0, m).reverse().join('')

  // î through the chain: (CBA)î = CB(Aî) = CB[..] = C[..] = [..]
  const follow = (start: Vec2, hat: string, colorHex: string) => {
    let v = start
    const steps = [`${prefix(count)}\\,(A${hat})`, `${prefix(count)}${col(v, colorHex)}`]
    for (let k = 0; k < count; k++) {
      v = apply(after[k], v)
      steps.push(k === count - 1 ? col(v, colorHex) : `${prefix(count).slice(0, count - k - 1)}${col(v, colorHex)}`)
    }
    return `(${name})${hat} &= ${steps.join(' = ')}`
  }
  const columns = String.raw`\begin{aligned}
${follow(A.i, ihat(tc.i), tc.i)} \\
${follow(A.j, jhat(tc.j), tc.j)}
\end{aligned}`
  const dets = mats.map(det)

  return (
    <Block step={step} label={`Then: ${AFTER_NAMES.slice(0, count).join(', ')}`} title={`${letters.join(', then ')} is one matrix: ${name}`}>
      <Tex block tex={`${name} = ${[...mats].reverse().map((M, k) => (k === count ? matrix(M, tc) : matrix(M))).join(' ')} = ${matrix(total, tc)}`} />
      <Note>Read right to left: A acts first. Follow î and ĵ through each matrix to get the columns of {name}.</Note>
      <Tex block tex={columns} />
      {commute ? (
        <Note>
          Here {reversedName} = {name}: this order happens not to matter. Most of the time it does.
        </Note>
      ) : (
        <>
          <Tex block tex={`${reversedName} = ${matrix(reversed)} \\neq ${name}`} />
          <Note>Order matters: the same matrices applied in the opposite order give a different transformation. Try “Reverse order”.</Note>
        </>
      )}
      <Tex
        block
        tex={`\\det(${name}) = ${[...letters].reverse().map((L) => `\\det(${L})`).join('\\,')} = ${[...dets].reverse().map(p).join(' \\cdot ')} = ${n(dets.reduce((a, b) => a * b, 1))}`}
      />
      <Note>Each matrix scales areas by its own factor, so the factors multiply.</Note>
    </Block>
  )
}

function TypeBlock({ step, A, sym, composed }: { step: number; A: Mat2; sym: Sym; composed: boolean }) {
  const { name, detail } = classify(A)
  return (
    <Block step={step} label={composed ? `Kind of transformation (${sym.words})` : 'Kind of transformation'} title={name}>
      <Note>{detail}</Note>
    </Block>
  )
}

/**
 * The key derivation:
 *   A·v = x·î + y·ĵ   (with î, ĵ = the NEW basis vectors, i.e. A's columns)
 */
function VectorBlock({ step, A, v, tc, sym }: { step: number; A: Mat2; v: VectorItem; tc: TexColors; sym: Sym }) {
  const vc = tc.vectors[v.colorIndex]
  const [x, y] = v.coords
  const { a, b, c, d } = entries(A)
  const result = apply(A, v.coords)
  const name = vecName(v.name)

  const tex = String.raw`\begin{aligned}
${sym.tex}${name} &= ${matrix(A, tc)} ${col(v.coords, vc)} \\
&= ${n(x)}\,${ihat(tc.i)} + ${p(y)}\,${jhat(tc.j)} \\
&= ${n(x)} ${col(A.i, tc.i)} + ${p(y)} ${col(A.j, tc.j)} \\
&= \begin{bmatrix} ${p(x)}\cdot${p(a)} + ${p(y)}\cdot${p(b)} \\ ${p(x)}\cdot${p(c)} + ${p(y)}\cdot${p(d)} \end{bmatrix}
 = ${col(result, vc)}
\end{aligned}`

  return (
    <Block
      step={step}
      label={`Applying ${sym.words}`}
      title={
        <span className="text-[19px] tracking-normal" style={{ color: vc }}>
          <VecName name={v.name} /> <span className="font-mathrm font-normal">=</span> <Pair v={v.coords} />{' '}
          <span className="font-mathrm font-normal text-ink-3">↦</span> <Pair v={result} />
        </span>
      }
    >
      <Note>
        The coordinates are a recipe: {num(x)} of <I /> plus {num(y)} of <J />. {sym.words} keeps the recipe and swaps in the{' '}
        <em>new</em> <I /> and <J />.
      </Note>
      <Tex block tex={tex} />
    </Block>
  )
}

function DetBlock({ step, A, tc, sym }: { step: number; A: Mat2; tc: TexColors; sym: Sym }) {
  const { a, b, c, d } = entries(A)
  const D = det(A)
  const flat = Math.abs(D) < TOL
  const scaleWords = approx(Math.abs(D), 1) ? 'Areas are preserved' : `Areas scale by ${num(Math.abs(D))}×`
  const title = flat ? 'Space collapses onto a line' : D < 0 ? `Space flips, and ${scaleWords.toLowerCase()}` : scaleWords
  const note = flat
    ? `det = 0: every area becomes 0. Information is lost, so ${sym.words} has no inverse.`
    : D < 0
      ? 'det < 0 means orientation flipped: ĵ is now clockwise from î, like a mirror image.'
      : `The unit square (area 1) becomes the hatched parallelogram (area ${num(D)}).`

  return (
    <Block step={step} label="Determinant" title={title}>
      <Tex
        block
        tex={`\\det(${sym.tex}) = ad - bc = ${p(a)}\\cdot${p(d)} - ${p(b)}\\cdot${p(c)} = ${color(D < 0 ? tc.detNeg : tc.detPos, n(D))}`}
      />
      <Note>{note}</Note>
    </Block>
  )
}

function EigenBlock({ step, A, tc, sym }: { step: number; A: Mat2; tc: TexColors; sym: Sym }) {
  const tr = trace(A)
  const D = det(A)
  const e = eigen(A)
  const poly = `\\det(${sym.tex} - \\lambda I) = ${characteristic(tr, D)} = 0`

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
    note = `${sym.words} only scales: everything stretches by ${num(e.value)} and keeps its direction.`
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
        Directions where <Tex tex={`${sym.tex}\\mathbf{u} = \\lambda\\mathbf{u}`} />. They exist when:
      </Note>
      <Tex block tex={poly} />
      {result}
      <Note>{note}</Note>
    </Block>
  )
}

function InverseBlock({ step, A, sym }: { step: number; A: Mat2; sym: Sym }) {
  const inv = inverse(A)
  const { a, b, c, d } = entries(A)
  if (!inv) {
    return (
      <Block step={step} label="Inverse" title="No inverse">
        <Note>
          det = 0 means many inputs land on the same output, so there's no way to undo {sym.words} and know where you started.
        </Note>
      </Block>
    )
  }
  const D = det(A)
  const adjugate = `\\begin{bmatrix} ${n(d)} & ${n(-b)} \\\\ ${n(-c)} & ${n(a)} \\end{bmatrix}`
  return (
    <Block step={step} label="Inverse" title={`${sym.words} can be undone`}>
      <Tex
        block
        tex={`${sym.texGroup}^{-1} = \\frac{1}{\\det ${sym.texGroup}} ${approx(D, 1) ? adjugate : `\\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix} = \\frac{1}{${n(D)}} ${adjugate}`} = ${matrix(inv)}`}
      />
      <Note>
        <Tex tex={`${sym.texGroup}^{-1}(${sym.tex}\\mathbf{v}) = \\mathbf{v}`} />. Its columns are where <I /> and <J /> must start so that {sym.words} sends
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
