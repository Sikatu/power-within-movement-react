import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import StudioShell from './StudioShell.jsx'
import StudioMore from './pages/StudioMore.jsx'
import StudioClients from './pages/StudioClients.jsx'
import StudioPipeline from './pages/StudioPipeline.jsx'
import StudioToday from './pages/StudioToday.jsx'
import StudioWorkspacePage from './pages/StudioWorkspacePage.jsx'
import './studio.css'

export default function StudioApp() {
  return (
    <StudioShell>
      <Routes>
        <Route index element={<Navigate replace to="/studio/today" />} />
        <Route path="today" element={<StudioToday />} />
        <Route path="pipeline" element={<StudioPipeline />} />
        <Route path="clients" element={<StudioClients />} />
        <Route
          path="sessions"
          element={<StudioWorkspacePage workspaceId="sessions" />}
        />
        <Route
          path="inbox"
          element={<StudioWorkspacePage workspaceId="inbox" />}
        />
        <Route path="more" element={<StudioMore />} />
        <Route
          path="*"
          element={<Navigate replace to="/studio/today" />}
        />
      </Routes>
    </StudioShell>
  )
}