import type { CSSProperties } from 'react'
import { Canvas } from './components/Canvas'
import { CodePanel } from './components/CodePanel'
import { MathPanel } from './components/MathPanel'
import { Pane } from './components/Pane'
import { Tex } from './components/Tex'
import { ThemeSwitch } from './components/ThemeSwitch'
import { Credits } from './components/Credits'
import { Guide } from './components/Guide'
import { Checkbox } from './components/inputs'
import { PlayIcon, Sidebar } from './components/Sidebar'
import { chainLetters } from './lib/chain'
import { matApprox, stageAt } from './lib/linalg'
import { PRESETS } from './lib/presets'
import { ihat, jhat } from './lib/tex'
import { useLayout } from './state/layout'
import { useRoute } from './state/route'
import { useScene, type Toggles } from './state/store'
import { toHex, usePalette } from './state/theme'
import { useAnimation } from './state/useAnimation'

/**
 * xl: inputs | canvas | math + code, all on screen at once.
 * md: canvas | one scrolling column. Mobile: everything stacked, canvas first.
 * Either side column can be collapsed so the canvas takes the space.
 */
export function App() {
  return useRoute() === 'guide' ? <Guide /> : <Workspace />
}

function Workspace() {
  useAnimation()
  const leftOpen = useLayout((s) => s.leftOpen)
  const rightOpen = useLayout((s) => s.rightOpen)
  const anySide = leftOpen || rightOpen

  const columns = {
    '--left': leftOpen ? 'minmax(280px,320px)' : '0px',
    '--right': rightOpen ? 'minmax(360px,440px)' : '0px',
    '--side': anySide ? 'minmax(320px,380px)' : '0px',
  } as CSSProperties

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main
        style={columns}
        className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_var(--side)] md:overflow-hidden xl:grid-cols-[var(--left)_minmax(0,1fr)_var(--right)]"
      >
        <div className="flex h-[70svh] min-h-[420px] min-w-0 flex-col md:h-auto md:min-h-0 xl:col-start-2 xl:row-start-1">
          <div className="min-h-0 flex-1">
            <Canvas />
          </div>
          <Controls />
        </div>
        {/* md: one scrolling column on the right. xl: `contents` lets both children become their own grid columns. */}
        <div
          className={`min-w-0 flex-col bg-panel md:min-h-0 md:overflow-y-auto md:border-l md:border-rule xl:contents ${anySide ? 'flex' : 'hidden'}`}
        >
          {leftOpen && (
            <Pane
              id="inputs"
              title="Inputs"
              readable
              className="border-b border-rule xl:col-start-1 xl:row-start-1 xl:border-r xl:border-b-0"
              bodyClassName="xl:overflow-y-auto"
              footer={<Credits />}
            >
              <Sidebar />
            </Pane>
          )}
          <div
            className={`min-w-0 flex-col bg-panel xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:border-l xl:border-rule ${rightOpen ? 'flex' : 'hidden'}`}
          >
            <Pane
              id="math"
              title="Math"
              readable
              className="border-b border-rule xl:flex-[1.2]"
              bodyClassName="xl:overflow-y-auto"
            >
              <MathPanel />
            </Pane>
            <CodePanel className="h-[520px] xl:h-auto xl:flex-1" />
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
      <div className="ml-auto flex items-center gap-2">
        <a href="#guide" className="btn">
          How to use
        </a>
        <ColumnToggles />
        <ThemeSwitch />
      </div>
    </header>
  )
}

function ColumnToggles() {
  const leftOpen = useLayout((s) => s.leftOpen)
  const rightOpen = useLayout((s) => s.rightOpen)
  const toggleLeft = useLayout((s) => s.toggleLeft)
  const toggleRight = useLayout((s) => s.toggleRight)
  return (
    <div className="flex rounded-[3px] border border-rule p-0.5">
      <PanelToggle side="left" open={leftOpen} onClick={toggleLeft} label="inputs panel" />
      <PanelToggle side="right" open={rightOpen} onClick={toggleRight} label="math and code panel" />
    </div>
  )
}

function PanelToggle({ side, open, onClick, label }: { side: 'left' | 'right'; open: boolean; onClick: () => void; label: string }) {
  const x = side === 'left' ? 1.5 : 8.5
  return (
    <button
      onClick={onClick}
      aria-pressed={open}
      aria-label={`${open ? 'Hide' : 'Show'} ${label}`}
      title={`${open ? 'Hide' : 'Show'} ${label}`}
      className="grid size-7 place-items-center rounded-[2px] text-ink-3 transition-colors hover:text-ink aria-pressed:text-ink"
    >
      <svg viewBox="0 0 14 14" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" aria-hidden>
        <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
        <path d={side === 'left' ? 'M5.5 2.5v9' : 'M8.5 2.5v9'} />
        {open && <rect x={x} y="2.5" width="4" height="9" fill="currentColor" stroke="none" opacity={0.35} />}
      </svg>
    </button>
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
  const after = useScene((s) => s.after)
  const letters = ['I', ...chainLetters(after.length)]
  const { index } = stageAt(letters.length - 1, t)
  const active = t <= 0 ? 0 : index + 1

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule bg-panel px-5 py-3">
      <div className="flex items-center gap-2.5">
        <button onClick={replay} className="btn" title={`Animate ${letters.join(' → ')}`}>
          <PlayIcon /> Replay
        </button>
        <div className={`relative pb-4 ${letters.length > 3 ? 'w-56' : 'w-44'}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            aria-label={`Animation progress, ${letters.join(' then ')}`}
            className="block w-full accent-ink"
          />
          {/* One label per stage, under the point of the track where that matrix has been fully applied. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-[7px] bottom-0 h-3.5">
            {letters.map((L, k) => (
              <span
                key={L}
                style={{ left: `${(k / (letters.length - 1)) * 100}%` }}
                className={`absolute -translate-x-1/2 font-math text-[13px] leading-none italic transition-colors ${
                  k === active ? 'text-ink' : 'text-ink-3'
                } ${k === 0 ? 'not-italic font-mathrm' : ''}`}
              >
                {L}
              </span>
            ))}
          </div>
        </div>
      </div>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="sr-only">Show on the canvas</legend>
        {TOGGLES.map(({ key, label }) => (
          <Checkbox key={key} checked={toggles[key]} onChange={() => toggle(key)}>
            {label}
          </Checkbox>
        ))}
      </fieldset>
    </div>
  )
}
