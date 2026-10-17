import { useEffect } from 'react'
import { useScene } from './store'

const DURATION_MS = 1400
/** Per matrix in a chain: I → A, then B on top, then C, ... */
const STAGE_MS = 1300

/** Slow start, slow finish: the eye can follow the grid as it bends. */
const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)

/**
 * Drives `t` from 0 to 1 while `playing` is true. Mount once, in App.
 *
 * The store only holds `t`; every frame the canvas recomputes
 * M(t) = (1 − t)·I + t·A from it. Animation is just more derived state.
 */
export function useAnimation() {
  const playing = useScene((s) => s.playing)
  const playId = useScene((s) => s.playId)

  useEffect(() => {
    if (!playing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      useScene.setState({ t: 1, playing: false })
      return
    }

    // In compose mode the canvas eases each stage itself, so t stays linear here.
    const stages = 1 + useScene.getState().after.length
    const compose = stages > 1
    const duration = compose ? stages * STAGE_MS : DURATION_MS
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      // rAF timestamps the frame's start, which can be slightly before `start`; clamp so t never dips below 0.
      const p = Math.min(1, Math.max(0, (now - start) / duration))
      // setState directly (not the setT action), because setT also stops playback.
      useScene.setState({ t: compose ? p : easeInOutCubic(p) })
      if (p < 1) frame = requestAnimationFrame(tick)
      else useScene.setState({ playing: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [playing, playId])
}
