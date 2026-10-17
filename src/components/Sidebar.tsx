import { useState } from 'react'
import { apply, IDENTITY, matApprox, type Vec2 } from '../lib/linalg'
import { AFTER_NAMES, chainLetters, productName } from '../lib/chain'
import { PRESETS } from '../lib/presets'
import { totalMatrix, useScene } from '../state/store'
import { usePalette } from '../state/theme'
import { ColumnReadout, ColumnVector, MatrixInput, Section, VecName } from './inputs'

export function Sidebar() {
  return (
    <>
      <BasisSection />
      <CompositionSection />
      <VectorsSection />
    </>
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

function CompositionSection() {
  const after = useScene((s) => s.after)
  const addAfter = useScene((s) => s.addAfter)
  const removeAfter = useScene((s) => s.removeAfter)
  const setAfterVector = useScene((s) => s.setAfterVector)
  const applyAfterPreset = useScene((s) => s.applyAfterPreset)
  const reverseChain = useScene((s) => s.reverseChain)
  const replay = useScene((s) => s.replay)
  const pal = usePalette()
  const letters = chainLetters(after.length)
  const nextLetter = AFTER_NAMES[after.length]

  return (
    <Section
      title="Composition"
      hint={
        after.length === 0
          ? 'Apply more matrices after A, one after another. The whole chain is a single matrix.'
          : `Applied in order: ${letters.join(', then ')}. Together they are one matrix, ${productName(after.length)}.`
      }
    >
      {after.length > 0 && (
        <ol className="mb-4 flex flex-col gap-3">
          {after.map((M, k) => (
            <li key={k} className="group flex items-center gap-2">
              <span className="w-6 font-math text-2xl text-ink italic">{AFTER_NAMES[k]}</span>
              <MatrixInput
                value={M}
                onChange={(which, v) => setAfterVector(k, which, v)}
                colors={{ i: pal.ihat, j: pal.jhat, bracket: pal.ink3 }}
                name={AFTER_NAMES[k]}
              />
              <PresetSelect
                label={`Preset for ${AFTER_NAMES[k]}`}
                value={PRESETS.find((p) => matApprox(M, p.matrix))?.id ?? ''}
                onChange={(id) => applyAfterPreset(k, id)}
              />
              <button
                onClick={() => removeAfter(k)}
                aria-label={`Remove ${AFTER_NAMES[k]}`}
                className="ml-auto grid size-7 shrink-0 place-items-center rounded-[3px] text-ink-3 hover:bg-sunken hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus:opacity-100"
              >
                <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        {nextLetter && (
          <button onClick={addAfter} className="btn">
            Add matrix <span className="font-math text-[13px] italic">{nextLetter}</span>
          </button>
        )}
        {after.length > 0 && (
          <>
            <button onClick={replay} className="btn">
              <PlayIcon /> Play {letters.join(' → ')}
            </button>
            <button onClick={reverseChain} className="btn" title="Same matrices, opposite order: see that order matters">
              Reverse order
            </button>
          </>
        )}
      </div>
    </Section>
  )
}

/** Native select restyled as a .btn; shows the preset the matrix currently matches, else "Custom". */
function PresetSelect({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  return (
    <div className="relative ml-1 shrink-0">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-[6.5rem] cursor-pointer appearance-none truncate rounded-[3px] border border-rule bg-paper py-0 pr-6 pl-2 text-xs font-medium text-ink transition-colors hover:border-ink-3 hover:bg-sunken"
      >
        <option value="" disabled>
          Custom
        </option>
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 10 6"
        className="pointer-events-none absolute top-1/2 right-2 h-1.5 w-2.5 -translate-y-1/2 text-ink-3"
        aria-hidden
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function VectorsSection() {
  const A0 = useScene((s) => s.A)
  const after = useScene((s) => s.after)
  const A = totalMatrix(A0, after)
  const vectors = useScene((s) => s.vectors)
  const updateVector = useScene((s) => s.updateVector)
  const removeVector = useScene((s) => s.removeVector)
  const addVector = useScene((s) => s.addVector)
  const [draft, setDraft] = useState<Vec2>([1, 2])
  const pal = usePalette()

  return (
    <Section title="Vectors" hint="Input on the left, where it lands on the right. Drag the arrow or its faded ghost.">
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
