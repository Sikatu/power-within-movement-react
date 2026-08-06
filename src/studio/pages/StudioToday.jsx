import { Link } from 'react-router-dom'
import { studioPrimaryNavigation } from '../studioNavigation.js'
import StudioIcon from '../StudioIcon.jsx'

const workspaceItems = studioPrimaryNavigation.filter(
  (item) => !['today', 'more'].includes(item.id),
)

export default function StudioToday() {
  return (
    <div className="studio-v2-page">
      <header className="studio-v2-page-header">
        <div>
          <p className="studio-v2-eyebrow">Daily clarity</p>
          <h1>Today</h1>
          <p>
            See what needs attention, who it is about, and what should
            happen next.
          </p>
        </div>

        <Link className="studio-v2-button is-primary" to="/studio/pipeline">
          Open Pipeline
        </Link>
      </header>

      <section className="studio-v2-foundation-note">
        <div>
          <span>Clean foundation</span>
          <h2>The lighter Studio begins here.</h2>
          <p>
            Existing records and working tools remain safely available
            in Legacy Studio while each new workflow is connected to
            this simpler experience.
          </p>
        </div>

        <Link
          className="studio-v2-button is-secondary"
          to="/admin/dashboard"
        >
          Open current Today view
        </Link>
      </section>

      <section
        aria-labelledby="studio-workspaces-title"
        className="studio-v2-section"
      >
        <div className="studio-v2-section-heading">
          <div>
            <p className="studio-v2-eyebrow">Core workflows</p>
            <h2 id="studio-workspaces-title">One clear place to work.</h2>
          </div>

          <p>
            Each workspace is being rebuilt around the approved
            customer and client journey.
          </p>
        </div>

        <div className="studio-v2-workspace-grid">
          {workspaceItems.map((item) => (
            <Link
              className="studio-v2-workspace-card"
              key={item.id}
              to={item.to}
            >
              <span className="studio-v2-card-icon">
                <StudioIcon name={item.icon} />
              </span>

              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>

              <span aria-hidden="true" className="studio-v2-card-arrow">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="studio-v2-principle">
        <p className="studio-v2-eyebrow">Studio principle</p>
        <blockquote>
          What needs my attention? Who is this about? What should I do
          next?
        </blockquote>
      </section>
    </div>
  )
}