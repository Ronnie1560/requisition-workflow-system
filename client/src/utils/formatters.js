import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { DATE_FORMAT, DATETIME_FORMAT, CURRENCY_SYMBOL } from './constants'
import { logger } from './logger'

/**
 * Format a date string or Date object to a readable format
 * @param {string|Date} date - Date to format
 * @param {string} formatString - Optional format string (defaults to DATE_FORMAT)
 * @returns {string} Formatted date string
 */
export const formatDate = (date, formatString = DATE_FORMAT) => {
  if (!date) return '-'

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    return format(dateObj, formatString)
  } catch (error) {
    logger.error('Error formatting date:', error)
    return '-'
  }
}

/**
 * Format a date-time string or Date object to a readable format
 * @param {string|Date} datetime - DateTime to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (datetime) => {
  return formatDate(datetime, DATETIME_FORMAT)
}

/**
 * Format a date to relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return '-'

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    return formatDistanceToNow(dateObj, { addSuffix: true })
  } catch (error) {
    logger.error('Error formatting relative time:', error)
    return '-'
  }
}

/**
 * Format a number as currency (UGX)
 * @param {number} amount - Amount to format
 * @param {boolean} showSymbol - Whether to show currency symbol
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, showSymbol = true) => {
  if (amount === null || amount === undefined) return '-'

  try {
    const formatted = new Intl.NumberFormat('en-UG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)

    return showSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted
  } catch (error) {
    logger.error('Error formatting currency:', error)
    return '-'
  }
}

/**
 * Format a number with thousands separators
 * @param {number} number - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export const formatNumber = (number, decimals = 0) => {
  if (number === null || number === undefined) return '-'

  try {
    return new Intl.NumberFormat('en-UG', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number)
  } catch (error) {
    logger.error('Error formatting number:', error)
    return '-'
  }
}

/**
 * Format a file size in bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  if (!bytes) return '-'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Truncate text to a specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '-'
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * Format a phone number for Uganda
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '-'

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // Format as +256 XXX XXX XXX
  if (cleaned.length === 12 && cleaned.startsWith('256')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`
  }

  // Format as 0XXX XXX XXX
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }

  return phone
}

/**
 * Parse a formatted currency string back to a number
 * @param {string} currencyString - Formatted currency string
 * @returns {number} Parsed number
 */
export const parseCurrency = (currencyString) => {
  if (!currencyString) return 0

  // Remove currency symbol and spaces, then parse
  const cleaned = currencyString.replace(/[^\d.-]/g, '')
  return parseFloat(cleaned) || 0
}
