import { Link } from 'react-router-dom'
import './FounderDeveloperBanner.css'

function readSessionValue(key) {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

export default function FounderDeveloperBanner() {
  const adminUser = readSessionValue('pwc_admin_user')
  const founderOwner = readSessionValue('pwc_founder_workspace_owner')

  if (adminUser?.role !== 'developer') return null

  return (
    <aside className="founder-developer-banner" aria-label="Developer Founder workspace access">
      <div>
        <strong>Developer access · Live Founder workspace</strong>
        <span>
          You are viewing and managing the owner workspace
          {founderOwner?.email ? ` for ${founderOwner.email}` : ''}. Changes made here are live and recorded under your developer account.
        </span>
      </div>

      <Link to="/admin/developer">Back to Developer Control Center</Link>
    </aside>
  )
}
