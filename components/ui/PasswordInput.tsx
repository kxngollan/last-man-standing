"use client";

import { useState } from "react";

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  helper?: string;
  autoComplete?: string;
  required?: boolean;
}

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  helper,
  autoComplete,
  required,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const helpId = `${id}-help`;

  return (
    <div className={`lms-field ${error ? "lms-field--error" : ""}`}>
      <label className="lms-field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="lms-field__req" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="lms-field__wrap">
        <input
          className="lms-field__control lms-field__control--eye"
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={helpId}
          aria-required={required}
        />
        <button
          type="button"
          className="lms-field__eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          tabIndex={0}
        >
          {show ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path
                d="M10.6 10.6a2 2 0 0 0 2.85 2.85"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M9.5 5.2A9.4 9.4 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-2.75 3.65M6.2 6.6C3.95 8 2.6 9.95 2 12c1 2.5 5 7 10 7 1.35 0 2.65-.28 3.85-.78"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          )}
        </button>
      </div>

      <p className="lms-field__help" id={helpId} role={error ? "alert" : undefined}>
        {error ?? helper ?? ""}
      </p>
    </div>
  );
}
