/**
 * The NumPy view: state → code (generated) and code → state (parsed).
 *
 * Two directions, one loop to avoid:
 *   - When the scene changes from inputs, canvas or presets, regenerate the code.
 *   - When the user types, parse (debounced) and push the result into the store.
 *     That store update changes the generated code too, and writing it back
 *     would clobber what they're typing (cursor jumps, comments vanish).
 *     So we skip regeneration when `lastSource === 'code'`.
 */
import { python } from '@codemirror/lang-python'
import CodeMirror from '@uiw/react-codemirror'
import { useEffect, useRef, useState } from 'react'
import { generateCode } from '../lib/codegen'
import { parseCode } from '../lib/parser'
import type { RunResult } from '../lib/python'
import { useScene } from '../state/store'

const extensions = [python()]
const PARSE_DELAY_MS = 250

type RunState = { status: 'idle' | 'running' } | ({ status: 'done' } & RunResult)

export function CodePanel() {
  // A selector returning a string: zustand compares by value, so this only
  // re-renders when the code would actually change (not on every animation frame).
  const generated = useScene((s) =>
    generateCode({ A: s.A, vectors: s.vectors, showEigen: s.toggles.eigen, showInverse: s.toggles.inverse }),
  )
  const syncFromCode = useScene((s) => s.syncFromCode)

  const [doc, setDoc] = useState(generated)
  const [parseError, setParseError] = useState<{ line: number; error: string } | null>(null)
  const [run, setRun] = useState<RunState>({ status: 'idle' })
  const timer = useRef<number | undefined>(undefined)

  // State → code
  useEffect(() => {
    if (useScene.getState().lastSource === 'code') return
    window.clearTimeout(timer.current) // a pending parse of old text would undo this change
    setDoc(generated)
    setParseError(null)
  }, [generated])

  // Code → state
  const onChange = (value: string) => {
    setDoc(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const result = parseCode(value)
      if (result.ok) {
        setParseError(null)
        syncFromCode(result.scene)
      } else {
        // Keep the last good scene on screen; just say what's wrong.
        setParseError({ line: result.line, error: result.error })
      }
    }, PARSE_DELAY_MS)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onRun = async () => {
    setRun({ status: 'running' })
    try {
      // Code-split: the Pyodide loader is only fetched on the first Run.
      // That first run also downloads the runtime; later runs are near-instant.
      const { runPython } = await import('../lib/python')
      const result = await runPython(doc)
      setRun({ status: 'done', ...result })
    } catch (err) {
      setRun({ status: 'done', output: '', error: `Couldn't load Python: ${(err as Error).message}` })
    }
  }


  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">NumPy</h2>
        <SyncBadge error={parseError} />
        <button
          onClick={() => {
            useScene.setState({ lastSource: 'inputs' })
            setDoc(generated)
            setParseError(null)
          }}
          className="btn ml-auto"
          title="Regenerate code from the current scene"
        >
          Reset
        </button>
        <button onClick={onRun} disabled={run.status === 'running'} className="btn btn-primary">
          {run.status === 'running' ? 'Running…' : '▶ Run'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto text-[13px]">
        <CodeMirror
          value={doc}
          onChange={onChange}
          extensions={extensions}
          theme="dark"
          basicSetup={{ foldGutter: false, highlightActiveLine: false }}
          aria-label="NumPy code"
        />
      </div>

      <Output run={run} />
    </div>
  )
}

function SyncBadge({ error }: { error: { line: number; error: string } | null }) {
  if (!error) {
    return <span className="text-xs text-emerald-400/80">● live: edit values to update the scene</span>
  }
  return (
    <span className="truncate text-xs text-amber-400" title={error.error}>
      ● line {error.line}: {error.error}
    </span>
  )
}

function Output({ run }: { run: RunState }) {
  if (run.status === 'idle') {
    return (
      <p className="border-t border-line px-4 py-2 text-xs text-slate-500">
        Press Run to execute this in real Python (Pyodide). The first run downloads ~10 MB.
      </p>
    )
  }
  if (run.status !== 'done') {
    return <p className="border-t border-line px-4 py-2 text-xs text-slate-400">Starting Python + NumPy…</p>
  }
  return (
    <pre className="max-h-48 overflow-auto border-t border-line bg-black/30 px-4 py-2 font-mono text-xs leading-relaxed text-slate-300">
      {run.output}
      {run.error && <span className="text-rose-400">{run.error}</span>}
    </pre>
  )
}
