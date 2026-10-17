import { useState } from 'react'
import { apply, IDENTITY, type Vec2 } from '../lib/linalg'
import { useScene } from '../state/store'
import { usePalette } from '../state/theme'
import { ColumnReadout, ColumnVector, Section, VecName } from './inputs'

export function Sidebar() {
  return (
    <aside className="flex flex-col border-rule bg-panel xl:col-start-1 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto xl:border-r">
      <BasisSection />
      <VectorsSection />
    </aside>
  )
}

function BasisSection() {
  const A = useScene((s) => s.A)
  const setBasisVector = useScene((s) => s.setBasisVector)
  const replay = useScene((s) => s.replay)
  const pal = usePalette()

  return (
    <Section title="Basis vectors" hint="Where do î and ĵ land? Type here or drag their tips. They become the columns of A.">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-math text-2xl text-ihat italic">î</span>
          <ColumnVector value={A.i} onChange={(v) => setBasisVector('i', v, 'inputs')} color={pal.ihat} name="i hat" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-math text-2xl text-jhat italic">ĵ</span>
          <ColumnVector value={A.j} onChange={(v) => setBasisVector('j', v, 'inputs')} color={pal.jhat} name="j hat" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={replay} className="btn">
          <PlayIcon /> Replay from I
        </button>
        <button
          onClick={() => {
            setBasisVector('i', IDENTITY.i, 'inputs')
            setBasisVector('j', IDENTITY.j, 'inputs')
          }}
          className="btn"
        >
          Reset to I
        </button>
      </div>
    </Section>
  )
}

function VectorsSection() {
  const A = useScene((s) => s.A)
  const vectors = useScene((s) => s.vectors)
  const updateVector = useScene((s) => s.updateVector)
  const removeVector = useScene((s) => s.removeVector)
  const addVector = useScene((s) => s.addVector)
  const [draft, setDraft] = useState<Vec2>([1, 2])
  const pal = usePalette()

  return (
    <Section title="Vectors" hint="Input on the left, where A sends it on the right. Drag the arrow or its faded ghost.">
      <ul className="flex flex-col gap-3">
        {vectors.map((v) => {
          const c = pal.vectors[v.colorIndex]
          return (
            <li key={v.id} className="group flex items-center gap-2">
              <span className="w-8 text-lg" style={{ color: c }}>
                <VecName name={v.name} />
              </span>
              <ColumnVector value={v.coords} onChange={(next) => updateVector(v.id, next, 'inputs')} color={c} name={v.name} />
              <span className="font-mono text-xs text-ink-3" aria-hidden>
                ↦
              </span>
              <ColumnReadout value={apply(A, v.coords)} color={c} />
              <button
                onClick={() => removeVector(v.id)}
                aria-label={`Remove ${v.name}`}
                className="ml-auto grid size-7 place-items-center rounded-[3px] text-ink-3 hover:bg-sunken hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus:opacity-100"
              >
                <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex items-center gap-3 rounded-[3px] border border-dashed border-rule p-2.5">
        <ColumnVector value={draft} onChange={setDraft} color={pal.ink3} name="new vector" />
        <button onClick={() => addVector(draft)} className="btn">
          Add vector
        </button>
      </div>
    </Section>
  )
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      <path d="M2 1.2v7.6L8.6 5z" fill="currentColor" />
    </svg>
  )
}
