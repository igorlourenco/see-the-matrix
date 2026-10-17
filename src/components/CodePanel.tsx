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
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { tags } from '@lezer/highlight'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { useEffect, useRef, useState } from 'react'
import { generateCode } from '../lib/codegen'
import { parseCode } from '../lib/parser'
import type { RunResult } from '../lib/python'
import { useScene } from '../state/store'
import { Pane } from './Pane'

const notebookTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--ink)', fontSize: '13px', height: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace", lineHeight: '1.65' },
  '.cm-content': { caretColor: 'var(--ink)', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)', borderLeftWidth: '1.5px' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--ink-3)', border: 'none', paddingLeft: '8px' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--selection) !important',
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--selection)', outline: 'none' },
})

const notebookHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: 'var(--code-kw)' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-num)' },
    { tag: tags.string, color: 'var(--code-str)' },
    { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--code-fn)' },
    { tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--ink-2)' },
  ]),
)

const extensions = [python(), EditorView.lineWrapping, notebookHighlight]
const PARSE_DELAY_MS = 250

type RunState = { status: 'idle' | 'running' } | ({ status: 'done' } & RunResult)

export function CodePanel({ className = '' }: { className?: string }) {
  // A selector returning a string: zustand compares by value, so this only
  // re-renders when the code would actually change (not on every animation frame).
  const generated = useScene((s) =>
    generateCode({ A: s.A, after: s.after, vectors: s.vectors, showEigen: s.toggles.eigen, showInverse: s.toggles.inverse }),
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
    <Pane
      id="code"
      title="NumPy"
      className={className}
      actions={
        <>
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
          {run.status === 'running' ? 'Running…' : 'Run'}
          </button>
        </>
      }
    >

      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={doc}
          onChange={onChange}
          extensions={extensions}
          theme={notebookTheme}
          basicSetup={{ foldGutter: false, highlightActiveLine: false }}
          aria-label="NumPy code"
        />
      </div>

      <Output run={run} />
    </Pane>
  )
}

function SyncBadge({ error }: { error: { line: number; error: string } | null }) {
  if (!error) {
    return <span className="min-w-0 truncate text-xs text-ok" title="Edit values in the code to update the scene">
        ● live sync
      </span>
  }
  return (
    <span className="min-w-0 truncate text-xs text-err" title={error.error}>
      ● line {error.line}: {error.error}
    </span>
  )
}

function Output({ run }: { run: RunState }) {
  if (run.status === 'idle') {
    return (
      <p className="border-t border-rule px-5 py-2.5 text-xs text-ink-3">
        Press Run to execute this in real Python (Pyodide). The first run downloads ~10 MB.
      </p>
    )
  }
  if (run.status !== 'done') {
    return <p className="border-t border-rule px-5 py-2.5 text-xs text-ink-2">Starting Python + NumPy…</p>
  }
  return (
    <pre className="max-h-48 overflow-auto border-t border-rule bg-sunken px-5 py-2.5 font-mono text-xs leading-relaxed text-ink">
      {run.output}
      {run.error && <span className="text-err">{run.error}</span>}
    </pre>
  )
}
