import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { LogoMark } from '../../components/brand'
import { Alert, Button, Field, Input, Spinner } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

type Mode = 'login' | 'signup'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (!data.session) {
        setNotice('Account created. Check your email to confirm, then log in.')
        setMode('login')
      }
    }
    setBusy(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <header className="mb-10 text-center">
          <LogoMark className="mx-auto mb-4 size-16" />
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Momentum<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            Train smart. Watch your gains compound.
          </p>
        </header>

        <div className="rounded-xl border border-line bg-panel p-6">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-panel-2 p-1" role="tablist">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setError(null)
                  setNotice(null)
                }}
                className={`h-9 rounded-md text-sm font-medium transition-colors duration-200 ${
                  mode === m ? 'bg-panel text-ink shadow-sm' : 'text-ink-dim hover:text-ink'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" hint={mode === 'signup' ? 'min. 6 characters' : undefined}>
              <Input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && <Alert kind="error">{error}</Alert>}
            {notice && <Alert kind="info">{notice}</Alert>}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Spinner /> : mode === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
