/**
 * Code → state: a tiny interpreter for the subset of Python/NumPy that
 * describes the scene.
 *
 * Why not just run the code in Pyodide and read the variables back?
 *   1. Pyodide is a ~10 MB download, and live sync should work instantly on
 *      every keystroke.
 *   2. A small parser gives precise, friendly error messages.
 * Pyodide still runs the full code (the "Run" button). The parser only has to
 * understand what sets the scene:
 *
 *   theta = np.pi / 6                                  scalars, with arithmetic
 *   i_hat = np.array([np.cos(theta), np.sin(theta)])   basis vectors
 *   A = np.column_stack([i_hat, j_hat])                matrix from columns
 *   A = np.array([[2, -1], [1, 1]])                    matrix from ROWS
 *   B = np.array([[0, -1], [1, 0]])                    matrices applied after A: B, C, D, E, F
 *   v1 = np.array([2, 3])                              any other 2D vector
 *
 * Any other line (print, if, `w = A @ v1`, ...) is skipped, so the user can
 * write normal Python around these.
 */
import { AFTER_NAMES } from './chain'
import { fromRows, type Mat2, type Vec2 } from './linalg'

export interface ParsedScene {
  /** Missing entries mean "leave as it is". */
  basis: { i?: Vec2; j?: Vec2 }
  /** Matrices applied after A, in order (B, C, ...). Empty: no composition. */
  after: Mat2[]
  vectors: { name: string; coords: Vec2 }[]
}

export type ParseResult = { ok: true; scene: ParsedScene } | { ok: false; error: string; line: number }

/** A Python value we understand: a number or a (nested) list of numbers. */
type Value = number | Value[]

class ParseError extends Error {}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseCode(source: string): ParseResult {
  const env = new Map<string, Value>()
  const order: string[] = [] // first-assignment order, so vectors keep their place
  let matrixA: [Vec2, Vec2] | null = null
  const afterMats = new Map<string, [Vec2, Vec2]>()
  const isAfterName = (name: string) => (AFTER_NAMES as readonly string[]).includes(name)

  for (const stmt of splitStatements(source)) {
    // Only top-level `name = expr` lines. Indented lines (inside if/for)
    // only run conditionally, so they're skipped.
    const m = /^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]+)$/.exec(stmt.text)
    if (!m) continue
    const [, name, rhs] = m
    // Lines that clearly try to set the scene must parse, or the user gets an error.
    // Anything else we can't evaluate is plain Python that only Pyodide runs.
    const mustParse = /^np\.(array|column_stack)\s*\(/.test(rhs) || ['i_hat', 'j_hat', 'A'].includes(name) || isAfterName(name)

    let value: Value
    try {
      value = evaluate(rhs, env)
    } catch (e) {
      if (mustParse) return { ok: false, line: stmt.line, error: (e as Error).message }
      env.delete(name) // we no longer know this name's value
      if (name === 'A') matrixA = null
      afterMats.delete(name)
      continue
    }

    const shapeError = checkShape(name, value)
    if (shapeError) return { ok: false, line: stmt.line, error: shapeError }

    env.set(name, value)
    if (!order.includes(name)) order.push(name)
    if (name === 'A' && isMat2(value)) matrixA = value
    if (isAfterName(name) && isMat2(value)) afterMats.set(name, value)
  }

  // A matrix assigned to A wins, as in Python: later edits to i_hat don't
  // change an A that was already built from it.
  const basis: ParsedScene['basis'] = {}
  if (matrixA) {
    const M = fromRows(matrixA)
    basis.i = M.i
    basis.j = M.j
  } else {
    const i = env.get('i_hat')
    const j = env.get('j_hat')
    if (i !== undefined && isVec2(i)) basis.i = i
    if (j !== undefined && isVec2(j)) basis.j = j
  }

  const vectors = order
    .filter((name) => name !== 'i_hat' && name !== 'j_hat' && !isAfterName(name))
    .flatMap((name) => {
      const v = env.get(name)
      return v !== undefined && isVec2(v) ? [{ name, coords: v }] : []
    })

  // The chain runs B, C, D, ... and stops at the first missing letter.
  const after: Mat2[] = []
  for (const name of AFTER_NAMES) {
    const rows = afterMats.get(name)
    if (!rows) break
    after.push(fromRows(rows))
  }

  return { ok: true, scene: { basis, vectors, after } }
}

function isVec2(v: Value): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number')
}

function isMat2(v: Value): v is [[number, number], [number, number]] {
  return Array.isArray(v) && v.length === 2 && v.every(isVec2)
}

function checkShape(name: string, v: Value): string | null {
  if ((name === 'A' || (AFTER_NAMES as readonly string[]).includes(name)) && !isMat2(v)) return `${name} must be a 2×2 matrix, like np.array([[1, 0], [0, 1]])`
  if ((name === 'i_hat' || name === 'j_hat') && !isVec2(v)) return `${name} must be a 2D vector, like np.array([1, 0])`
  if (Array.isArray(v) && !isVec2(v) && !isMat2(v)) {
    return `${name} has shape this 2D view doesn't support (expected 2 numbers, or 2×2)`
  }
  return null
}

// ---------------------------------------------------------------------------
// Statements: strip comments, join lines inside open brackets
// ---------------------------------------------------------------------------

function splitStatements(source: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = []
  let buffer = ''
  let startLine = 0
  let depth = 0

  source.split('\n').forEach((raw, idx) => {
    let line = ''
    let quote: string | null = null
    for (const ch of raw) {
      if (quote) {
        if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else if (ch === '#') {
        break // the rest is a comment
      } else if ('([{'.includes(ch)) {
        depth++
      } else if (')]}'.includes(ch)) {
        depth--
      }
      line += ch
    }

    if (buffer === '') startLine = idx + 1
    buffer += (buffer ? ' ' : '') + (buffer ? line.trim() : line.trimEnd())
    if (depth <= 0) {
      if (buffer.trim()) out.push({ text: buffer, line: startLine })
      buffer = ''
      depth = 0
    }
  })
  if (buffer.trim()) out.push({ text: buffer, line: startLine })
  return out
}

// ---------------------------------------------------------------------------
// Expressions: tokenizer + recursive-descent evaluator
//
//   expr    := term (('+' | '-') term)*
//   term    := unary (('*' | '/') unary)*
//   unary   := ('-' | '+') unary | power
//   power   := primary ('**' unary)?
//   primary := NUMBER | '(' expr ')' | '[' list ']' | dotted_name ['(' args ')']
// ---------------------------------------------------------------------------

type Token = { kind: 'num'; value: number } | { kind: 'name'; value: string } | { kind: 'op'; value: string }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([A-Za-z_]\w*)|(\*\*|[-+*/()[\],.]))/y
  let pos = 0
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break
    re.lastIndex = pos
    const m = re.exec(src)
    if (!m) {
      const ch = src.slice(pos).trim()[0]
      throw new ParseError(
        ch === '@'
          ? 'live sync only understands plain values here (the "@" works when you press Run)'
          : `unexpected character '${ch}'`,
      )
    }
    if (m[1] !== undefined) tokens.push({ kind: 'num', value: Number(m[1]) })
    else if (m[2] !== undefined) tokens.push({ kind: 'name', value: m[2] })
    else tokens.push({ kind: 'op', value: m[3] })
    pos = re.lastIndex
  }
  return tokens
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }

const FUNCTIONS: Record<string, (args: Value[]) => Value> = {
  // np.array([...]) is just the list itself. Shapes are checked after evaluation.
  array: ([x]) => {
    if (!Array.isArray(x)) throw new ParseError('np.array expects a list, like np.array([2, 3])')
    return x
  },
  // np.column_stack([u, v]) puts u and v side by side as COLUMNS.
  // We store values as rows (like NumPy), so this is a transpose.
  column_stack: ([x]) => {
    if (!Array.isArray(x) || !x.every(isVec2)) {
      throw new ParseError('np.column_stack expects a list of 2D vectors, like [i_hat, j_hat]')
    }
    const cols = x as Vec2[]
    return [cols.map((c) => c[0]), cols.map((c) => c[1])]
  },
  sqrt: unary(Math.sqrt),
  sin: unary(Math.sin),
  cos: unary(Math.cos),
  tan: unary(Math.tan),
  abs: unary(Math.abs),
  radians: unary((d) => (d * Math.PI) / 180),
  deg2rad: unary((d) => (d * Math.PI) / 180),
  float: unary((x) => x),
}

function unary(f: (x: number) => number) {
  return ([x]: Value[]) => {
    if (typeof x !== 'number') throw new ParseError('expected a number')
    return f(x)
  }
}

function evaluate(src: string, env: Map<string, Value>): Value {
  const tokens = tokenize(src)
  let i = 0

  const peek = () => tokens[i]
  const isOp = (op: string) => peek()?.kind === 'op' && peek()!.value === op
  const expect = (op: string) => {
    if (!isOp(op)) throw new ParseError(`expected '${op}'`)
    i++
  }
  const num = (v: Value): number => {
    if (typeof v !== 'number') {
      throw new ParseError('live sync only does arithmetic on numbers (vector math works when you press Run)')
    }
    return v
  }

  function expr(): Value {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = tokens[i++].value
      const right = term()
      left = op === '+' ? num(left) + num(right) : num(left) - num(right)
    }
    return left
  }

  function term(): Value {
    let left = unaryExpr()
    while (isOp('*') || isOp('/')) {
      const op = tokens[i++].value
      const right = unaryExpr()
      left = op === '*' ? num(left) * num(right) : num(left) / num(right)
    }
    return left
  }

  function unaryExpr(): Value {
    if (isOp('-')) {
      i++
      return -num(unaryExpr())
    }
    if (isOp('+')) {
      i++
      return num(unaryExpr())
    }
    return power()
  }

  function power(): Value {
    const base = primary()
    if (isOp('**')) {
      i++
      return num(base) ** num(unaryExpr())
    }
    return base
  }

  function list(close: string): Value[] {
    const items: Value[] = []
    while (!isOp(close)) {
      items.push(expr())
      if (!isOp(',')) break
      i++
    }
    expect(close)
    return items
  }

  function primary(): Value {
    const tok = peek()
    if (!tok) throw new ParseError('unexpected end of expression')
    i++

    if (tok.kind === 'num') return tok.value
    if (tok.kind === 'op' && tok.value === '(') {
      const v = expr()
      expect(')')
      return v
    }
    if (tok.kind === 'op' && tok.value === '[') return list(']')

    if (tok.kind === 'name') {
      // Read a dotted name: np.linalg.det → ['np', 'linalg', 'det']
      const parts = [tok.value]
      while (isOp('.')) {
        i++
        const next = peek()
        if (next?.kind !== 'name') throw new ParseError('expected a name after "."')
        parts.push(next.value)
        i++
      }
      const [module, member] = parts
      const isLib = parts.length === 2 && (module === 'np' || module === 'math')

      if (isOp('(')) {
        i++
        const args = list(')')
        const fn = isLib ? FUNCTIONS[member] : parts.length === 1 ? FUNCTIONS[module] : undefined
        if (!fn) throw new ParseError(`live sync doesn't know ${parts.join('.')}() (it still works when you press Run)`)
        return fn(args)
      }
      if (isLib && member in CONSTANTS) return CONSTANTS[member]
      if (parts.length === 1 && env.has(module)) return env.get(module)!
      throw new ParseError(`unknown name '${parts.join('.')}'`)
    }

    throw new ParseError(`unexpected '${tok.value}'`)
  }

  const result = expr()
  if (i < tokens.length) throw new ParseError(`unexpected '${tokens[i].value}'`)
  return result
}
