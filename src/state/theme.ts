import { useMemo } from 'react'
import { create } from 'zustand'
import { VECTOR_COLOR_COUNT } from './store'

export type ThemeMode = 'system' | 'light' | 'dark'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'stm-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

const resolve = (mode: ThemeMode): Resolved => (mode === 'system' ? (media.matches ? 'dark' : 'light') : mode)

function applyToDocument(resolved: Resolved) {
  document.documentElement.dataset.theme = resolved
}

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

const initialMode = readStoredMode()
applyToDocument(resolve(initialMode))

export const useTheme = create<{ mode: ThemeMode; resolved: Resolved; setMode: (mode: ThemeMode) => void }>()((set) => ({
  mode: initialMode,
  resolved: resolve(initialMode),
  setMode: (mode) => {
    const resolved = resolve(mode)
    applyToDocument(resolved)
    if (mode === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, mode)
    set({ mode, resolved })
  },
}))

media.addEventListener('change', () => {
  const { mode } = useTheme.getState()
  if (mode !== 'system') return
  const resolved = resolve(mode)
  applyToDocument(resolved)
  useTheme.setState({ resolved })
})

export interface Palette {
  paper: string
  ink: string
  ink2: string
  ink3: string
  gridFine: string
  gridMajor: string
  gridAxis: string
  warp: string
  warpAxis: string
  ihat: string
  jhat: string
  eigen: string
  detPos: string
  detNeg: string
  vectors: string[]
}

/**
 * SVG and KaTeX need concrete color strings, not CSS variables, so the
 * palette is read from the active theme's custom properties.
 */
export function usePalette(): Palette {
  const resolved = useTheme((s) => s.resolved)
  return useMemo(() => {
    void resolved
    const style = getComputedStyle(document.documentElement)
    const v = (name: string) => style.getPropertyValue(`--${name}`).trim()
    return {
      paper: v('paper'),
      ink: v('ink'),
      ink2: v('ink-2'),
      ink3: v('ink-3'),
      gridFine: v('grid-fine'),
      gridMajor: v('grid-major'),
      gridAxis: v('grid-axis'),
      warp: v('warp'),
      warpAxis: v('warp-axis'),
      ihat: v('ihat'),
      jhat: v('jhat'),
      eigen: v('eigen'),
      detPos: v('det-pos'),
      detNeg: v('det-neg'),
      vectors: Array.from({ length: VECTOR_COLOR_COUNT }, (_, k) => v(`vec-${k + 1}`)),
    }
  }, [resolved])
}

const hexCache = new Map<string, string>()
let ctx: CanvasRenderingContext2D | null = null

/** KaTeX's \textcolor only accepts hex, so convert any CSS color (e.g. oklch). */
export function toHex(css: string): string {
  const cached = hexCache.get(css)
  if (cached) return cached
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#888888'
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
  hexCache.set(css, hex)
  return hex
}
