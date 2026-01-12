/**
 * Performance Utilities
 * PCM Requisition System
 * 
 * Utility functions and HOCs for optimizing React performance.
 */

import { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react'

/**
 * Deep comparison memo wrapper
 * Use when component has object/array props that should be compared deeply
 */
export function deepMemo(Component, propsAreEqual) {
  return memo(Component, propsAreEqual || deepEqual)
}

/**
 * Deep equality check for objects
 */
export function deepEqual(prevProps, nextProps) {
  const prevKeys = Object.keys(prevProps)
  const nextKeys = Object.keys(nextProps)

  if (prevKeys.length !== nextKeys.length) return false

  for (const key of prevKeys) {
    const prevVal = prevProps[key]
    const nextVal = nextProps[key]

    if (typeof prevVal === 'function' && typeof nextVal === 'function') {
      // Skip function comparison - assume stable
      continue
    }

    if (typeof prevVal === 'object' && typeof nextVal === 'object') {
      if (prevVal === null && nextVal === null) continue
      if (prevVal === null || nextVal === null) return false
      if (!deepEqual(prevVal, nextVal)) return false
      continue
    }

    if (prevVal !== nextVal) return false
  }

  return true
}

/**
 * Debounce hook - delays execution until after wait period
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Throttle hook - limits execution to once per interval
 */
export function useThrottle(value, interval = 300) {
  const [throttledValue, setThrottledValue] = useState(value)
  const lastUpdated = useRef(Date.now())

  useEffect(() => {
    const now = Date.now()
    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now
      setThrottledValue(value)
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now()
        setThrottledValue(value)
      }, interval - (now - lastUpdated.current))

      return () => clearTimeout(timer)
    }
  }, [value, interval])

  return throttledValue
}

/**
 * Previous value hook - returns previous value of a variable
 */
export function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

/**
 * Stable callback hook - maintains reference stability
 */
export function useStableCallback(callback) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback((...args) => {
    return callbackRef.current?.(...args)
  }, [])
}

/**
 * Memoized computed value with deep comparison
 */
export function useDeepMemo(factory, deps) {
  const ref = useRef({ deps: undefined, value: undefined })

  if (ref.current.deps === undefined || !deepArrayEqual(ref.current.deps, deps)) {
    ref.current.deps = deps
    ref.current.value = factory()
  }

  return ref.current.value
}

/**
 * Deep array equality check
 */
function deepArrayEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false
  return arr1.every((item, index) => {
    if (typeof item === 'object' && item !== null) {
      return JSON.stringify(item) === JSON.stringify(arr2[index])
    }
    return item === arr2[index]
  })
}

/**
 * Intersection observer hook for lazy loading
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
        if (entry.isIntersecting) {
          setHasIntersected(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    )

    observer.observe(ref.current)

    return () => observer.disconnect()
  }, [options.threshold, options.rootMargin])

  return { ref, isIntersecting, hasIntersected }
}

/**
 * Virtual list helper - calculates visible items
 */
export function useVirtualList(items, containerHeight, itemHeight) {
  return useMemo(() => {
    if (!containerHeight || !itemHeight) {
      return { visibleItems: items, startIndex: 0, endIndex: items.length }
    }

    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2
    const startIndex = 0
    const endIndex = Math.min(startIndex + visibleCount, items.length)

    return {
      visibleItems: items.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      totalHeight: items.length * itemHeight
    }
  }, [items, containerHeight, itemHeight])
}

/**
 * Performance measurement utility
 */
export const perfMark = {
  start: (name) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`)
    }
  },
  end: (name) => {
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${name}-end`)
      try {
        performance.measure(name, `${name}-start`, `${name}-end`)
        const entries = performance.getEntriesByName(name)
        if (entries.length > 0) {
          return entries[entries.length - 1].duration
        }
      } catch (e) {
        // Ignore measurement errors
      }
    }
    return null
  },
  log: (name) => {
    const duration = perfMark.end(name)
    if (duration !== null && import.meta.env.DEV) {
      console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`)
    }
    return duration
  }
}

/**
 * Request idle callback hook for non-urgent updates
 */
export function useIdleCallback(callback, deps = []) {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback)
      return () => window.cancelIdleCallback(id)
    } else {
      const id = setTimeout(callback, 1)
      return () => clearTimeout(id)
    }
  }, deps)
}

export default {
  deepMemo,
  deepEqual,
  useDebounce,
  useThrottle,
  usePrevious,
  useStableCallback,
  useDeepMemo,
  useIntersectionObserver,
  useVirtualList,
  perfMark,
  useIdleCallback
}
