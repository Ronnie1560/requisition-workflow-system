/**
 * Input Sanitization Utilities
 *
 * Provides client-side sanitization to prevent XSS attacks and enforce data constraints.
 * Note: This is defense-in-depth - server-side validation is still required.
 */

/**
 * Sanitize general text input
 * - Removes HTML tags
 * - Encodes special characters
 * - Enforces maximum length
 * - Trims whitespace
 *
 * @param {string} input - The input string to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 255)
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input, maxLength = 255) => {
  if (!input || typeof input !== 'string') return ''

  let sanitized = input.trim()

  // Enforce maximum length
  sanitized = sanitized.substring(0, maxLength)

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

  // Encode HTML special characters to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')

  return sanitized
}

/**
 * Sanitize email address
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes any characters that aren't valid in email addresses
 * - Enforces maximum length
 *
 * @param {string} email - The email address to sanitize
 * @returns {string} - Sanitized email address
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return ''

  return email
    .trim()
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, '') // Remove invalid email characters
    .substring(0, 255)
}

/**
 * Sanitize organization slug
 * - Converts to lowercase
 * - Only allows alphanumeric characters and hyphens
 * - Removes multiple consecutive hyphens
 * - Removes leading/trailing hyphens
 * - Enforces maximum length
 *
 * @param {string} slug - The slug to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 50)
 * @returns {string} - Sanitized slug
 */
export const sanitizeSlug = (slug, maxLength = 50) => {
  if (!slug || typeof slug !== 'string') return ''

  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '') // Only allow a-z, 0-9, and hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, maxLength)
}

/**
 * Sanitize phone number
 * - Removes all characters except numbers, spaces, hyphens, parentheses, and plus signs
 * - Trims whitespace
 * - Enforces maximum length
 *
 * @param {string} phone - The phone number to sanitize
 * @returns {string} - Sanitized phone number
 */
export const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return ''

  return phone
    .trim()
    .replace(/[^0-9\s\-\(\)\+]/g, '') // Only allow numbers and common phone formatting chars
    .substring(0, 20)
}

/**
 * Sanitize organization signup data
 * Applies appropriate sanitization to all fields in the organization object
 *
 * @param {object} orgData - Organization data object
 * @returns {object} - Sanitized organization data
 */
export const sanitizeOrganizationData = (orgData) => {
  return {
    name: sanitizeInput(orgData.name, 100),
    slug: sanitizeSlug(orgData.slug, 50),
    email: sanitizeEmail(orgData.email),
    plan: orgData.plan || 'free'
  }
}

/**
 * Sanitize admin user signup data
 * Applies appropriate sanitization to all fields in the admin user object
 * Note: Password is not sanitized as it will be hashed by the backend
 *
 * @param {object} adminData - Admin user data object
 * @returns {object} - Sanitized admin user data
 */
export const sanitizeAdminData = (adminData) => {
  return {
    fullName: sanitizeInput(adminData.fullName, 100),
    email: sanitizeEmail(adminData.email),
    password: adminData.password, // Don't sanitize password - will be hashed
    phone: adminData.phone ? sanitizePhone(adminData.phone) : null
  }
}
