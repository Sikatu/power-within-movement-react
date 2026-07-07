import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <main>
      <section className="section not-found-section">
        <div className="section-header">
          <p className="eyebrow">Page Not Found</p>
          <h2>This page may have moved, but you can still return to what matters.</h2>
          <p>Use the links below to continue exploring Power Within Collective.</p>

          <div className="hero-actions">
            <Link to="/" className="btn primary">Return Home</Link>
            <Link to="/experiences" className="btn secondary">Explore Experiences</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default NotFound
