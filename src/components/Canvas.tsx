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
import { I_COLOR, J_COLOR } from '../lib/tex'
import { useScene } from '../state/store'

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

  // ---- Layers, bottom to top -------------------------------------------------
  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
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
        {toggles.originalGrid && <BackgroundGrid S={S} unit={unit} halfExtent={halfExtent} />}
        {toggles.detArea && <DetArea S={S} M={M} />}
        <TransformedGrid S={S} M={M} halfExtent={halfExtent} />
        {toggles.eigen && <EigenLines S={S} A={A} M={M} />}

        {/* Ghosts: where each vector started (only once the plane has moved). */}
        {moved &&
          vectors.map((v) => (
            <g key={`ghost-${v.id}`} opacity={0.4}>
              <Arrow from={S([0, 0])} to={S(v.coords)} color={v.color} width={2} dashed />
              <Handle at={S(v.coords)} onPointerDown={startDrag({ kind: 'input', id: v.id })} />
            </g>
          ))}

        {toggles.linComb &&
          vectors.map((v) => (
            <g key={`lc-${v.id}`}>
              {moved && <LinComb S={S} M={IDENTITY} v={v.coords} opacity={0.3} />}
              <LinComb S={S} M={M} v={v.coords} opacity={0.9} />
            </g>
          ))}

        {/* Transformed vectors: A·v */}
        {vectors.map((v) => {
          const tip = S(apply(M, v.coords))
          return (
            <g key={v.id}>
              <Arrow from={S([0, 0])} to={tip} color={v.color} width={3} />
              <Label at={tip} from={S([0, 0])} color={v.color}>
                {v.name}
              </Label>
              <Handle at={tip} onPointerDown={startDrag({ kind: 'output', id: v.id })} />
            </g>
          )
        })}

        {/* Basis vectors on top: they're the main thing you drag. */}
        {(['i', 'j'] as const).map((which) => {
          const tip = S(M[which])
          const color = which === 'i' ? I_COLOR : J_COLOR
          return (
            <g key={which}>
              <Arrow from={S([0, 0])} to={tip} color={color} width={4} />
              <Label at={tip} from={S([0, 0])} color={color} big>
                {which === 'i' ? 'î' : 'ĵ'}
              </Label>
              <Handle at={tip} onPointerDown={startDrag({ kind: 'basis', which })} />
            </g>
          )
        })}

        <circle cx={cx} cy={cy} r={3.5} fill="#e5e7eb" />
      </svg>

      {t < 1 && (
        <div className="pointer-events-none absolute top-3 left-3 rounded bg-black/50 px-2 py-1 font-mono text-xs text-slate-300">
          showing (1−t)·I + t·A, t = {t.toFixed(2)}
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex gap-1">
        <ZoomButton onClick={() => setZoom((z) => Math.min(4, z * 1.25))} label="Zoom in">+</ZoomButton>
        <ZoomButton onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))} label="Zoom out">−</ZoomButton>
        <ZoomButton onClick={() => setZoom(1)} label="Reset zoom">⟲</ZoomButton>
      </div>
    </div>
  )
}

type ToScreen = (v: Vec2) => Vec2

// -----------------------------------------------------------------------------
// Grids
// -----------------------------------------------------------------------------

/** The original, untouched grid: the reference to compare against. */
function BackgroundGrid({ S, unit, halfExtent }: { S: ToScreen; unit: number; halfExtent: number }) {
  const n = Math.ceil(halfExtent) + 1
  const labelEvery = unit >= 28 ? 1 : unit >= 12 ? 5 : 10
  const lines: ReactNode[] = []
  for (let k = -n; k <= n; k++) {
    const [x1, y1] = S([k, -n])
    const [x2, y2] = S([k, n])
    const [x3, y3] = S([-n, k])
    const [x4, y4] = S([n, k])
    const stroke = k === 0 ? '#4b5263' : '#1f2430'
    lines.push(<line key={`v${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1} />)
    lines.push(<line key={`h${k}`} x1={x3} y1={y3} x2={x4} y2={y4} stroke={stroke} strokeWidth={1} />)
    if (k !== 0 && k % labelEvery === 0) {
      const [lx, ly] = S([k, 0])
      const [mx, my] = S([0, k])
      lines.push(
        <text key={`lx${k}`} x={lx} y={ly + 14} fill="#4b5263" fontSize={10} textAnchor="middle">
          {k}
        </text>,
        <text key={`ly${k}`} x={mx - 6} y={my + 3} fill="#4b5263" fontSize={10} textAnchor="end">
          {k}
        </text>,
      )
    }
  }
  return <g>{lines}</g>
}

/**
 * The warped grid. A linear map sends straight lines to straight lines, so we
 * only transform each line's two endpoints.
 *
 * Grid line x = k is the set of points k·î + s·ĵ. After the map it's
 * k·(new î) + s·(new ĵ): still evenly spaced and parallel, which is exactly
 * what "linear" looks like.
 */
function TransformedGrid({ S, M, halfExtent }: { S: ToScreen; M: Mat2; halfExtent: number }) {
  // If M shrinks space, we need more lines to still cover the screen.
  // |det| / (largest stretch) estimates the smallest stretch factor.
  const largest = Math.hypot(M.i[0], M.i[1], M.j[0], M.j[1])
  const smallest = Math.abs(det(M)) / Math.max(largest, 1e-9)
  const reach = Math.min(120, Math.max(10, Math.ceil((halfExtent * 1.5) / Math.max(smallest, 0.01))))

  const lines: ReactNode[] = []
  for (let k = -reach; k <= reach; k++) {
    const axis = k === 0
    const props = { stroke: axis ? '#c9d1e3' : '#3d6fb4', strokeWidth: axis ? 1.6 : 1, strokeOpacity: axis ? 0.9 : 0.55 }
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

/**
 * The unit square (area 1) after the transformation: the parallelogram
 * spanned by the new î and ĵ. Its area is |det|.
 */
function DetArea({ S, M }: { S: ToScreen; M: Mat2 }) {
  const D = det(M)
  const pts = [[0, 0] as Vec2, M.i, add(M.i, M.j), M.j].map(S)
  const center = S(scale(0.5, add(M.i, M.j)))
  const flipped = D < 0
  return (
    <g>
      <polygon
        points={pts.map((p) => p.join(',')).join(' ')}
        fill={flipped ? '#ff862f' : '#f4d345'}
        fillOpacity={0.16}
        stroke={flipped ? '#ff862f' : '#f4d345'}
        strokeOpacity={0.5}
      />
      {Math.abs(D) > 0.15 && (
        <text
          x={center[0]}
          y={center[1] + 4}
          fill={flipped ? '#ffb27a' : '#f8e38a'}
          fontSize={12}
          textAnchor="middle"
          className="font-mono"
        >
          {`area ${fmt(D)}`}
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
function EigenLines({ S, A, M }: { S: ToScreen; A: Mat2; M: Mat2 }) {
  const e = eigen(A)
  const pairs: EigenPair[] = e.kind === 'distinct' ? e.pairs : e.kind === 'repeated' ? [e.pair] : []
  return (
    <g>
      {pairs.map(({ value, vector }, idx) => {
        const [x1, y1] = S(scale(-500, vector))
        const [x2, y2] = S(scale(500, vector))
        const tip = S(apply(M, vector))
        return (
          <g key={idx}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e879f9" strokeWidth={1.5} strokeDasharray="6 5" opacity={0.6} />
            <Arrow from={S([0, 0])} to={tip} color="#e879f9" width={2.5} />
            <Label at={tip} from={S([0, 0])} color="#e879f9">
              {`λ=${fmt(value)}`}
            </Label>
          </g>
        )
      })}
    </g>
  )
}

/** v drawn as x·î then y·ĵ, tip to tail: the meaning of coordinates. */
function LinComb({ S, M, v, opacity }: { S: ToScreen; M: Mat2; v: Vec2; opacity: number }) {
  const mid = scale(v[0], M.i)
  const end = add(mid, scale(v[1], M.j))
  return (
    <g opacity={opacity}>
      <Arrow from={S([0, 0])} to={S(mid)} color={I_COLOR} width={2} dashed />
      <Arrow from={S(mid)} to={S(end)} color={J_COLOR} width={2} dashed />
    </g>
  )
}

// -----------------------------------------------------------------------------
// Primitives (screen coordinates)
// -----------------------------------------------------------------------------

function Arrow({ from, to, color, width, dashed }: { from: Vec2; to: Vec2; color: string; width: number; dashed?: boolean }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy)
  if (len < 1) return null
  const ux = dx / len
  const uy = dy / len
  const head = Math.min(6 + width * 2.5, len * 0.6) // shrink the head for very short arrows
  const half = head * 0.55
  const bx = to[0] - ux * head // base of the arrowhead
  const by = to[1] - uy * head
  return (
    <g>
      <line
        x1={from[0]}
        y1={from[1]}
        x2={bx}
        y2={by}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? '5 4' : undefined}
      />
      <polygon
        points={`${to[0]},${to[1]} ${bx - uy * half},${by + ux * half} ${bx + uy * half},${by - ux * half}`}
        fill={color}
      />
    </g>
  )
}

/** Text just past the arrow's tip, with a dark outline so it reads over the grid. */
function Label({ at, from, color, big, children }: { at: Vec2; from: Vec2; color: string; big?: boolean; children: ReactNode }) {
  const dx = at[0] - from[0]
  const dy = at[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const off = big ? 18 : 16
  return (
    <text
      x={at[0] + (dx / len) * off}
      y={at[1] + (dy / len) * off + 5}
      fill={color}
      fontSize={big ? 18 : 13}
      fontWeight={600}
      textAnchor="middle"
      stroke="#0e1015"
      strokeWidth={4}
      paintOrder="stroke"
      className="pointer-events-none"
    >
      {children}
    </text>
  )
}

/** Invisible-until-hover grab target at an arrow tip. */
function Handle({ at, onPointerDown }: { at: Vec2; onPointerDown: (e: ReactPointerEvent) => void }) {
  return (
    <circle
      cx={at[0]}
      cy={at[1]}
      r={13}
      className="cursor-grab touch-none fill-white/0 transition-colors hover:fill-white/15"
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
      className="size-8 rounded-md border border-line bg-panel/90 text-slate-300 hover:bg-slate-700"
    >
      {children}
    </button>
  )
}
