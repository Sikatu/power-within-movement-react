import { Link } from 'react-router-dom'
import { studioWorkspaceContracts } from '../studioNavigation.js'

export default function StudioWorkspacePage({ workspaceId }) {
  const workspace = studioWorkspaceContracts[workspaceId]

  if (!workspace) return null

  return (
    <div className="studio-v2-page">
      <header className="studio-v2-page-header">
        <div>
          <p className="studio-v2-eyebrow">{workspace.eyebrow}</p>
          <h1>{workspace.title}</h1>
          <p>{workspace.description}</p>
        </div>

        <Link
          className="studio-v2-button is-secondary"
          to={workspace.legacyPath}
        >
          {workspace.legacyLabel}
        </Link>
      </header>

      <section className="studio-v2-contract-layout">
        <article className="studio-v2-contract-panel">
          <p className="studio-v2-eyebrow">Approved workflow</p>
          <h2>One journey from beginning to next step.</h2>

          <ol className="studio-v2-workflow">
            {workspace.workflow.map((stage, index) => (
              <li key={stage}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{stage}</strong>
              </li>
            ))}
          </ol>
        </article>

        <aside className="studio-v2-contract-panel is-quiet">
          <p className="studio-v2-eyebrow">Workspace contract</p>
          <h2>What this experience must protect.</h2>

          <ul className="studio-v2-principle-list">
            {workspace.principles.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>

          <div className="studio-v2-build-status">
            <span>Foundation ready</span>
            <p>
              The current workflow remains available while this
              workspace is connected to existing data and actions.
            </p>
          </div>
        </aside>
      </section>
    </div>
  )
}