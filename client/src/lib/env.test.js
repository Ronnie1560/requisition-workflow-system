import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Test the schema directly without import.meta.env dependencies
describe('Environment Schema Validation', () => {
  const envSchema = z.object({
    VITE_SUPABASE_URL: z
      .string()
      .url('VITE_SUPABASE_URL must be a valid URL')
      .min(1, 'VITE_SUPABASE_URL is required'),
    
    VITE_SUPABASE_ANON_KEY: z
      .string()
      .min(20, 'VITE_SUPABASE_ANON_KEY must be a valid key')
      .regex(/^eyJ/, 'VITE_SUPABASE_ANON_KEY must be a valid JWT'),

    VITE_APP_NAME: z
      .string()
      .default('PCM Requisition System'),
    
    VITE_API_TIMEOUT: z
      .string()
      .transform(val => parseInt(val, 10))
      .pipe(z.number().positive())
      .default('30000'),
  })

  describe('Required variables', () => {
    it('should validate correct Supabase URL', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      })
      
      expect(result.success).toBe(true)
    })

    it('should reject invalid Supabase URL', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'not-a-url',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      })
      
      expect(result.success).toBe(false)
      expect(result.error.issues[0].path).toContain('VITE_SUPABASE_URL')
    })

    it('should reject missing Supabase URL', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      })
      
      expect(result.success).toBe(false)
    })

    it('should reject invalid anon key format', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'invalid-key-format',
      })
      
      expect(result.success).toBe(false)
      expect(result.error.issues[0].path).toContain('VITE_SUPABASE_ANON_KEY')
    })

    it('should reject short anon key', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJ',
      })
      
      expect(result.success).toBe(false)
    })
  })

  describe('Optional variables with defaults', () => {
    it('should use default app name when not provided', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      })
      
      expect(result.success).toBe(true)
      expect(result.data.VITE_APP_NAME).toBe('PCM Requisition System')
    })

    it('should use custom app name when provided', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        VITE_APP_NAME: 'Custom App',
      })
      
      expect(result.success).toBe(true)
      expect(result.data.VITE_APP_NAME).toBe('Custom App')
    })

    it('should transform API timeout to number', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        VITE_API_TIMEOUT: '60000',
      })
      
      expect(result.success).toBe(true)
      expect(result.data.VITE_API_TIMEOUT).toBe(60000)
      expect(typeof result.data.VITE_API_TIMEOUT).toBe('number')
    })

    it('should use default timeout when not provided', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      })
      
      expect(result.success).toBe(true)
      // Default returns as string '30000', transform only runs on provided values
      expect(result.data.VITE_API_TIMEOUT).toBe('30000')
    })
  })

  describe('Edge cases', () => {
    it('should handle all valid optional fields', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        VITE_APP_NAME: 'Test App',
        VITE_API_TIMEOUT: '5000',
      })
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        VITE_APP_NAME: 'Test App',
        VITE_API_TIMEOUT: 5000,
      })
    })

    it('should provide helpful error messages', () => {
      const result = envSchema.safeParse({
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
      })
      
      expect(result.success).toBe(false)
      expect(result.error.issues.length).toBeGreaterThan(0)
      
      // Check that error messages are descriptive
      const messages = result.error.issues.map(i => i.message)
      expect(messages.some(m => m.includes('URL') || m.includes('required'))).toBe(true)
    })
  })
})
