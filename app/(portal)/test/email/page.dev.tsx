'use client'

import { useState } from 'react'
import styles from '../page.module.css'

type Kind = 'verification' | 'reset'

const KINDS: { kind: Kind; label: string; hint: string }[] = [
  {
    kind: 'verification',
    label: 'Verification email',
    hint: 'The “confirm your account” email new players get when they sign up.'
  },
  {
    kind: 'reset',
    label: 'Password reset email',
    hint: 'The “set a new password” email sent from the forgot-password flow.'
  }
]

export default function TestEmailPage() {
  const [busy, setBusy] = useState<Kind | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function send(kind: Kind) {
    setBusy(kind)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.detail ? `${body.error}: ${body.detail}` : (body.error ?? 'Failed to send.'))
      } else if (body.delivered) {
        setMessage(`Sent to ${body.to}. Check your inbox (and spam folder).`)
      } else {
        setMessage(
          `SMTP isn’t configured, so nothing was actually sent — the link for ${body.to} was logged to the server console instead.`
        )
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className={styles.main}>
      <div className='lms-head'>
        <h1 className='lms-head__title'>Test emails</h1>
        <p className='lms-head__hint'>
          Send yourself a copy of the emails the game sends, using the address on your account.
        </p>
      </div>

      {error && (
        <p className={styles.notice} role='alert' style={{ color: 'var(--color-out-ink)' }}>
          {error}
        </p>
      )}
      {message && (
        <p className={styles.notice} role='status'>
          {message}
        </p>
      )}

      <div className={styles.grid}>
        {KINDS.map(({ kind, label, hint }) => (
          <section key={kind} className={`lms-panel ${styles.panel}`}>
            <h2 className={styles.panelTitle}>{label}</h2>
            <p className={styles.panelHint}>{hint}</p>
            <button
              className='lms-btn lms-btn--primary lms-btn--block'
              disabled={busy !== null}
              onClick={() => send(kind)}
            >
              {busy === kind ? 'Sending…' : 'Send to my email'}
            </button>
          </section>
        ))}
      </div>
    </main>
  )
}
