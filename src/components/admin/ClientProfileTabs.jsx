import { clientProfileSections } from './clientProfileSections'

export default function ClientProfileTabs({ activeSection, onSelect }) {
  function focusSection(sectionId) {
    window.requestAnimationFrame(() => {
      document.getElementById(`client-profile-tab-${sectionId}`)?.focus()
    })
  }

  function handleTabKeyDown(event, currentIndex) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

    let nextIndex = currentIndex

    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = clientProfileSections.length - 1
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % clientProfileSections.length
    }
    if (event.key === 'ArrowLeft') {
      nextIndex =
        (currentIndex - 1 + clientProfileSections.length) %
        clientProfileSections.length
    }

    event.preventDefault()
    const nextSection = clientProfileSections[nextIndex]
    onSelect(nextSection.id)
    focusSection(nextSection.id)
  }

  return (
    <nav
      className="client-detail-jump-nav-v2"
      aria-label="Client profile sections"
      role="tablist"
      aria-orientation="horizontal"
    >
      {clientProfileSections.map((section, index) => {
        const isActive = activeSection === section.id

        return (
          <button
            key={section.id}
            id={`client-profile-tab-${section.id}`}
            type="button"
            role="tab"
            className={isActive ? 'is-active' : ''}
            aria-selected={isActive}
            aria-controls={
              isActive ? `client-profile-panel-${section.id}` : undefined
            }
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(section.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}
