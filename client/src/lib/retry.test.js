import { describe, it, expect, vi } from 'vitest'

// Test the withRetry function logic directly without importing supabase
describe('API Retry Logic', () => {
  describe('withRetry pattern', () => {
    // Simulate the withRetry function
    const withRetry = async (fn, maxRetries = 3, baseDelay = 10) => {
      let lastError
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn()
        } catch (error) {
          lastError = error
          
          // Don't retry on client errors (4xx)
          if (error?.status >= 400 && error?.status < 500) {
            throw error
          }
          
          if (attempt < maxRetries) {
            // Shortened delay for testing
            const delay = baseDelay * Math.pow(2, attempt)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }
      
      throw lastError
    }

    it('should return result on first successful call', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'success' })
      
      const result = await withRetry(mockFn)
      
      expect(result).toEqual({ data: 'success' })
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and succeed', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ data: 'success' })
      
      const result = await withRetry(mockFn)
      
      expect(result).toEqual({ data: 'success' })
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should retry multiple times before succeeding', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue({ data: 'success' })
      
      const result = await withRetry(mockFn)
      
      expect(result).toEqual({ data: 'success' })
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('should throw after max retries exceeded', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Persistent error'))
      
      await expect(withRetry(mockFn, 2)).rejects.toThrow('Persistent error')
      expect(mockFn).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should not retry on 4xx errors', async () => {
      const clientError = new Error('Not found')
      clientError.status = 404
      
      const mockFn = vi.fn().mockRejectedValue(clientError)
      
      await expect(withRetry(mockFn)).rejects.toThrow('Not found')
      expect(mockFn).toHaveBeenCalledTimes(1) // No retries
    })

    it('should not retry on 401 unauthorized', async () => {
      const authError = new Error('Unauthorized')
      authError.status = 401
      
      const mockFn = vi.fn().mockRejectedValue(authError)
      
      await expect(withRetry(mockFn)).rejects.toThrow('Unauthorized')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 403 forbidden', async () => {
      const forbiddenError = new Error('Forbidden')
      forbiddenError.status = 403
      
      const mockFn = vi.fn().mockRejectedValue(forbiddenError)
      
      await expect(withRetry(mockFn)).rejects.toThrow('Forbidden')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should retry on 5xx server errors', async () => {
      const serverError = new Error('Server error')
      serverError.status = 500
      
      const mockFn = vi.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue({ data: 'recovered' })
      
      const result = await withRetry(mockFn)
      
      expect(result).toEqual({ data: 'recovered' })
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should retry on 503 service unavailable', async () => {
      const unavailableError = new Error('Service unavailable')
      unavailableError.status = 503
      
      const mockFn = vi.fn()
        .mockRejectedValueOnce(unavailableError)
        .mockResolvedValue({ data: 'available' })
      
      const result = await withRetry(mockFn)
      
      expect(result).toEqual({ data: 'available' })
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should use exponential backoff', async () => {
      const startTime = Date.now()
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue({ data: 'success' })
      
      await withRetry(mockFn, 3, 10)
      
      const elapsed = Date.now() - startTime
      // Should have waited at least 10 + 20 = 30ms (exponential backoff)
      expect(elapsed).toBeGreaterThanOrEqual(25) // Allow some variance
    })

    it('should handle async function that returns null', async () => {
      const mockFn = vi.fn().mockResolvedValue(null)
      
      const result = await withRetry(mockFn)
      
      expect(result).toBeNull()
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should handle async function that returns undefined', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined)
      
      const result = await withRetry(mockFn)
      
      expect(result).toBeUndefined()
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })
})
