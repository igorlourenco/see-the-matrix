import { useEffect, type ReactNode } from 'react'
import { Credits } from './Credits'
import { ThemeSwitch } from './ThemeSwitch'

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Pick a preset',
    body: 'Click Rotate 90°, Shear or any other preset in the top bar. The grid animates from the identity to the new matrix.',
  },
  {
    title: 'Drag î and ĵ',
    body: (
      <>
        Grab the tips of the <I /> and <J /> arrows. Wherever they land becomes the columns of A, and every other vector
        follows.
      </>
    ),
  },
  {
    title: 'Follow a vector',
    body: (
      <>
        <M>v</M>₁ = [2, 3] means 2 of <I /> plus 3 of <J />. Its arrow shows where it lands, the faded ghost shows where it
        started, and the Math panel walks through A·<M>v</M>₁ step by step.
      </>
    ),
  },
  {
    title: 'Read the math',
    body: 'Each block in the Math panel states the result in words first, then shows the calculation: the kind of transformation, the determinant, eigenvectors and the inverse.',
  },
  {
    title: 'Chain transformations',
    body: 'In Composition, add matrix B (and C, D, …). Replay shows A, then B on top of it, then C. Multiplying matrices is just applying them one after another.',
  },
  {
    title: 'Edit the code',
    body: 'Change a number in the NumPy panel and the canvas updates as you type. Press Run to check the result in real Python.',
  },
]

const FEATURES: { group: string; items: ReactNode[] }[] = [
  {
    group: 'Canvas',
    items: [
      'The warped grid drawn over the original graph paper, so you can compare before and after.',
      <>Drag the <I /> and <J /> tips to edit the matrix directly. Coordinates snap to whole numbers.</>,
      'Drag a vector’s arrow to ask “which input lands here?”, or drag its faded ghost to move the input itself.',
      'Replay animates from the identity to A; the slider scrubs anywhere in between.',
      'Zoom with the mouse wheel or the + / − buttons.',
    ],
  },
  {
    group: 'Overlays',
    items: [
      'Original grid: show or hide the untouched reference grid.',
      <>Linear combination: draws each vector as x·<I /> then y·<J />, tip to tail.</>,
      'Determinant area: the unit square after the transformation, hatched. The hatching flips when det < 0.',
      'Eigenvectors: dashed lines that stay on their own span, labeled with λ.',
      'Inverse and Transformation type: extra blocks in the Math panel.',
    ],
  },
  {
    group: 'Presets',
    items: ['Identity, Rotate 90°, Shear, Scale ×2, Stretch, Reflect, Projection, Singular (det = 0) and a General matrix.'],
  },
  {
    group: 'Composition',
    items: [
      'Add matrices after A (B, C, D, E, F) to apply them one after another. The whole chain is a single matrix, like CBA.',
      'The animation plays each stage in turn: I → A → B → C, with each letter marked on the slider.',
      'The Math panel follows î and ĵ through the chain, shows why order matters, and multiplies the determinants.',
      '“Reverse order” applies the same matrices backwards, usually giving a different result.',
    ],
  },
  {
    group: 'Inputs',
    items: [
      'Column-vector fields for î, ĵ and every vector, with the transformed result next to each input.',
      'Add as many vectors as you like; each gets its own color across the canvas, math and code.',
    ],
  },
  {
    group: 'Math panel',
    items: [
      'Live KaTeX derivations: A·v as a mix of the new î and ĵ, the determinant with its meaning, the characteristic polynomial and the inverse.',
    ],
  },
  {
    group: 'NumPy panel',
    items: [
      'Code generated from the scene, always in sync.',
      'Edits flow back to the canvas: np.array, np.column_stack, arithmetic, np.pi, np.sin / cos / sqrt and scalar variables like theta.',
      'Errors point to the exact line and leave the last good scene on screen.',
      'Run executes the code in real Python and NumPy in your browser (Pyodide, downloaded on first run).',
    ],
  },
  {
    group: 'Layout',
    items: [
      'Collapse the left or right column from the top bar to give the canvas more room.',
      'Maximize Inputs, Math or NumPy into a large overlay; everything stays live.',
      'Light, dark or follow-the-system theme. Works on phones and tablets.',
    ],
  },
]

const TIPS: { keys: string[]; text: string }[] = [
  { keys: ['↑', '↓'], text: 'In any number field, nudge the value by 1.' },
  { keys: ['Shift', '↑'], text: 'Nudge by 0.1 instead.' },
  { keys: ['Esc'], text: 'Close a maximized panel.' },
  { keys: ['Reset'], text: 'In the NumPy panel, regenerate the code from the current scene.' },
]

export function Guide() {
  useEffect(() => {
    document.title = 'How to use · See the Matrix'
    return () => {
      document.title = 'See the Matrix'
    }
  }, [])

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-rule bg-paper px-5 py-3">
        <a href="#" className="font-display text-xl font-bold tracking-tight text-ink">
          See the Matrix
        </a>
        <div className="ml-auto flex items-center gap-2">
          <a href="#" className="btn btn-primary">
            Open the app
          </a>
          <ThemeSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 pt-14 pb-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">How to use</p>
        <h1 className="mt-2 font-display text-[34px] leading-tight font-bold tracking-tight text-ink">
          See what a matrix actually does
        </h1>
        <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">
          A 2×2 matrix is a record of where <I /> and <J /> land. Move them and watch the picture, the math and the NumPy
          code change together.
        </p>

        <Section title="Start in a minute">
          <ol className="flex flex-col gap-6">
            {STEPS.map((s, k) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-x-2">
                <span className="pt-0.5 font-mono text-[13px] text-ink-3 tabular-nums">{String(k + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-display text-[17px] font-semibold tracking-tight text-ink">{s.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Features">
          <div className="flex flex-col divide-y divide-rule">
            {FEATURES.map((f) => (
              <div key={f.group} className="grid gap-x-8 gap-y-2 py-5 first:pt-0 sm:grid-cols-[9rem_1fr]">
                <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink">{f.group}</h3>
                <ul className="flex flex-col gap-2">
                  {f.items.map((item, k) => (
                    <li key={k} className="relative pl-4 text-[15px] leading-relaxed text-ink-2">
                      <span className="absolute top-[0.7em] left-0 h-px w-2 bg-ink-3" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tips">
          <dl className="flex flex-col gap-3">
            {TIPS.map((t) => (
              <div key={t.text} className="grid gap-x-8 gap-y-1 sm:grid-cols-[9rem_1fr]">
                <dt className="flex items-center gap-1">
                  {t.keys.map((k) => (
                    <kbd
                      key={k}
                      className="rounded-[3px] border border-rule bg-panel px-1.5 py-0.5 font-mono text-xs text-ink shadow-[0_1px_0_var(--rule)]"
                    >
                      {k}
                    </kbd>
                  ))}
                </dt>
                <dd className="text-[15px] leading-relaxed text-ink-2">{t.text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <Credits />
          <a href="#" className="btn">
            Open the app
          </a>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="mb-6 font-display text-[22px] font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  )
}

function M({ children }: { children: ReactNode }) {
  return <span className="font-math italic">{children}</span>
}

function I() {
  return <span className="font-math text-ihat italic">î</span>
}

function J() {
  return <span className="font-math text-jhat italic">ĵ</span>
}
