'use client'

import { SubmitEventHandler, useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'
import { useCooldown } from '@/components/auth/useCooldown'
import styles from '@/components/auth/authContent.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ResendVerificationForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState<'form' | 'sent' | 'already'>('form')
  const { remaining, start } = useCooldown()

  async function send(): Promise<void> {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (res.status === 409) {
        setView('already')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setView('sent')
      start(30)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const submit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    await send()
  }

  if (view === 'already') {
    return (
      <AuthShell>
        <div className={styles.success} role='status'>
          <svg width='40' height='40' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <circle cx='12' cy='12' r='10' fill='var(--color-safe-wash)' />
            <path
              d='m8 12 2.8 2.8L16 9.5'
              stroke='var(--color-safe-ink)'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          <h1 className={styles.title}>Already confirmed</h1>
          <p className={styles.lede}>
            <strong>{email}</strong> is already verified. You&rsquo;re good to log in.
          </p>
          <Link href='/login' className='lms-btn lms-btn--primary lms-btn--block'>
            Log in
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (view === 'sent') {
    return (
      <AuthShell>
        <div className={styles.success} role='status'>
          <svg width='40' height='40' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <circle cx='12' cy='12' r='10' fill='var(--color-safe-wash)' />
            <path
              d='m8 12 2.8 2.8L16 9.5'
              stroke='var(--color-safe-ink)'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.lede}>
            We&rsquo;ve sent a new confirmation link to <strong>{email}</strong>. It expires in 24
            hours.
          </p>
          {error && (
            <p className={styles.alt} role='alert'>
              {error}
            </p>
          )}
          <button
            type='button'
            className='lms-btn lms-btn--ghost lms-btn--block'
            onClick={send}
            disabled={submitting || remaining > 0}
            aria-disabled={submitting || remaining > 0}
          >
            {remaining > 0
              ? `Resend available in ${remaining}s`
              : submitting
                ? 'Sending…'
                : 'Resend email'}
          </button>
          <Link href='/login' className='lms-btn lms-btn--primary lms-btn--block'>
            Back to log in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Resend confirmation email</h1>
      <p className={styles.lede}>
        Enter the email you signed up with and we&rsquo;ll send you a fresh confirmation link.
      </p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`lms-field ${error ? 'lms-field--error' : ''}`}>
          <label className='lms-field__label' htmlFor='email'>
            Email
          </label>
          <input
            className='lms-field__control'
            id='email'
            type='email'
            autoComplete='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            aria-describedby='resend-help'
          />
          <p className='lms-field__help' id='resend-help' role={error ? 'alert' : undefined}>
            {error}
          </p>
        </div>

        <button
          type='submit'
          className='lms-btn lms-btn--primary lms-btn--block'
          disabled={submitting}
          aria-disabled={submitting}
        >
          {submitting ? (
            <>
              <span className='lms-spinner' aria-hidden='true' />
              Sending&hellip;
            </>
          ) : (
            'Send confirmation link'
          )}
        </button>
      </form>

      <p className={styles.alt}>
        Already confirmed? <Link href='/login'>Log in</Link>
      </p>
    </AuthShell>
  )
}
