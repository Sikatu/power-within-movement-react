export const clientProfileSections = [
  { id: 'overview', label: 'Overview' },
  { id: 'care', label: 'Care Record' },
  { id: 'resources', label: 'Resources' },
  { id: 'portal-access', label: 'Portal Access' },
  { id: 'communication', label: 'Communication' },
  { id: 'activity', label: 'Activity' },
]

const clientProfileSectionIds = new Set(
  clientProfileSections.map((section) => section.id),
)

export function normalizeClientProfileSection(section) {
  const normalizedSection = String(section || '').trim().toLowerCase()

  return clientProfileSectionIds.has(normalizedSection)
    ? normalizedSection
    : 'overview'
}
