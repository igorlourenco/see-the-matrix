/**
 * The single source of truth.
 *
 * The whole scene is just:
 *   - A: where î and ĵ land (the matrix, stored as columns)
 *   - vectors: a list of input vectors
 * plus a little UI state (animation progress, toggles).
 *
 * The canvas, math panel and code panel never talk to each other. Each one
 * reads from here and writes back through the actions below:
 *
 *            ┌──────── store ────────┐
 *   inputs ─▶│  A, vectors, toggles  │──▶ canvas  (drag  ─▶ action)
 *   presets ▶│                       │──▶ math    (read-only)
 *            └───────────────────────┘──▶ code    (edit ─▶ parse ─▶ action)
 *
 * `lastSource` records who made the latest edit, so the code panel knows not
 * to overwrite the text the user is typing with freshly generated code.
 */
import { create } from 'zustand'
import { MAX_AFTER } from '../lib/chain'
import { chainProduct, IDENTITY, type Mat2, type Vec2 } from '../lib/linalg'
import type { ParsedScene } from '../lib/parser'
import { PRESETS } from '../lib/presets'

export type EditSource = 'init' | 'inputs' | 'canvas' | 'code' | 'preset'

export interface VectorItem {
  id: string
  name: string
  /** Coordinates in the ORIGINAL basis: "how much î, how much ĵ". */
  coords: Vec2
  /** Slot in the theme's vector palette (--vec-1 … --vec-6). */
  colorIndex: number
}

export interface Toggles {
  /** The untouched reference grid behind the warped one. Off = see only the transformed space. */
  originalGrid: boolean
  linComb: boolean
  detArea: boolean
  eigen: boolean
  inverse: boolean
  type: boolean
}

interface SceneState {
  A: Mat2
  /** Matrices applied after A, in order: B, C, D, ... Empty = no composition. */
  after: Mat2[]
  vectors: VectorItem[]
  /** Animation progress: the canvas draws lerp(I, A, t). 1 = fully transformed. */
  t: number
  playing: boolean
  /** Bumped on every replay, so replaying mid-animation restarts it. */
  playId: number
  toggles: Toggles
  lastSource: EditSource
}

interface Actions {
  setBasisVector: (which: 'i' | 'j', v: Vec2, source: EditSource) => void
  applyPreset: (id: string) => void
  addVector: (coords: Vec2) => void
  updateVector: (id: string, coords: Vec2, source: EditSource) => void
  removeVector: (id: string) => void
  syncFromCode: (scene: ParsedScene) => void
  addAfter: () => void
  removeAfter: (index: number) => void
  setAfterVector: (index: number, which: 'i' | 'j', v: Vec2) => void
  applyAfterPreset: (index: number, id: string) => void
  reverseChain: () => void
  replay: () => void
  setT: (t: number) => void
  setPlaying: (playing: boolean) => void
  toggle: (key: keyof Toggles) => void
}

export const VECTOR_COLOR_COUNT = 6

/** The whole chain in application order: [A, B, C, ...]. */
export const chainOf = (A: Mat2, after: readonly Mat2[]): Mat2[] => [A, ...after]

/** The transformation on screen: A alone, or "A, then B, then C" = C·B·A. */
export const totalMatrix = (A: Mat2, after: readonly Mat2[]): Mat2 => chainProduct(chainOf(A, after))

/** Matrices offered when adding a step, so each new one looks different from the last. */
const AFTER_DEFAULTS = ['rotate90', 'shear', 'scale', 'reflect', 'stretch']

let nextId = 1
const newId = () => `vec-${nextId++}`

/** First palette color not already used, so vectors stay distinguishable. */
function pickColor(taken: readonly VectorItem[]): number {
  const used = new Set(taken.map((v) => v.colorIndex))
  for (let k = 0; k < VECTOR_COLOR_COUNT; k++) if (!used.has(k)) return k
  return taken.length % VECTOR_COLOR_COUNT
}

/** v1, v2, ... skipping names in use. Names must be valid Python identifiers. */
function nextName(vectors: readonly VectorItem[]): string {
  const used = new Set(vectors.map((v) => v.name))
  let n = 1
  while (used.has(`v${n}`)) n++
  return `v${n}`
}

const initialVectors: VectorItem[] = [
  { id: newId(), name: 'v1', coords: [2, 3], colorIndex: 0 },
  { id: newId(), name: 'v2', coords: [-2, 1], colorIndex: 1 },
]

export const useScene = create<SceneState & Actions>()((set) => ({
  A: IDENTITY,
  after: [],
  vectors: initialVectors,
  t: 1,
  playing: false,
  playId: 0,
  toggles: { originalGrid: true, linComb: false, detArea: true, eigen: false, inverse: false, type: true },
  lastSource: 'init',

  // Direct edits (typing, dragging) show the result immediately. The replay
  // button animates from the identity on demand.
  setBasisVector: (which, v, source) =>
    set((s) => ({ A: { ...s.A, [which]: v }, t: 1, playing: false, lastSource: source })),

  // Presets animate from the identity, so you see the plane morph.
  applyPreset: (id) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (preset) set((s) => ({ A: preset.matrix, t: 0, playing: true, playId: s.playId + 1, lastSource: 'preset' }))
  },

  addVector: (coords) =>
    set((s) => ({
      vectors: [...s.vectors, { id: newId(), name: nextName(s.vectors), coords, colorIndex: pickColor(s.vectors) }],
      lastSource: 'inputs',
    })),

  updateVector: (id, coords, source) =>
    set((s) => ({
      vectors: s.vectors.map((v) => (v.id === id ? { ...v, coords } : v)),
      lastSource: source,
    })),

  removeVector: (id) => set((s) => ({ vectors: s.vectors.filter((v) => v.id !== id), lastSource: 'inputs' })),

  // Vectors are matched by NAME, so editing `v1 = ...` in code keeps v1's
  // color and identity instead of creating a new arrow.
  syncFromCode: ({ basis, after, vectors }) =>
    set((s) => {
      const kept = s.vectors.filter((v) => vectors.some((p) => p.name === v.name))
      const next: VectorItem[] = []
      for (const { name, coords } of vectors) {
        const existing = kept.find((v) => v.name === name)
        next.push(existing ? { ...existing, coords } : { id: newId(), name, coords, colorIndex: pickColor([...kept, ...next]) })
      }
      return {
        A: { i: basis.i ?? s.A.i, j: basis.j ?? s.A.j },
        after,
        vectors: next,
        t: 1,
        playing: false,
        lastSource: 'code',
      }
    }),

  // Chain changes replay the whole story, I → A → B → ..., so you see the new step in context.
  addAfter: () =>
    set((s) => {
      if (s.after.length >= MAX_AFTER) return {}
      const preset = PRESETS.find((p) => p.id === AFTER_DEFAULTS[s.after.length % AFTER_DEFAULTS.length])!
      return { after: [...s.after, preset.matrix], t: 0, playing: true, playId: s.playId + 1, lastSource: 'inputs' }
    }),
  removeAfter: (index) => set((s) => ({ after: s.after.filter((_, k) => k !== index), t: 1, playing: false, lastSource: 'inputs' })),
  setAfterVector: (index, which, v) =>
    set((s) => ({
      after: s.after.map((M, k) => (k === index ? { ...M, [which]: v } : M)),
      t: 1,
      playing: false,
      lastSource: 'inputs',
    })),
  applyAfterPreset: (index, id) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    set((s) => ({
      after: s.after.map((M, k) => (k === index ? preset.matrix : M)),
      t: 0,
      playing: true,
      playId: s.playId + 1,
      lastSource: 'preset',
    }))
  },
  // Same matrices, opposite order: usually a different result. Order matters.
  reverseChain: () =>
    set((s) => {
      const [first, ...rest] = [...chainOf(s.A, s.after)].reverse()
      return { A: first, after: rest, t: 0, playing: true, playId: s.playId + 1, lastSource: 'inputs' }
    }),

  replay: () => set((s) => ({ t: 0, playing: true, playId: s.playId + 1 })),
  setT: (t) => set({ t, playing: false }),
  setPlaying: (playing) => set({ playing }),
  toggle: (key) => set((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] }, lastSource: 'inputs' })),
}))
