export function Credits({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3 ${className}`}>
      <span>Built by Igor Lourenço</span>
      <span className="flex items-center gap-3">
        <a
          href="https://x.com/igordevx"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
            <path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8zm-1.1 18.1h1.7L6.3 3.8H4.5z" />
          </svg>
          @igordevx
        </a>
        <a
          href="https://github.com/igorlourenco"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
            <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
          </svg>
          igorlourenco
        </a>
      </span>
    </div>
  )
}
