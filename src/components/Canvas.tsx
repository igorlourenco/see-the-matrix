/**
 * The picture. Pure SVG, recomputed from the store on every render.
 *
 * Nothing is stored here except view state (size, zoom, the current drag).
 * Every frame draws M = lerp(I, A, t): at t = 0 it's the untouched plane,
 * at t = 1 it's the full transformation.
 *
 * SVG instead of <canvas>: a few hundred elements is cheap, pointer events
 * come for free (handles are plain <circle>s), and it stays declarative React.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { fmt, snap } from '../lib/format'
import {
  add,
  apply,
  det,
  eigen,
  IDENTITY,
  inverse,
  lerpMatrix,
  matApprox,
  scale,
  type EigenPair,
  type Mat2,
  type Vec2,
} from '../lib/linalg'
import { useScene } from '../state/store'
import { usePalette, type Palette } from '../state/theme'

type Drag = { kind: 'basis'; which: 'i' | 'j' } | { kind: 'input'; id: string } | { kind: 'output'; id: string }

const snapVec = (v: Vec2): Vec2 => [snap(v[0]), snap(v[1])]

export function Canvas() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)

  const A = useScene((s) => s.A)
  const t = useScene((s) => s.t)
  const vectors = useScene((s) => s.vectors)
  const toggles = useScene((s) => s.toggles)
  const pal = usePalette()

  // Track the container size so the plane always fills the available space.
  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Wheel to zoom. Native listener because React's wheel listener is passive
  // and can't stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(4, Math.max(0.25, z * Math.exp(-e.deltaY * 0.0015))))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // ---- World ↔ screen ------------------------------------------------------
  // World: math coordinates, y points UP. Screen: SVG pixels, y points DOWN.
  const unit = (Math.min(size.w, size.h) / 14) * zoom // pixels per world unit
  const cx = size.w / 2
  const cy = size.h / 2
  const S = (v: Vec2): Vec2 => [cx + v[0] * unit, cy - v[1] * unit]
  const toWorld = (clientX: number, clientY: number): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect()
    return [(clientX - r.left - cx) / unit, (cy - (clientY - r.top)) / unit]
  }

  // ---- The matrix currently on screen ---------------------------------------
  const M = lerpMatrix(IDENTITY, A, t)
  const moved = !matApprox(M, IDENTITY)
  const halfExtent = Math.max(cx, cy) / unit // world units from center to the far edge

  // ---- Dragging --------------------------------------------------------------
  const startDrag = (d: Drag) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Capture on the <svg> so the drag continues even if the pointer leaves the handle.
    svgRef.current!.setPointerCapture(e.pointerId)
    dragRef.current = d
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const w = toWorld(e.clientX, e.clientY)
    const s = useScene.getState()
    if (d.kind === 'basis') {
      // Dragging î or ĵ edits a column of A directly.
      s.setBasisVector(d.which, snapVec(w), 'canvas')
    } else if (d.kind === 'input') {
      // The faded ghost IS the input vector.
      s.updateVector(d.id, snapVec(w), 'canvas')
    } else {
      // Dragging the transformed arrow asks: "which input lands HERE?"
      // That's M⁻¹ applied to the pointer, possible only if M is invertible.
      const inv = inverse(lerpMatrix(IDENTITY, s.A, s.t))
      if (inv) s.updateVector(d.id, snapVec(apply(inv, w)), 'canvas')
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  const origin = S([0, 0])

  // ---- Layers, bottom to top -------------------------------------------------
  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-paper">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className={`absolute inset-0 block select-none ${dragging ? 'cursor-grabbing' : ''}`}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="img"
        aria-label="Coordinate plane showing the transformation"
      >
        <defs>
          <Hatch id="hatch-pos" color={pal.detPos} angle={45} />
          <Hatch id="hatch-neg" color={pal.detNeg} angle={-45} />
        </defs>

        {toggles.originalGrid && <GraphPaper S={S} unit={unit} halfExtent={halfExtent} pal={pal} />}
        {toggles.detArea && <DetArea S={S} M={M} pal={pal} />}
        <TransformedGrid S={S} M={M} halfExtent={halfExtent} pal={pal} />
        {toggles.eigen && <EigenLines S={S} A={A} M={M} pal={pal} />}

        {/* Ghosts: where each vector started (only once the plane has moved). */}
        {moved &&
          vectors.map((v) => (
            <g key={`ghost-${v.id}`} opacity={0.45}>
              <Arrow from={origin} to={S(v.coords)} color={pal.vectors[v.colorIndex]} width={1.75} dashed />
              <Handle at={S(v.coords)} onPointerDown={startDrag({ kind: 'input', id: v.id })} />
            </g>
          ))}

        {toggles.linComb &&
          vectors.map((v) => (
            <g key={`lc-${v.id}`}>
              {moved && <LinComb S={S} M={IDENTITY} v={v.coords} pal={pal} opacity={0.35} />}
              <LinComb S={S} M={M} v={v.coords} pal={pal} opacity={0.95} />
            </g>
          ))}

        {/* Transformed vectors: A·v */}
        {vectors.map((v) => {
          const tip = S(apply(M, v.coords))
          const c = pal.vectors[v.colorIndex]
          return (
            <g key={v.id}>
              <Arrow from={origin} to={tip} color={c} width={2.5} />
              <Label at={tip} from={origin} color={c} halo={pal.paper}>
                <SvgVecName name={v.name} />
              </Label>
              <Handle at={tip} onPointerDown={startDrag({ kind: 'output', id: v.id })} />
            </g>
          )
        })}

        {/* Basis vectors on top: they're the main thing you drag. */}
        {(['i', 'j'] as const).map((which) => {
          const tip = S(M[which])
          const c = which === 'i' ? pal.ihat : pal.jhat
          return (
            <g key={which}>
              <Arrow from={origin} to={tip} color={c} width={3.25} />
              <Label at={tip} from={origin} color={c} halo={pal.paper} big>
                {which === 'i' ? 'î' : 'ĵ'}
              </Label>
              <Handle at={tip} onPointerDown={startDrag({ kind: 'basis', which })} />
            </g>
          )
        })}

        <circle cx={origin[0]} cy={origin[1]} r={3} fill={pal.ink} />
      </svg>

      {t < 1 && (
        <div className="pointer-events-none absolute top-3 left-3 rounded-[3px] border border-rule bg-panel px-2 py-1 font-mono text-xs text-ink-2">
          (1−t)·I + t·A, t = {t.toFixed(2)}
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex gap-1">
        <ZoomButton onClick={() => setZoom((z) => Math.min(4, z * 1.25))} label="Zoom in">
          <path d="M7 3v8M3 7h8" />
        </ZoomButton>
        <ZoomButton onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))} label="Zoom out">
          <path d="M3 7h8" />
        </ZoomButton>
        <ZoomButton onClick={() => setZoom(1)} label="Reset zoom">
          <path d="M3.5 7a3.5 3.5 0 1 0 1-2.5M3.5 2.5v2.5H6" />
        </ZoomButton>
      </div>
    </div>
  )
}

type ToScreen = (v: Vec2) => Vec2

// -----------------------------------------------------------------------------
// Grids
// -----------------------------------------------------------------------------

/**
 * The original, untouched grid, drawn as engineering paper: fine fifth-unit
 * lines, stronger unit lines, labeled axes. It's the reference to compare against.
 */
function GraphPaper({ S, unit, halfExtent, pal }: { S: ToScreen; unit: number; halfExtent: number; pal: Palette }) {
  const n = Math.ceil(halfExtent) + 1
  const fine = unit >= 40 ? 5 : unit >= 20 ? 2 : 1
  const labelEvery = unit >= 28 ? 1 : unit >= 12 ? 5 : 10
  const minor: ReactNode[] = []
  const major: ReactNode[] = []
  const labels: ReactNode[] = []

  for (let s = -n * fine; s <= n * fine; s++) {
    const k = s / fine
    const [x1, y1] = S([k, -n])
    const [x2, y2] = S([k, n])
    const [x3, y3] = S([-n, k])
    const [x4, y4] = S([n, k])
    const target = s % fine === 0 ? major : minor
    const stroke = s === 0 ? pal.gridAxis : s % fine === 0 ? pal.gridMajor : pal.gridFine
    target.push(
      <line key={`v${s}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1} />,
      <line key={`h${s}`} x1={x3} y1={y3} x2={x4} y2={y4} stroke={stroke} strokeWidth={1} />,
    )
  }
  for (let k = -n; k <= n; k++) {
    if (k === 0 || k % labelEvery !== 0) continue
    const [lx, ly] = S([k, 0])
    const [mx, my] = S([0, k])
    labels.push(
      <text key={`lx${k}`} x={lx} y={ly + 15} textAnchor="middle">
        {k}
      </text>,
      <text key={`ly${k}`} x={mx - 7} y={my + 3.5} textAnchor="end">
        {k}
      </text>,
    )
  }
  return (
    <g>
      {minor}
      {major}
      <g fill={pal.ink3} fontSize={10} className="font-mono">
        {labels}
      </g>
    </g>
  )
}

/**
 * The warped grid. A linear map sends straight lines to straight lines, so we
 * only transform each line's two endpoints.
 *
 * Grid line x = k is the set of points k·î + s·ĵ. After the map it's
 * k·(new î) + s·(new ĵ): still evenly spaced and parallel, which is exactly
 * what "linear" looks like.
 */
function TransformedGrid({ S, M, halfExtent, pal }: { S: ToScreen; M: Mat2; halfExtent: number; pal: Palette }) {
  // If M shrinks space, we need more lines to still cover the screen.
  // |det| / (largest stretch) estimates the smallest stretch factor.
  const largest = Math.hypot(M.i[0], M.i[1], M.j[0], M.j[1])
  const smallest = Math.abs(det(M)) / Math.max(largest, 1e-9)
  const reach = Math.min(120, Math.max(10, Math.ceil((halfExtent * 1.5) / Math.max(smallest, 0.01))))

  const lines: ReactNode[] = []
  for (let k = -reach; k <= reach; k++) {
    const axis = k === 0
    const props = { stroke: axis ? pal.warpAxis : pal.warp, strokeWidth: axis ? 1.5 : 1 }
    const [x1, y1] = S(apply(M, [k, -reach]))
    const [x2, y2] = S(apply(M, [k, reach]))
    const [x3, y3] = S(apply(M, [-reach, k]))
    const [x4, y4] = S(apply(M, [reach, k]))
    lines.push(<line key={`v${k}`} x1={x1} y1={y1} x2={x2} y2={y2} {...props} />)
    lines.push(<line key={`h${k}`} x1={x3} y1={y3} x2={x4} y2={y4} {...props} />)
  }
  return <g>{lines}</g>
}

// -----------------------------------------------------------------------------
// Overlays
// -----------------------------------------------------------------------------

function Hatch({ id, color, angle }: { id: string; color: string; angle: number }) {
  return (
    <pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
      <line x1={0} y1={0} x2={0} y2={6} stroke={color} strokeWidth={1.2} strokeOpacity={0.7} />
    </pattern>
  )
}

/**
 * The unit square (area 1) after the transformation: the parallelogram
 * spanned by the new î and ĵ, hatched like a pencil shading. Its area is |det|;
 * the hatching flips direction when det < 0.
 */
function DetArea({ S, M, pal }: { S: ToScreen; M: Mat2; pal: Palette }) {
  const D = det(M)
  const pts = [[0, 0] as Vec2, M.i, add(M.i, M.j), M.j].map(S)
  const center = S(scale(0.5, add(M.i, M.j)))
  const flipped = D < 0
  const color = flipped ? pal.detNeg : pal.detPos
  return (
    <g>
      <polygon
        points={pts.map((p) => p.join(',')).join(' ')}
        fill={`url(#${flipped ? 'hatch-neg' : 'hatch-pos'})`}
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      {Math.abs(D) > 0.15 && (
        <text
          x={center[0]}
          y={center[1] + 5}
          fill={color}
          stroke={pal.paper}
          strokeWidth={5}
          paintOrder="stroke"
          fontSize={15}
          textAnchor="middle"
          className="pointer-events-none font-mathrm"
        >
          {flipped ? `area ${fmt(D)} (flipped)` : `area ${fmt(D)}`}
        </text>
      )}
    </g>
  )
}

/**
 * Eigenvector lines: directions that stay on their own span.
 *
 * We draw A's eigenvectors at every animation frame. That's valid because
 * M(t) = (1−t)·I + t·A has the SAME eigenvectors as A:
 *   M(t)·u = (1−t)·u + t·λ·u = (1 − t + tλ)·u
 * So during the animation the arrow on each line only slides along it.
 */
function EigenLines({ S, A, M, pal }: { S: ToScreen; A: Mat2; M: Mat2; pal: Palette }) {
  const e = eigen(A)
  const pairs: EigenPair[] = e.kind === 'distinct' ? e.pairs : e.kind === 'repeated' ? [e.pair] : []
  const origin = S([0, 0])
  return (
    <g>
      {pairs.map(({ value, vector }, idx) => {
        const [x1, y1] = S(scale(-500, vector))
        const [x2, y2] = S(scale(500, vector))
        const tip = S(apply(M, vector))
        return (
          <g key={idx}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={pal.eigen} strokeWidth={1.25} strokeDasharray="7 5" />
            <Arrow from={origin} to={tip} color={pal.eigen} width={2.25} />
            <Label at={tip} from={origin} color={pal.eigen} halo={pal.paper} upright>
              <tspan className="font-math" fontStyle="italic">
                λ
              </tspan>
              {` = ${fmt(value)}`}
            </Label>
          </g>
        )
      })}
    </g>
  )
}

/** v drawn as x·î then y·ĵ, tip to tail: the meaning of coordinates. */
function LinComb({ S, M, v, pal, opacity }: { S: ToScreen; M: Mat2; v: Vec2; pal: Palette; opacity: number }) {
  const mid = scale(v[0], M.i)
  const end = add(mid, scale(v[1], M.j))
  return (
    <g opacity={opacity}>
      <Arrow from={S([0, 0])} to={S(mid)} color={pal.ihat} width={1.75} dashed />
      <Arrow from={S(mid)} to={S(end)} color={pal.jhat} width={1.75} dashed />
    </g>
  )
}

// -----------------------------------------------------------------------------
// Primitives (screen coordinates)
// -----------------------------------------------------------------------------

/** An inked arrow: round-capped shaft and a slim, slightly swept head. */
function Arrow({ from, to, color, width, dashed }: { from: Vec2; to: Vec2; color: string; width: number; dashed?: boolean }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy)
  if (len < 1) return null
  const ux = dx / len
  const uy = dy / len
  const head = Math.min(8 + width * 2.6, len * 0.6) // shrink the head for very short arrows
  const half = head * 0.42
  const bx = to[0] - ux * head
  const by = to[1] - uy * head
  const notchX = to[0] - ux * head * 0.78
  const notchY = to[1] - uy * head * 0.78
  return (
    <g>
      <line
        x1={from[0]}
        y1={from[1]}
        x2={notchX}
        y2={notchY}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? '5 5' : undefined}
      />
      <path
        d={`M${to[0]},${to[1]} L${bx - uy * half},${by + ux * half} L${notchX},${notchY} L${bx + uy * half},${by - ux * half} Z`}
        fill={color}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </g>
  )
}

/** Text just past the arrow's tip, with a paper-colored halo so it reads over the grid. */
function Label({
  at,
  from,
  color,
  halo,
  big,
  upright,
  children,
}: {
  at: Vec2
  from: Vec2
  color: string
  halo: string
  big?: boolean
  upright?: boolean
  children: ReactNode
}) {
  const dx = at[0] - from[0]
  const dy = at[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const off = big ? 18 : 20
  return (
    <text
      x={at[0] + (dx / len) * off}
      y={at[1] + (dy / len) * off + 5}
      fill={color}
      fontSize={big ? 22 : 19}
      fontStyle={upright ? 'normal' : 'italic'}
      textAnchor="middle"
      stroke={halo}
      strokeWidth={5}
      strokeLinejoin="round"
      paintOrder="stroke"
      className={`pointer-events-none ${upright ? 'font-mathrm' : 'font-math'}`}
    >
      {children}
    </text>
  )
}

/** v1 → v₁ inside SVG text: italic letters, smaller upright digits dropped below the baseline. */
function SvgVecName({ name }: { name: string }) {
  const m = /^([A-Za-z]+)_?(\d+)$/.exec(name)
  if (!m) return <>{name}</>
  return (
    <>
      {m[1]}
      <tspan className="font-mathrm" fontStyle="normal" fontSize="0.68em" dy="0.3em">
        {m[2]}
      </tspan>
    </>
  )
}

/** Invisible-until-hover grab target at an arrow tip. */
function Handle({ at, onPointerDown }: { at: Vec2; onPointerDown: (e: ReactPointerEvent) => void }) {
  return (
    <circle
      cx={at[0]}
      cy={at[1]}
      r={14}
      className="cursor-grab touch-none fill-ink/0 transition-colors hover:fill-ink/10"
      onPointerDown={onPointerDown}
    />
  )
}

function ZoomButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-[3px] border border-rule bg-panel text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
    >
      <svg viewBox="0 0 14 14" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}
