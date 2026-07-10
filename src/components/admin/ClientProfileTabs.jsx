import { clientProfileSections } from './clientProfileSections'

export default function ClientProfileTabs({ activeSection, onSelect }) {
  return (
    <nav
      className="client-detail-jump-nav-v2"
      aria-label="Client profile sections"
    >
      {clientProfileSections.map((section) => {
        const isActive = activeSection === section.id

        return (
          <button
            key={section.id}
            type="button"
            className={isActive ? 'is-active' : ''}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(section.id)}
          >
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}
