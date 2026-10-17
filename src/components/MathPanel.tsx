/**
 * Live math, derived from the store. Read-only: you edit the math through the
 * inputs, the canvas or the code.
 */
import type { ReactNode } from 'react'
import { fmt } from '../lib/format'
import { apply, approx, classify, det, eigen, entries, inverse, TOL, trace, type Mat2 } from '../lib/linalg'
import { col, color, I_COLOR, IHAT, J_COLOR, JHAT, matrix, n, p, vecName } from '../lib/tex'
import { useScene, type VectorItem } from '../state/store'
import { Tex } from './Tex'

export function MathPanel() {
  const A = useScene((s) => s.A)
  const vectors = useScene((s) => s.vectors)
  const toggles = useScene((s) => s.toggles)

  return (
    <div className="flex flex-col gap-5 px-4 py-4 text-sm leading-relaxed">
      <Block title="The matrix">
        <Tex block tex={`A = \\begin{bmatrix} ${IHAT} & ${JHAT} \\end{bmatrix} = ${matrix(A)}`} />
        <Note>
          Column 1 is where {colorWord('î', I_COLOR)} = [1, 0] lands. Column 2 is where {colorWord('ĵ', J_COLOR)} = [0, 1]
          lands. That's all a matrix is.
        </Note>
      </Block>

      {toggles.type && <TypeBlock A={A} />}

      {vectors.map((v) => (
        <VectorBlock key={v.id} A={A} v={v} />
      ))}

      <DetBlock A={A} />
      {toggles.eigen && <EigenBlock A={A} />}
      {toggles.inverse && <InverseBlock A={A} />}
    </div>
  )
}

function TypeBlock({ A }: { A: Mat2 }) {
  const { name, detail } = classify(A)
  return (
    <Block title="What kind of transformation?">
      <p className="font-semibold text-slate-100">{name}</p>
      <Note>{detail}</Note>
    </Block>
  )
}

/**
 * The key derivation:
 *   A·v = x·î + y·ĵ   (with î, ĵ = the NEW basis vectors, i.e. A's columns)
 */
function VectorBlock({ A, v }: { A: Mat2; v: VectorItem }) {
  const [x, y] = v.coords
  const { a, b, c, d } = entries(A)
  const result = apply(A, v.coords)
  const name = vecName(v.name)

  const tex = String.raw`\begin{aligned}
A${name} &= ${matrix(A)} ${col(v.coords, v.color)} \\
&= ${n(x)}\,${IHAT} + ${p(y)}\,${JHAT} \\
&= ${n(x)} ${col(A.i, I_COLOR)} + ${p(y)} ${col(A.j, J_COLOR)} \\
&= \begin{bmatrix} ${p(x)}\cdot${p(a)} + ${p(y)}\cdot${p(b)} \\ ${p(x)}\cdot${p(c)} + ${p(y)}\cdot${p(d)} \end{bmatrix}
 = ${col(result, v.color)}
\end{aligned}`

  return (
    <Block title={<span style={{ color: v.color }}>{v.name}</span>}>
      <Tex block tex={tex} />
      <Note>
        <Tex tex={`${name} = ${col(v.coords)}`} /> means "{fmt(x)} of î plus {fmt(y)} of ĵ". The transformation keeps
        that recipe and applies it to the <em>new</em> î and ĵ.
      </Note>
    </Block>
  )
}

function DetBlock({ A }: { A: Mat2 }) {
  const { a, b, c, d } = entries(A)
  const D = det(A)
  const meaning = (() => {
    if (Math.abs(D) < TOL) {
      return 'det = 0: space is squashed onto a line (or a point). Areas become 0, information is lost, and A has no inverse.'
    }
    const size = approx(Math.abs(D), 1) ? 'Areas are preserved' : `Every area scales by ${fmt(Math.abs(D))}×`
    return D < 0
      ? `${size}, and det < 0 means space was flipped: ĵ is now clockwise from î, like a mirror image.`
      : `${size}. The unit square (area 1) becomes the shaded parallelogram (area ${fmt(D)}).`
  })()

  return (
    <Block title="Determinant">
      <Tex block tex={`\\det(A) = ad - bc = ${p(a)}\\cdot${p(d)} - ${p(b)}\\cdot${p(c)} = ${color(D < 0 ? '#ff862f' : '#f4d345', n(D))}`} />
      <Note>{meaning}</Note>
    </Block>
  )
}

function EigenBlock({ A }: { A: Mat2 }) {
  const tr = trace(A)
  const D = det(A)
  const e = eigen(A)
  // λ² − (tr A)λ + det A = 0, with tidy signs
  const poly = `\\lambda^2 ${tr >= 0 ? '-' : '+'} ${n(Math.abs(tr))}\\lambda ${D >= 0 ? '+' : '-'} ${n(Math.abs(D))} = 0`

  let body: ReactNode
  if (e.kind === 'complex') {
    body = (
      <>
        <Tex block tex={`\\lambda = ${n(e.re)} \\pm ${n(e.im)}i`} />
        <Note>
          No real solutions, so no real eigenvectors: every vector gets rotated off its own line. Rotations look like
          this.
        </Note>
      </>
    )
  } else if (e.kind === 'every') {
    body = (
      <>
        <Tex block tex={`\\lambda = ${n(e.value)}`} />
        <Note>Every vector is an eigenvector: A just scales everything by {fmt(e.value)}.</Note>
      </>
    )
  } else {
    const pairs = e.kind === 'distinct' ? e.pairs : [e.pair]
    body = (
      <>
        {pairs.map(({ value, vector }, k) => (
          <Tex
            key={k}
            block
            tex={`\\lambda_${k + 1} = ${color('#e879f9', n(value))}, \\quad \\mathbf{u}_${k + 1} = ${col(vector)}`}
          />
        ))}
        <Note>
          Vectors on the pink dashed {pairs.length === 1 ? 'line' : 'lines'} stay on {pairs.length === 1 ? 'it' : 'them'}{' '}
          and only get scaled by λ{pairs.some((pr) => pr.value < 0) ? ' (negative λ: flipped to the other side)' : ''}.
          {e.kind === 'repeated' ? ' Only one such line exists here, typical of a shear.' : ''}
        </Note>
      </>
    )
  }

  return (
    <Block title="Eigenvalues & eigenvectors">
      <Note>
        Looking for vectors that stay on their own line: <Tex tex="A\mathbf{u} = \lambda\mathbf{u}" />. That needs{' '}
        <Tex tex="\det(A - \lambda I) = 0" />:
      </Note>
      <Tex block tex={poly} />
      {body}
    </Block>
  )
}

function InverseBlock({ A }: { A: Mat2 }) {
  const inv = inverse(A)
  const { a, b, c, d } = entries(A)
  if (!inv) {
    return (
      <Block title="Inverse">
        <Note>
          No inverse. det = 0 means many inputs land on the same output, so there's no way to undo it and know where you
          started.
        </Note>
      </Block>
    )
  }
  const D = det(A)
  return (
    <Block title="Inverse">
      <Tex
        block
        tex={`A^{-1} = \\frac{1}{${n(D)}} \\begin{bmatrix} ${n(d)} & ${n(-b)} \\\\ ${n(-c)} & ${n(a)} \\end{bmatrix} = ${matrix(inv, false)}`}
      />
      <Note>
        <Tex tex="A^{-1}" /> undoes A: <Tex tex="A^{-1}(A\mathbf{v}) = \mathbf{v}" />. Its columns are where î and ĵ must
        start so that A sends them back to [1, 0] and [0, 1].
      </Note>
    </Block>
  )
}

function Block({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-slate-400">{children}</p>
}

const colorWord = (word: string, hex: string) => (
  <span className="font-semibold" style={{ color: hex }}>
    {word}
  </span>
)
