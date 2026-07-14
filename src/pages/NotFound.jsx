import { Link } from 'react-router-dom'
import './NotFound.css'

function NotFound() {
  return (
    <main id="main-content" className="not-found-page">
      <section className="not-found-card">
        <span className="not-found-number" aria-hidden="true">404</span>
        <div className="not-found-copy">
          <p className="eyebrow">Page Not Found</p>
          <h1>This page has stepped out of view.</h1>
          <p>
            The address may have changed, or the page may no longer be available.
            You can return to the main experience or contact Power Within for help.
          </p>
          <div className="not-found-actions">
            <Link className="button button-primary" to="/">Return Home</Link>
            <Link className="button button-secondary" to="/contact">Contact Power Within</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default NotFound
