import { z } from 'zod'
import { logger } from '../utils/logger'

/**
 * Environment Variable Schema
 * Validates all required environment variables at startup
 * Fails fast with clear error messages if configuration is invalid
 */

const envSchema = z.object({
  // Supabase Configuration (Required)
  VITE_SUPABASE_URL: z
    .string()
    .url('VITE_SUPABASE_URL must be a valid URL')
    .min(1, 'VITE_SUPABASE_URL is required'),
  
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'VITE_SUPABASE_ANON_KEY must be a valid key')
    .regex(/^eyJ/, 'VITE_SUPABASE_ANON_KEY must be a valid JWT'),

  // Optional: Application Settings
  VITE_APP_NAME: z
    .string()
    .default('PCM Requisition System'),
  
  VITE_APP_VERSION: z
    .string()
    .default('1.0.0'),

  // Optional: Feature Flags
  VITE_ENABLE_ANALYTICS: z
    .string()
    .transform(val => val === 'true')
    .default('false'),

  VITE_ENABLE_DEBUG_MODE: z
    .string()
    .transform(val => val === 'true')
    .default('false'),

  // Optional: API Configuration
  VITE_API_TIMEOUT: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('30000'),

  VITE_MAX_UPLOAD_SIZE: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10485760'), // 10MB default

  // Optional: Sentry Error Monitoring
  VITE_SENTRY_DSN: z
    .string()
    .url()
    .optional(),
})

/**
 * Validated environment variables
 * Access these instead of import.meta.env directly
 */
let validatedEnv = null

/**
 * Validates environment variables against the schema
 * @returns {boolean} True if validation passes
 * @throws {Error} If required variables are missing or invalid
 */
export function validateEnv() {
  const rawEnv = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
    VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
    VITE_ENABLE_DEBUG_MODE: import.meta.env.VITE_ENABLE_DEBUG_MODE,
    VITE_API_TIMEOUT: import.meta.env.VITE_API_TIMEOUT,
    VITE_MAX_UPLOAD_SIZE: import.meta.env.VITE_MAX_UPLOAD_SIZE,
  }

  const result = envSchema.safeParse(rawEnv)

  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      return `  - ${issue.path.join('.')}: ${issue.message}`
    }).join('\n')

    const errorMessage = `Environment validation failed:\n${errors}\n\nPlease check your .env.local file.`
    
    logger.error('Environment validation failed', { 
      errors: result.error.issues 
    })

    // In development, show a helpful error
    if (import.meta.env.DEV) {
      console.error('\n🚨 ' + errorMessage + '\n')
      console.error('Required environment variables:')
      console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co')
      console.error('  VITE_SUPABASE_ANON_KEY=your-anon-key\n')
    }

    throw new Error(errorMessage)
  }

  validatedEnv = result.data
  logger.info('Environment validated successfully')
  
  return true
}

/**
 * Get validated environment configuration
 * @returns {z.infer<typeof envSchema>} Validated environment object
 */
export function getEnv() {
  if (!validatedEnv) {
    validateEnv()
  }
  return validatedEnv
}

/**
 * Check if running in development mode
 */
export function isDev() {
  return import.meta.env.DEV
}

/**
 * Check if running in production mode
 */
export function isProd() {
  return import.meta.env.PROD
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode() {
  const env = getEnv()
  return env.VITE_ENABLE_DEBUG_MODE || import.meta.env.DEV
}

// Export schema for testing
export { envSchema }
