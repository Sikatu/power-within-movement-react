import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  readRecentDestinations,
  rememberAdminDestination,
} from './adminRecentDestinations.js'

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function matchesQuery(item, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true

  const haystack = normalize([
    item.label,
    item.groupLabel,
    item.description,
    ...(item.keywords || []),
  ].join(' '))

  return terms.every((term) => haystack.includes(term))
}

function CommandIcon({ name }) {
  if (name === 'clients') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 11a3 3 0 1 0 0-6M21 20v-2a4 4 0 0 0-3-3.87" />
      </svg>
    )
  }

  if (name === 'sessions') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3v3M19 3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 13h3M8 17h6" />
      </svg>
    )
  }

  if (name === 'inbox') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zM4 7l8 6 8-6" />
      </svg>
    )
  }

  if (name === 'workspace') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zM8 9h8M8 13h5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  )
}

function AdminCommandPalette({
  currentPath,
  items,
  onClose,
  onNavigate,
  onWarmRoute,
}) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const previousFocusRef = useRef(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentPaths] = useState(readRecentDestinations)

  const uniqueItems = useMemo(() => {
    const deduped = new Map()

    items.forEach((item) => {
      if (!deduped.has(item.to)) deduped.set(item.to, item)
    })

    return Array.from(deduped.values())
  }, [items])

  const visibleItems = useMemo(() => {
    const normalizedQuery = normalize(query)

    if (normalizedQuery) {
      return uniqueItems.filter((item) => matchesQuery(item, normalizedQuery))
    }

    const recentItems = recentPaths
      .map((path) => uniqueItems.find((item) => item.to === path))
      .filter(Boolean)

    const suggestedItems = uniqueItems.filter(
      (item) => !recentItems.some((recentItem) => recentItem.to === item.to),
    )

    return [...recentItems, ...suggestedItems].slice(0, 9)
  }, [query, recentPaths, uniqueItems])

  useEffect(() => {
    previousFocusRef.current = document.activeElement

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.setTimeout(() => previousFocusRef.current?.focus?.(), 0)
    }
  }, [])

  useEffect(() => {
    const activeItem = visibleItems[activeIndex]
    if (activeItem) onWarmRoute(activeItem.to)
  }, [activeIndex, onWarmRoute, visibleItems])

  function chooseItem(item) {
    rememberAdminDestination(item.to)
    onNavigate(item.to)
  }

  function handleDialogKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    const navigationTarget = event.target === inputRef.current
      || event.target.closest?.('.pwc-command11-option')

    if (navigationTarget && event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (
        visibleItems.length ? (current + 1) % visibleItems.length : 0
      ))
      return
    }

    if (navigationTarget && event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (
        visibleItems.length
          ? (current - 1 + visibleItems.length) % visibleItems.length
          : 0
      ))
      return
    }

    if (navigationTarget && event.key === 'Enter' && visibleItems[activeIndex]) {
      event.preventDefault()
      chooseItem(visibleItems[activeIndex])
      return
    }

    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = Array.from(dialogRef.current.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0)

    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable.at(-1)

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="pwc-command11-layer" role="presentation">
      <button
        className="pwc-command11-backdrop"
        type="button"
        aria-label="Close Quick Find"
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        className="pwc-command11-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwc-command11-title"
        aria-describedby="pwc-command11-description"
        onKeyDown={handleDialogKeyDown}
      >
        <header className="pwc-command11-header">
          <span className="pwc-command11-mark" aria-hidden="true">⌘</span>
          <span>
            <small>Studio command center</small>
            <strong id="pwc-command11-title">Quick Find</strong>
          </span>
          <button
            className="pwc-command11-close"
            type="button"
            aria-label="Close Quick Find"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p className="sr-only" id="pwc-command11-description">
          Search accessible Studio destinations. Use the arrow keys to move and Enter to open a destination.
        </p>

        <label className="pwc-command11-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <span className="sr-only">Search Studio destinations</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Search clients, sessions, letters, system…"
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="pwc-command11-results"
            aria-activedescendant={visibleItems[activeIndex] ? `pwc-command11-option-${activeIndex}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
          />
          <kbd>Esc</kbd>
        </label>

        <div className="pwc-command11-summary" aria-live="polite">
          <span>{query.trim() ? 'Search results' : recentPaths.length ? 'Recent and suggested' : 'Suggested destinations'}</span>
          <small>{visibleItems.length} available</small>
        </div>

        <div
          className="pwc-command11-results"
          id="pwc-command11-results"
          role="listbox"
          aria-label="Studio destinations"
        >
          {visibleItems.length ? visibleItems.map((item, index) => {
            const selected = index === activeIndex
            const current = item.to === currentPath

            return (
              <button
                className={`pwc-command11-option${selected ? ' is-selected' : ''}${current ? ' is-current' : ''}`}
                id={`pwc-command11-option-${index}`}
                key={item.to}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => {
                  setActiveIndex(index)
                  onWarmRoute(item.to)
                }}
                onFocus={() => {
                  setActiveIndex(index)
                  onWarmRoute(item.to)
                }}
                onClick={() => chooseItem(item)}
              >
                <span className="pwc-command11-icon" aria-hidden="true">
                  <CommandIcon name={item.icon} />
                </span>
                <span className="pwc-command11-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description || item.groupLabel}</small>
                </span>
                <span className="pwc-command11-meta">
                  {current ? <em>Current</em> : <small>{item.groupLabel}</small>}
                  <span aria-hidden="true">↵</span>
                </span>
              </button>
            )
          }) : (
            <div className="pwc-command11-empty" role="status">
              <span aria-hidden="true">⌕</span>
              <strong>No destination found</strong>
              <p>Try a broader term such as “client,” “session,” “letter,” or “founder.”</p>
            </div>
          )}
        </div>

        <footer className="pwc-command11-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </section>
    </div>
  )
}

export default AdminCommandPalette
