const iconPaths = {
  today: [
    'M4 4h6v6H4z',
    'M14 4h6v6h-6z',
    'M4 14h6v6H4z',
    'M14 14h6v6h-6z',
  ],
  pipeline: [
    'M5 5h4v4H5z',
    'M15 5h4v4h-4z',
    'M10 15h4v4h-4z',
    'M9 7h6',
    'M12 9v6',
  ],
  clients: [
    'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2',
    'M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M17 11a3 3 0 1 0 0-6',
    'M21 20v-2a4 4 0 0 0-3-3.87',
  ],
  sessions: [
    'M5 3v3',
    'M19 3v3',
    'M3 9h18',
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    'M8 13h3',
    'M8 17h7',
  ],
  inbox: [
    'M4 5h16v14H4z',
    'M4 7l8 6 8-6',
  ],
  more: [
    'M5 12h.01',
    'M12 12h.01',
    'M19 12h.01',
  ],
}

export default function StudioIcon({ name }) {
  const paths = iconPaths[name] || iconPaths.today

  return (
    <svg
      aria-hidden="true"
      className="studio-v2-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      {paths.map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  )
}