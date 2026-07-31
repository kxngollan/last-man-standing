'use client'

import { SubmitEventHandler, useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'
import styles from '@/components/auth/authContent.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const submit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      setSent(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
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
            If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to reset your password. It
            expires in 1 hour.
          </p>
          <Link href='/login' className='lms-btn lms-btn--ghost lms-btn--block'>
            Back to log in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Reset your password</h1>
      <p className={styles.lede}>Enter your email and we&rsquo;ll send you a reset link.</p>

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
            aria-describedby='forgot-help'
          />
          <p className='lms-field__help' id='forgot-help' role={error ? 'alert' : undefined}>
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
            'Send reset link'
          )}
        </button>
      </form>

      <p className={styles.alt}>
        Remembered it? <Link href='/login'>Log in</Link>
      </p>
    </AuthShell>
  )
}
