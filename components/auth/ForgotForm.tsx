'use client'

import { SubmitEventHandler, useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'
import { useCooldown } from '@/components/auth/useCooldown'
import isEmail from '@/lib/isEmail'
import styles from '@/components/auth/authContent.module.css'

export default function ForgotForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const { remaining, start } = useCooldown()

  async function send(): Promise<void> {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSent(true)
      start(30)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const submit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!isEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    await send()
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
            We&rsquo;ve sent a password reset link to <strong>{email}</strong>. It expires in 1
            hour.
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
            {remaining > 0 ? `Resend available in ${remaining}s` : submitting ? 'Sending…' : 'Resend email'}
          </button>
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
