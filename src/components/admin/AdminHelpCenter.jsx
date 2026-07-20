import { useEffect, useRef } from 'react'

import { acquireAdminScrollLock } from './adminScrollLock.js'
import { adminPageGuidance } from './adminPageGuidance.js'

function visibleFocusableElements(container) {
  if (!container) return []

  return Array.from(container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getClientRects().length > 0)
}

function AdminHelpCenter({
  currentPath,
  pageDescription,
  pageLabel,
  workspaceLabel,
  onClose,
  onOpenQuickFind,
}) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const previousFocusRef = useRef(null)
  const guide = adminPageGuidance(currentPath)

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const releaseScrollLock = acquireAdminScrollLock()
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(focusFrame)
      releaseScrollLock()
      window.setTimeout(() => previousFocusRef.current?.focus?.(), 0)
    }
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = visibleFocusableElements(dialogRef.current)
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
    <div className="pwc-help51-layer" role="presentation">
      <button
        className="pwc-help51-backdrop"
        type="button"
        aria-label="Close page guide"
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        className="pwc-help51-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwc-help51-title"
        aria-describedby="pwc-help51-description"
        onKeyDown={handleKeyDown}
      >
        <header className="pwc-help51-header">
          <span aria-hidden="true">?</span>
          <div>
            <small>{workspaceLabel} · page guide</small>
            <h2 id="pwc-help51-title">{pageLabel}</h2>
          </div>
          <button ref={closeRef} type="button" aria-label="Close page guide" onClick={onClose}>×</button>
        </header>

        <p className="pwc-help51-description" id="pwc-help51-description">
          {pageDescription || 'Use this workspace to complete one clear administrative task at a time.'}
        </p>

        <section className="pwc-help51-steps" aria-labelledby="pwc-help51-steps-title">
          <div>
            <small>Simple workflow</small>
            <h3 id="pwc-help51-steps-title">Start here</h3>
          </div>
          <ol>
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>

        <aside className="pwc-help51-safety">
          <strong>Before you save</strong>
          <p>{guide.safety}</p>
        </aside>

        <footer className="pwc-help51-footer">
          <p><kbd>Ctrl K</kbd> opens Quick Find from anywhere. Press <kbd>?</kbd> to reopen this guide.</p>
          <div>
            <button type="button" className="is-secondary" onClick={onOpenQuickFind}>Open Quick Find</button>
            <button type="button" onClick={onClose}>Continue working</button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export default AdminHelpCenter
