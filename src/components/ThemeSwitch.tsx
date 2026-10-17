import type { ReactNode } from 'react'
import { useTheme, type ThemeMode } from '../state/theme'

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: ReactNode }[] = [
  {
    mode: 'system',
    label: 'Match system',
    icon: (
      <>
        <rect x="1.5" y="2.5" width="11" height="7.5" rx="1" />
        <path d="M5 12.5h4" />
      </>
    ),
  },
  {
    mode: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="7" cy="7" r="2.5" />
        <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1" />
      </>
    ),
  },
  { mode: 'dark', label: 'Dark', icon: <path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" /> },
]

export function ThemeSwitch() {
  const mode = useTheme((s) => s.mode)
  const setMode = useTheme((s) => s.setMode)
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-[3px] border border-rule p-0.5">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.mode}
          role="radio"
          aria-checked={mode === o.mode}
          aria-label={o.label}
          title={o.label}
          onClick={() => setMode(o.mode)}
          className="grid size-7 place-items-center rounded-[2px] text-ink-3 transition-colors hover:text-ink aria-checked:bg-ink aria-checked:text-paper"
        >
          <svg viewBox="0 0 14 14" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  )
}
