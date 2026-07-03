import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Spinner } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

export function ProtectedLayout() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    )
  }
  if (!session) return <Navigate to="/login" replace />

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } finally {
      navigate('/login')
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
      isActive ? 'bg-panel-2 text-ink' : 'text-ink-dim hover:text-ink'
    }`

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <nav className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="font-display text-lg font-bold tracking-tight">
              Momentum<span className="text-accent">.</span>
            </NavLink>
            <div className="flex items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/sessions" end className={linkClass}>
                Sessions
              </NavLink>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-ink-dim transition-colors duration-200 hover:text-ink"
          >
            Sign out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
