import { Link } from 'react-router-dom'
import { studioMoreTools } from '../studioNavigation.js'

export default function StudioMore() {
  return (
    <div className="studio-v2-page">
      <header className="studio-v2-page-header">
        <div>
          <p className="studio-v2-eyebrow">Secondary tools</p>
          <h1>More</h1>
          <p>
            Less-frequent tools remain available without crowding the
            primary daily workflow.
          </p>
        </div>
      </header>

      <div className="studio-v2-more-groups">
        {studioMoreTools.map((group) => (
          <section className="studio-v2-more-group" key={group.group}>
            <div className="studio-v2-section-heading">
              <div>
                <p className="studio-v2-eyebrow">Studio directory</p>
                <h2>{group.group}</h2>
              </div>
            </div>

            <div className="studio-v2-more-grid">
              {group.items.map((item) => (
                <Link
                  className="studio-v2-tool-card"
                  key={item.to}
                  to={item.to}
                >
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                  <span>Open current tool →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}