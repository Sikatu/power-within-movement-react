import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { AdminConfirmContext } from './AdminConfirmContext'

function normalizeRequest(options) {
  if (typeof options === 'string') {
    return {
      title: 'Confirm this action',
      message: options,
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      tone: 'warning',
    }
  }

  return {
    title: options?.title || 'Confirm this action',
    message: options?.message || 'Please confirm before continuing.',
    detail: options?.detail || '',
    confirmLabel: options?.confirmLabel || 'Continue',
    cancelLabel: options?.cancelLabel || 'Cancel',
    tone: options?.tone || 'warning',
  }
}

export default function AdminConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const resolverRef = useRef(null)
  const openerRef = useRef(null)
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)

  const settle = useCallback((confirmed) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    resolve?.(confirmed)

    window.requestAnimationFrame(() => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus()
      openerRef.current = null
    })
  }, [])

  const confirm = useCallback((options) => {
    if (resolverRef.current) resolverRef.current(false)

    openerRef.current = document.activeElement
    setRequest(normalizeRequest(options))

    return new Promise((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  useEffect(() => {
    if (!request) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        settle(false)
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )]

      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

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

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [request, settle])

  useEffect(() => () => {
    resolverRef.current?.(false)
    resolverRef.current = null
  }, [])

  const contextValue = useMemo(() => confirm, [confirm])

  return (
    <AdminConfirmContext.Provider value={contextValue}>
      {children}

      {request && createPortal(
        <div
          className="pwc-admin-confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) settle(false)
          }}
        >
          <section
            ref={dialogRef}
            className={`pwc-admin-confirm-dialog is-${request.tone}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pwc-admin-confirm-title"
            aria-describedby="pwc-admin-confirm-message"
            tabIndex={-1}
          >
            <span className="pwc-admin-confirm-mark" aria-hidden="true">
              {request.tone === 'danger' ? '!' : '✓'}
            </span>

            <div className="pwc-admin-confirm-copy">
              <p className="eyebrow">Private workspace confirmation</p>
              <h2 id="pwc-admin-confirm-title">{request.title}</h2>
              <p id="pwc-admin-confirm-message">{request.message}</p>
              {request.detail && <small>{request.detail}</small>}
            </div>

            <div className="pwc-admin-confirm-actions">
              <button
                ref={cancelButtonRef}
                className="pwc-admin-confirm-cancel"
                type="button"
                onClick={() => settle(false)}
              >
                {request.cancelLabel}
              </button>
              <button
                className="pwc-admin-confirm-submit"
                type="button"
                onClick={() => settle(true)}
              >
                {request.confirmLabel}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </AdminConfirmContext.Provider>
  )
}
