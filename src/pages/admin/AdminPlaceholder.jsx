import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'

function AdminPlaceholder({ title, eyebrow = 'Studio Space', description }) {
  return (
    <AdminFrame>
      <section className="pwc-admin-placeholder pwc-studio-placeholder">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>

        <div className="pwc-admin-placeholder-actions">
          <Link className="btn primary" to="/admin/dashboard">
            Return to The Studio
          </Link>

          <Link className="btn secondary" to="/admin/clients">
            Open Client Circle
          </Link>
        </div>
      </section>
    </AdminFrame>
  )
}

export default AdminPlaceholder