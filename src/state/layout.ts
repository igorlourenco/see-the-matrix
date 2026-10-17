import { create } from 'zustand'

export type PaneId = 'inputs' | 'math' | 'code'

interface LayoutState {
  leftOpen: boolean
  rightOpen: boolean
  maximized: PaneId | null
  toggleLeft: () => void
  toggleRight: () => void
  setMaximized: (pane: PaneId | null) => void
}

const STORAGE_KEY = 'stm-layout'

function readStored(): Pick<LayoutState, 'leftOpen' | 'rightOpen'> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return { leftOpen: parsed.leftOpen !== false, rightOpen: parsed.rightOpen !== false }
  } catch {
    return { leftOpen: true, rightOpen: true }
  }
}

export const useLayout = create<LayoutState>()((set) => ({
  ...readStored(),
  maximized: null,
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen, maximized: null })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen, maximized: null })),
  setMaximized: (maximized) => set({ maximized }),
}))

useLayout.subscribe(({ leftOpen, rightOpen }) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ leftOpen, rightOpen }))
})
