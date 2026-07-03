import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base =
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50'
  const variants = {
    primary: 'bg-accent text-surface hover:bg-accent-deep',
    ghost: 'border border-line text-ink hover:border-ink-faint hover:bg-panel-2',
    danger: 'text-danger hover:bg-danger/10',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-11 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-11 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm text-ink transition-colors duration-200 focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium uppercase tracking-wide text-ink-dim">
        {label}
        {hint && <span className="normal-case tracking-normal text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Alert({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  const styles =
    kind === 'error'
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-accent/30 bg-accent/10 text-accent'
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`rounded-lg border px-3 py-2.5 text-sm ${styles}`}
    >
      {children}
    </div>
  )
}

export function Spinner() {
  return (
    <span
      aria-label="Loading"
      className="inline-block size-4 animate-spin rounded-full border-2 border-ink-faint border-t-ink"
    />
  )
}
