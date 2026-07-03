import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedLayout } from './features/auth/ProtectedLayout'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { SessionFormPage } from './features/sessions/SessionFormPage'
import { SessionsPage } from './features/sessions/SessionsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/new" element={<SessionFormPage />} />
        <Route path="/sessions/:id/edit" element={<SessionFormPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
