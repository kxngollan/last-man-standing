'use client'

import { useEffect, useState } from 'react'

/**
 * Seconds-ticking cooldown for resend-email buttons. Call `start(n)` after a
 * successful send; `remaining` counts down to 0 once per second.
 */
export function useCooldown() {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  return { remaining, start: setRemaining }
}
