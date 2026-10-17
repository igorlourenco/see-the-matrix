import { useEffect, useRef, type ReactNode } from 'react'
import { useLayout, type PaneId } from '../state/layout'

/**
 * A panel with a title bar and a maximize button.
 *
 * Maximizing restyles this same element as a fixed overlay instead of
 * rendering a copy in a modal, so local state (the code editor's text,
 * Python output, scroll position) survives and live sync keeps working.
 */
export function Pane({
  id,
  title,
  actions,
  className = '',
  bodyClassName = '',
  readable = false,
  footer,
  children,
}: {
  id: PaneId
  title: string
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  readable?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  const maximized = useLayout((s) => s.maximized === id)
  const setMaximized = useLayout((s) => s.setMaximized)
  const paneRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!maximized) return
    paneRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaximized(null)
    }
    window.addEventListener('keydown', onKey)
    const toggle = toggleRef.current
    return () => {
      window.removeEventListener('keydown', onKey)
      toggle?.focus()
    }
  }, [maximized, setMaximized])

  return (
    <>
      <section
        ref={paneRef}
        tabIndex={-1}
        role={maximized ? 'dialog' : 'region'}
        aria-modal={maximized || undefined}
        aria-label={title}
        className={
          maximized
            ? 'fixed inset-3 z-50 flex flex-col overflow-hidden rounded-[4px] border border-rule bg-panel shadow-[0_24px_64px_-16px_oklch(0_0_0/0.45)] outline-none md:inset-x-[max(1.5rem,6vw)] md:inset-y-[max(1.5rem,5vh)]'
            : `flex min-h-0 flex-col bg-panel outline-none ${className}`
        }
      >
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-rule px-5">
          <h2 className="text-[13px] font-semibold text-ink-2">{title}</h2>
          {actions}
          <button
            ref={toggleRef}
            onClick={() => setMaximized(maximized ? null : id)}
            aria-label={maximized ? `Restore ${title}` : `Maximize ${title}`}
            title={maximized ? 'Restore (Esc)' : 'Maximize'}
            className={`grid size-7 shrink-0 place-items-center rounded-[3px] text-ink-3 transition-colors hover:bg-sunken hover:text-ink ${actions ? '' : 'ml-auto'}`}
          >
            <svg viewBox="0 0 14 14" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {maximized ? (
                <path d="M5.5 1.5v4h-4M8.5 1.5v4h4M5.5 12.5v-4h-4M8.5 12.5v-4h4" />
              ) : (
                <path d="M1.5 5V1.5H5M9 1.5h3.5V5M1.5 9v3.5H5M9 12.5h3.5V9" />
              )}
            </svg>
          </button>
        </header>
        <div className={`min-h-0 flex-1 ${bodyClassName}`}>
          <div className={readable ? (maximized ? 'mx-auto w-full max-w-[880px]' : '') : 'flex h-full min-h-0 flex-col'}>{children}</div>
        </div>
        {footer && <footer className="shrink-0 border-t border-rule px-5 py-3">{footer}</footer>}
      </section>
      {maximized && (
        <div className="fixed inset-0 z-40 bg-[oklch(0.15_0.01_85/0.55)]" onClick={() => setMaximized(null)} aria-hidden />
      )}
    </>
  )
}
