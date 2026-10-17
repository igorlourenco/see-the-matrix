/**
 * Real Python + NumPy in the browser, via Pyodide (CPython compiled to WebAssembly).
 *
 * Loaded lazily on the first Run (~10 MB), then reused. The npm package
 * supplies the loader; the runtime and the numpy wheel come from the CDN
 * matching that version.
 */
import { loadPyodide, version } from 'pyodide'

type Pyodide = Awaited<ReturnType<typeof loadPyodide>>

let instance: Promise<Pyodide> | null = null

function getPyodide(): Promise<Pyodide> {
  instance ??= (async () => {
    const py = await loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/` })
    await py.loadPackage('numpy')
    return py
  })().catch((err) => {
    instance = null // let the next click retry (e.g. after a network blip)
    throw err
  })
  return instance
}

export interface RunResult {
  output: string
  error?: string
}

export async function runPython(code: string): Promise<RunResult> {
  const py = await getPyodide()
  let output = ''
  py.setStdout({ batched: (s) => (output += s + '\n') })
  py.setStderr({ batched: (s) => (output += s + '\n') })
  try {
    // Fresh globals each run, so deleting a line really deletes the variable.
    const globals = py.globals.get('dict')()
    try {
      await py.runPythonAsync(code, { globals })
    } finally {
      globals.destroy()
    }
    return { output }
  } catch (err) {
    // Python tracebacks are long; the last line holds the actual error.
    const message = String((err as Error).message ?? err).trim()
    return { output, error: message.split('\n').slice(-1)[0] }
  }
}
