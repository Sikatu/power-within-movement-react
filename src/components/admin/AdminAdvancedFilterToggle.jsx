export default function AdminAdvancedFilterToggle({ open, activeCount = 0, onToggle }) {
  return (
    <button
      className="pwc-ops36-filter-toggle"
      type="button"
      aria-expanded={open}
      onClick={onToggle}
    >
      <span>{open ? 'Hide filters' : 'More filters'}</span>
      {activeCount > 0 && <strong>{activeCount}</strong>}
    </button>
  )
}
