import { Component } from 'react'
import { Link } from 'react-router-dom'
import { reportClientError } from '../../lib/errorReporter.js'

function buildDiagnostic(error, componentStack) {
  return [
    `Route: ${window.location.pathname}`,
    `Time: ${new Date().toISOString()}`,
    `Message: ${error?.message || 'Unknown interface error'}`,
    error?.stack ? `Stack:\n${error.stack}` : '',
    componentStack ? `Component stack:\n${componentStack}` : '',
  ].filter(Boolean).join('\n\n')
}

export default class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      error: null,
      componentStack: '',
      copied: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack || '' })

    reportClientError({
      type: 'react',
      severity: 'high',
      title: this.props.internal
        ? 'Admin workspace render failure'
        : 'Frontend route render failure',
      message: error?.message || 'A route failed to render.',
      stack: error?.stack,
      metadata: {
        componentStack: info?.componentStack || null,
        recoveryBoundary: 'AdminErrorBoundary',
      },
    })
  }

  componentDidUpdate(previousProps) {
    if (
      previousProps.resetKey !== this.props.resetKey
      && this.state.error
    ) {
      this.setState({
        error: null,
        componentStack: '',
        copied: false,
      })
    }
  }

  copyDiagnostic = async () => {
    const diagnostic = buildDiagnostic(
      this.state.error,
      this.state.componentStack,
    )

    try {
      await navigator.clipboard.writeText(diagnostic)
      this.setState({ copied: true })
    } catch {
      this.setState({ copied: false })
    }
  }

  retryRoute = () => {
    this.setState({
      error: null,
      componentStack: '',
      copied: false,
    })
  }

  reloadApplication = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    const isChunkFailure = /dynamically imported module|loading chunk|failed to fetch/i.test(
      error?.message || '',
    )
    const internal = Boolean(this.props.internal)

    return (
      <main
        id="main-content"
        className="pwc-admin-recovery"
        tabIndex={-1}
      >
        <section className="pwc-admin-recovery-card" role="alert">
          <span className="pwc-admin-recovery-mark" aria-hidden="true">!</span>

          <div className="pwc-admin-recovery-copy">
            <p className="eyebrow">{internal ? 'Private workspace recovery' : 'Page recovery'}</p>
            <h1>
              {isChunkFailure
                ? 'This page update did not load'
                : internal
                  ? 'This workspace needs a quick reset'
                  : 'This page needs a quick reset'}
            </h1>
            <p>
              {isChunkFailure
                ? 'The browser may still be holding an older application file. Reloading will request the current build.'
                : internal
                  ? 'Your data has not been deleted. Retry this route, return to the Studio, or reload the application.'
                  : 'Retry this page, return home, or reload the application.'}
            </p>

            <details>
              <summary>Technical detail</summary>
              <code>{error?.message || 'Unknown interface error'}</code>
            </details>

            <div className="pwc-admin-recovery-actions">
              {!isChunkFailure && (
                <button type="button" onClick={this.retryRoute}>
                  Try this workspace again
                </button>
              )}
              <button className="is-primary" type="button" onClick={this.reloadApplication}>
                Reload the Studio
              </button>
              <Link to={internal ? '/admin/dashboard' : '/'}>
                {internal ? 'Return to Overview' : 'Return home'}
              </Link>
              <button className="is-quiet" type="button" onClick={this.copyDiagnostic}>
                {this.state.copied ? 'Diagnostic copied' : 'Copy diagnostic'}
              </button>
            </div>
          </div>
        </section>
      </main>
    )
  }
}
