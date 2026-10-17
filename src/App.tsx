import { Canvas } from './components/Canvas'
import { CodePanel } from './components/CodePanel'
import { MathPanel } from './components/MathPanel'
import { Sidebar } from './components/Sidebar'
import { PRESETS } from './lib/presets'
import { useScene, type Toggles } from './state/store'
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
        <div className="flex min-w-0 flex-col bg-panel md:min-h-0 md:overflow-y-auto md:border-l md:border-line xl:contents">
          <Sidebar />
          <div className="flex min-w-0 flex-col bg-panel xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:border-l xl:border-line">
            <div className="border-b border-line xl:min-h-0 xl:flex-[1.2] xl:overflow-y-auto">
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
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-2.5">
      <h1 className="text-base font-semibold tracking-tight text-slate-100">
        See the Matrix
        <span className="ml-2 font-normal text-slate-500">
          A = [ <span className="text-ihat">î</span> <span className="text-jhat">ĵ</span> ]
        </span>
      </h1>
      <nav className="flex max-w-full gap-1.5 overflow-x-auto md:flex-wrap" aria-label="Presets">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => applyPreset(p.id)} className="btn">
            {p.label}
          </button>
        ))}
      </nav>
    </header>
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-panel px-4 py-2.5">
      <div className="flex items-center gap-2">
        <button onClick={replay} className="btn" title="Animate from the identity to A">
          ▶ Replay
        </button>
        <span className="font-mono text-xs text-slate-500">I</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="Animation progress from identity to A"
          className="w-36 accent-sky-400"
        />
        <span className="font-mono text-xs text-slate-500">A</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TOGGLES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            aria-pressed={toggles[key]}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              toggles[key]
                ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
                : 'border-line text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
