import { useEffect, useRef, useCallback, useState } from 'react'
import { logger } from '../utils/logger'

/**
 * Hook to handle user inactivity timeout
 *
 * @param {Function} onTimeout - Callback when inactivity timeout is reached
 * @param {Object} options - Configuration options
 * @param {number} options.timeoutMinutes - Minutes of inactivity before timeout (default: 30)
 * @param {number} options.warningMinutes - Minutes before timeout to show warning (default: 2)
 * @param {boolean} options.enabled - Whether the timeout is enabled (default: true)
 *
 * @returns {Object} - { showWarning, remainingSeconds, resetTimer, pauseTimer, resumeTimer }
 */
export const useInactivityTimeout = (onTimeout, options = {}) => {
  const {
    timeoutMinutes = 30,
    warningMinutes = 2,
    enabled = true
  } = options

  const [showWarning, setShowWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const timeoutRef = useRef(null)
  const warningTimeoutRef = useRef(null)
  const countdownIntervalRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const isPausedRef = useRef(false)

  const TIMEOUT_MS = timeoutMinutes * 60 * 1000
  const WARNING_MS = warningMinutes * 60 * 1000
  const WARNING_TRIGGER_MS = TIMEOUT_MS - WARNING_MS

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    if (!enabled || isPausedRef.current) return

    lastActivityRef.current = Date.now()
    setShowWarning(false)
    clearTimers()

    // Set timeout for final logout
    timeoutRef.current = setTimeout(() => {
      logger.warn('Inactivity timeout reached - logging out user')
      onTimeout()
    }, TIMEOUT_MS)

    // Set timeout to show warning
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
      setRemainingSeconds(Math.floor(WARNING_MS / 1000))

      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, WARNING_TRIGGER_MS)
  }, [enabled, TIMEOUT_MS, WARNING_TRIGGER_MS, WARNING_MS, onTimeout, clearTimers])

  // Pause the timer (useful when showing modals or during critical operations)
  const pauseTimer = useCallback(() => {
    isPausedRef.current = true
    clearTimers()
  }, [clearTimers])

  // Resume the timer
  const resumeTimer = useCallback(() => {
    isPausedRef.current = false
    resetTimer()
  }, [resetTimer])

  // Activity event handler
  const handleActivity = useCallback(() => {
    if (!enabled || isPausedRef.current) return

    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current

    // Only reset if enough time has passed (throttle to avoid excessive resets)
    // Reset every 30 seconds of activity
    if (timeSinceLastActivity > 30000) {
      resetTimer()
    }
  }, [enabled, resetTimer])

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }

    // Activity events to monitor
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ]

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Start the timer
    resetTimer()

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
      clearTimers()
    }
  }, [enabled, handleActivity, resetTimer, clearTimers])

  return {
    showWarning,
    remainingSeconds,
    resetTimer,
    pauseTimer,
    resumeTimer
  }
}
