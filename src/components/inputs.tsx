/** Column-vector inputs: the "type numbers" way to edit the scene. */
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { fmt } from '../lib/format'
import type { Vec2 } from '../lib/linalg'

/**
 * A number input that tolerates half-typed values like "-" or "1.".
 *
 * It keeps its own text and only commits to the store when the text is a
 * valid number. When the value changes from outside (a drag, a preset, code),
 * the text is replaced, unless it already means the same number.
 */
export function NumberField({ value, onCommit, label }: { value: number; onCommit: (n: number) => void; label: string }) {
  const [text, setText] = useState(fmt(value, 4))

  useEffect(() => {
    setText((current) => (Number(current) === value && current.trim() !== '' ? current : fmt(value, 4)))
  }, [value])

  // Arrow keys nudge by 1, Shift+arrow by 0.1.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const step = (e.shiftKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
    onCommit(Number((value + step).toFixed(4)))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(n)
      }}
      onBlur={() => setText(fmt(value, 4))}
      onKeyDown={onKeyDown}
      className="w-14 rounded-[3px] bg-transparent px-1 py-0.5 text-center font-mono text-sm text-ink tabular-nums outline-none hover:bg-ink/5 focus:bg-ink/8"
    />
  )
}

/** [x]
 *  [y]  with real bracket marks, the way it's written on paper. */
export function ColumnVector({
  value,
  onChange,
  color,
  name,
}: {
  value: Vec2
  onChange: (v: Vec2) => void
  color: string
  name: string
}) {
  return (
    <div className="relative inline-flex flex-col px-1.5">
      <span className="absolute inset-y-0 left-0 w-1.5 rounded-l border-y-2 border-l-2" style={{ borderColor: color }} />
      <NumberField value={value[0]} onCommit={(x) => onChange([x, value[1]])} label={`${name} x`} />
      <NumberField value={value[1]} onCommit={(y) => onChange([value[0], y])} label={`${name} y`} />
      <span className="absolute inset-y-0 right-0 w-1.5 rounded-r border-y-2 border-r-2" style={{ borderColor: color }} />
    </div>
  )
}

/** Read-only column vector, for showing outputs next to inputs. */
export function ColumnReadout({ value, color }: { value: Vec2; color: string }) {
  return (
    <div className="relative inline-flex flex-col px-2.5 py-0.5 font-mono text-sm leading-6" style={{ color }}>
      <span className="absolute inset-y-0 left-0 w-1.5 border-y border-l opacity-60" style={{ borderColor: color }} />
      <span className="text-center">{fmt(value[0])}</span>
      <span className="text-center">{fmt(value[1])}</span>
      <span className="absolute inset-y-0 right-0 w-1.5 border-y border-r opacity-60" style={{ borderColor: color }} />
    </div>
  )
}

/** A vector name typeset like the math panel: italic letters, upright subscript digits (v1 → v₁). */
export function VecName({ name }: { name: string }) {
  const m = /^([A-Za-z]+)_?(\d+)$/.exec(name)
  return (
    <span className="font-math italic">
      {m ? (
        <>
          {m[1]}
          <sub className="font-mathrm text-[0.68em] not-italic">{m[2]}</sub>
        </>
      ) : (
        name
      )}
    </span>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-rule px-5 pt-5 pb-6">
      <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {hint && <p className="mt-1 max-w-[46ch] text-[13px] leading-snug text-ink-2">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
