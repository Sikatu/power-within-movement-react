import AdminFrame from '../../components/admin/AdminFrame.jsx'
import AdminDailyBrief from './AdminDailyBrief.jsx'

export default function AdminDashboard() {
  return (
    <AdminFrame>
      <AdminDailyBrief embedded />
    </AdminFrame>
  )
}
