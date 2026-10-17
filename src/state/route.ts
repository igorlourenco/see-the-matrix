import { useSyncExternalStore } from 'react'

export type Route = 'app' | 'guide'

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const read = (): Route => (window.location.hash === '#guide' ? 'guide' : 'app')

export const useRoute = () => useSyncExternalStore(subscribe, read)
