import { useState } from 'react'
import { apply, IDENTITY, type Vec2 } from '../lib/linalg'
import { I_COLOR, J_COLOR } from '../lib/tex'
import { useScene } from '../state/store'
import { ColumnReadout, ColumnVector, Section } from './inputs'

export function Sidebar() {
  return (
    <aside className="flex flex-col overflow-y-auto border-line bg-panel lg:border-r">
      <BasisSection />
      <VectorsSection />
    </aside>
  )
}

function BasisSection() {
  const A = useScene((s) => s.A)
  const setBasisVector = useScene((s) => s.setBasisVector)
  const replay = useScene((s) => s.replay)

  return (
    <Section title="Basis vectors" hint="Where do î and ĵ land? Type here or drag their tips. They become the columns of A.">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold" style={{ color: I_COLOR }}>
            î
          </span>
          <ColumnVector value={A.i} onChange={(v) => setBasisVector('i', v, 'inputs')} color={I_COLOR} name="i hat" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold" style={{ color: J_COLOR }}>
            ĵ
          </span>
          <ColumnVector value={A.j} onChange={(v) => setBasisVector('j', v, 'inputs')} color={J_COLOR} name="j hat" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={replay} className="btn">
          ▶ Replay from I
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

  return (
    <Section title="Vectors" hint="Input on the left, where A sends it on the right. Drag the arrow or its faded ghost.">
      <ul className="flex flex-col gap-3">
        {vectors.map((v) => (
          <li key={v.id} className="group flex items-center gap-2">
            <span className="w-7 font-mono text-sm font-semibold" style={{ color: v.color }}>
              {v.name}
            </span>
            <ColumnVector value={v.coords} onChange={(c) => updateVector(v.id, c, 'inputs')} color={v.color} name={v.name} />
            <span className="text-slate-500" aria-hidden>
              →
            </span>
            <span className="font-mono text-xs text-slate-500">A·{v.name} =</span>
            <ColumnReadout value={apply(A, v.coords)} color={v.color} />
            <button
              onClick={() => removeVector(v.id)}
              aria-label={`Remove ${v.name}`}
              className="ml-auto rounded px-1.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-200 focus:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-line p-2">
        <ColumnVector value={draft} onChange={setDraft} color="#64748b" name="new vector" />
        <button onClick={() => addVector(draft)} className="btn">
          + Add vector
        </button>
      </div>
    </Section>
  )
}
