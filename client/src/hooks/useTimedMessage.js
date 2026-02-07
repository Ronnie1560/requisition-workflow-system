import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Hook for displaying temporary success/status messages that auto-clear.
 * Handles cleanup on unmount to prevent state updates on unmounted components.
 *
 * @param {number} duration - How long the message is shown in ms (default: 3000)
 * @returns {[string, function]} - [message, showMessage]
 *
 * Usage:
 *   const [success, showSuccess] = useTimedMessage(3000)
 *   showSuccess('Saved!') // auto-clears after 3s
 *   showSuccess('')       // clears immediately
 */
export function useTimedMessage(duration = 3000) {
  const [message, setMessage] = useState('')
  const timerRef = useRef(null)

  const showMessage = useCallback((msg) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMessage(msg)
    if (msg) {
      timerRef.current = setTimeout(() => setMessage(''), duration)
    }
  }, [duration])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return [message, showMessage]
}
