import type { ReactNode } from 'react'
import { Canvas } from './components/Canvas'
import { CodePanel } from './components/CodePanel'
import { MathPanel } from './components/MathPanel'
import { Tex } from './components/Tex'
import { PlayIcon, Sidebar } from './components/Sidebar'
import { matApprox } from './lib/linalg'
import { PRESETS } from './lib/presets'
import { ihat, jhat } from './lib/tex'
import { useScene, type Toggles } from './state/store'
import { toHex, usePalette, useTheme, type ThemeMode } from './state/theme'
import { useAnimation } from './state/useAnimation'

/**
 * xl: inputs | canvas | math + code, all on screen at once.
 * md: canvas | one scrolling column. Mobile: everything stacked, canvas first.
 */
export function App() {
  useAnimation()

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] md:overflow-hidden xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(360px,440px)]">
        <div className="flex h-[70svh] min-h-[420px] min-w-0 flex-col md:h-auto md:min-h-0 xl:col-start-2 xl:row-start-1">
          <div className="min-h-0 flex-1">
            <Canvas />
          </div>
          <Controls />
        </div>
        {/* md: one scrolling column on the right. xl: `contents` lets both children become their own grid columns. */}
        <div className="flex min-w-0 flex-col bg-panel md:min-h-0 md:overflow-y-auto md:border-l md:border-rule xl:contents">
          <Sidebar />
          <div className="flex min-w-0 flex-col bg-panel xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:border-l xl:border-rule">
            <div className="border-b border-rule xl:min-h-0 xl:flex-[1.2] xl:overflow-y-auto">
              <MathPanel />
            </div>
            <div className="h-[480px] xl:h-auto xl:min-h-0 xl:flex-1">
              <CodePanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Header() {
  const applyPreset = useScene((s) => s.applyPreset)
  const A = useScene((s) => s.A)
  const pal = usePalette()
  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-rule bg-paper px-5 py-3">
      <h1 className="flex items-center gap-3 font-display text-xl font-bold tracking-tight text-ink">
        See the Matrix
        <span className="text-[15px] font-normal tracking-normal text-ink-2">
          <Tex tex={`A = \\begin{bmatrix} ${ihat(toHex(pal.ihat))} & ${jhat(toHex(pal.jhat))} \\end{bmatrix}`} />
        </span>
      </h1>
      <nav className="order-last flex max-w-full items-center gap-1.5 overflow-x-auto md:order-none md:flex-wrap" aria-label="Presets">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => applyPreset(p.id)} aria-pressed={matApprox(A, p.matrix)} className="btn">
            {p.label}
          </button>
        ))}
      </nav>
      <ThemeSwitch />
    </header>
  )
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: ReactNode }[] = [
  {
    mode: 'system',
    label: 'Match system',
    icon: (
      <>
        <rect x="1.5" y="2.5" width="11" height="7.5" rx="1" />
        <path d="M5 12.5h4" />
      </>
    ),
  },
  {
    mode: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="7" cy="7" r="2.5" />
        <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1" />
      </>
    ),
  },
  { mode: 'dark', label: 'Dark', icon: <path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" /> },
]

function ThemeSwitch() {
  const mode = useTheme((s) => s.mode)
  const setMode = useTheme((s) => s.setMode)
  return (
    <div role="radiogroup" aria-label="Theme" className="ml-auto flex rounded-[3px] border border-rule p-0.5">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.mode}
          role="radio"
          aria-checked={mode === o.mode}
          aria-label={o.label}
          title={o.label}
          onClick={() => setMode(o.mode)}
          className="grid size-7 place-items-center rounded-[2px] text-ink-3 transition-colors hover:text-ink aria-checked:bg-ink aria-checked:text-paper"
        >
          <svg viewBox="0 0 14 14" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  )
}

const TOGGLES: { key: keyof Toggles; label: string }[] = [
  { key: 'originalGrid', label: 'Original grid' },
  { key: 'linComb', label: 'Linear combination' },
  { key: 'detArea', label: 'Determinant area' },
  { key: 'eigen', label: 'Eigenvectors' },
  { key: 'inverse', label: 'Inverse' },
  { key: 'type', label: 'Transformation type' },
]

/** Animation scrubber + view toggles, under the canvas. */
function Controls() {
  const t = useScene((s) => s.t)
  const setT = useScene((s) => s.setT)
  const replay = useScene((s) => s.replay)
  const toggles = useScene((s) => s.toggles)
  const toggle = useScene((s) => s.toggle)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule bg-panel px-5 py-3">
      <div className="flex items-center gap-2.5">
        <button onClick={replay} className="btn" title="Animate from the identity to A">
          <PlayIcon /> Replay
        </button>
        <span className="font-mono text-xs text-ink-3">I</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="Animation progress from identity to A"
          className="w-36 accent-ink"
        />
        <span className="font-mono text-xs text-ink-3">A</span>
      </div>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="sr-only">Show on the canvas</legend>
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="group inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-2 select-none hover:text-ink">
            <input type="checkbox" checked={toggles[key]} onChange={() => toggle(key)} className="peer sr-only" />
            <span className="grid size-3.5 place-items-center rounded-[2px] border border-ink-3 text-paper transition-colors group-hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline-[1.5px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-focus-visible:outline-solid">
              <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 5.2l2 2L8 3" />
              </svg>
            </span>
            <span className="peer-checked:text-ink">{label}</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
