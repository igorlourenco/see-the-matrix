import { useEffect } from 'react'
import { useScene } from './store'

const DURATION_MS = 1400

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

    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - start) / DURATION_MS)
      // setState directly (not the setT action), because setT also stops playback.
      useScene.setState({ t: easeInOutCubic(p) })
      if (p < 1) frame = requestAnimationFrame(tick)
      else useScene.setState({ playing: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [playing, playId])
}
