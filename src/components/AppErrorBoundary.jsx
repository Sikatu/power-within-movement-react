import React from 'react'
import { reportClientError } from '../lib/errorReporter'
import './AppErrorBoundary.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorId: null }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    const errorId = `PWC-${Date.now().toString(36).toUpperCase()}`
    this.setState({ errorId })

    reportClientError({
      type: 'react',
      severity: 'critical',
      title: 'React rendering failure',
      message: error?.message || 'The interface could not render this page.',
      stack: error?.stack,
      metadata: {
        componentStack: info?.componentStack,
        errorId,
      },
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="pwc-app-error-boundary" role="alert">
        <section>
          <p className="eyebrow">Power Within</p>
          <h1>This page needs a quick reset.</h1>
          <p>
            The issue has been reported to the private Developer Error Center. Refresh the
            page to try again without losing changes that were already saved.
          </p>
          {this.state.errorId && <small>Reference: {this.state.errorId}</small>}
          <div>
            <button type="button" onClick={() => window.location.reload()}>
              Refresh page
            </button>
            <a href="/">Return to the website</a>
          </div>
        </section>
      </main>
    )
  }
}

export default AppErrorBoundary
