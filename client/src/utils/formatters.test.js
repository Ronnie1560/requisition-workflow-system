/**
 * Formatters Utility Tests
 * PCM Requisition System
 */

import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  formatFileSize,
  truncateText,
  formatPhoneNumber,
  parseCurrency,
} from './formatters.js'

describe('Formatters Utility', () => {
  describe('formatDate', () => {
    it('should format ISO date string correctly', () => {
      const result = formatDate('2026-01-15T10:30:00Z')
      expect(result).toBeTruthy()
      expect(result).not.toBe('-')
    })

    it('should return "-" for null date', () => {
      expect(formatDate(null)).toBe('-')
    })

    it('should return "-" for undefined date', () => {
      expect(formatDate(undefined)).toBe('-')
    })

    it('should return "-" for empty string', () => {
      expect(formatDate('')).toBe('-')
    })

    it('should handle Date objects', () => {
      const date = new Date('2026-01-15')
      const result = formatDate(date)
      expect(result).toBeTruthy()
      expect(result).not.toBe('-')
    })
  })

  describe('formatDateTime', () => {
    it('should format ISO datetime string correctly', () => {
      const result = formatDateTime('2026-01-15T10:30:00Z')
      expect(result).toBeTruthy()
      expect(result).not.toBe('-')
    })

    it('should return "-" for null datetime', () => {
      expect(formatDateTime(null)).toBe('-')
    })

    it('should return "-" for undefined datetime', () => {
      expect(formatDateTime(undefined)).toBe('-')
    })
  })

  describe('formatRelativeTime', () => {
    it('should return relative time string', () => {
      // Use a recent date that is definitely in the past
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      const result = formatRelativeTime(pastDate.toISOString())
      expect(result).toContain('ago')
    })

    it('should return "-" for null date', () => {
      expect(formatRelativeTime(null)).toBe('-')
    })

    it('should return "-" for undefined date', () => {
      expect(formatRelativeTime(undefined)).toBe('-')
    })
  })

  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      const result = formatCurrency(1000)
      expect(result).toContain('1,000')
    })

    it('should format zero correctly', () => {
      const result = formatCurrency(0)
      expect(result).toContain('0')
    })

    it('should format large numbers with separators', () => {
      const result = formatCurrency(1000000)
      expect(result).toContain('1,000,000')
    })

    it('should return "-" for null amount', () => {
      expect(formatCurrency(null)).toBe('-')
    })

    it('should return "-" for undefined amount', () => {
      expect(formatCurrency(undefined)).toBe('-')
    })

    it('should hide symbol when showSymbol is false', () => {
      const withSymbol = formatCurrency(1000, true)
      const withoutSymbol = formatCurrency(1000, false)
      expect(withSymbol.length).toBeGreaterThan(withoutSymbol.length)
    })

    it('should handle negative numbers', () => {
      const result = formatCurrency(-1000)
      expect(result).toContain('1,000')
    })
  })

  describe('formatNumber', () => {
    it('should format integer correctly', () => {
      const result = formatNumber(1000)
      expect(result).toBe('1,000')
    })

    it('should format with decimals when specified', () => {
      const result = formatNumber(1000.5, 2)
      expect(result).toContain('1,000')
    })

    it('should format zero correctly', () => {
      expect(formatNumber(0)).toBe('0')
    })

    it('should return "-" for null number', () => {
      expect(formatNumber(null)).toBe('-')
    })

    it('should return "-" for undefined number', () => {
      expect(formatNumber(undefined)).toBe('-')
    })

    it('should format large numbers', () => {
      const result = formatNumber(1234567890)
      expect(result).toBe('1,234,567,890')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 Bytes')
    })

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
    })

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })

    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
    })

    it('should return "-" for null', () => {
      expect(formatFileSize(null)).toBe('-')
    })

    it('should return "-" for undefined', () => {
      expect(formatFileSize(undefined)).toBe('-')
    })

    it('should format fractional sizes', () => {
      const result = formatFileSize(1536)
      expect(result).toBe('1.5 KB')
    })
  })

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated'
      const result = truncateText(longText, 20)
      expect(result).toBe('This is a very long ...')
      expect(result.length).toBe(23)
    })

    it('should not truncate short text', () => {
      const shortText = 'Short text'
      const result = truncateText(shortText, 20)
      expect(result).toBe('Short text')
    })

    it('should return "-" for null', () => {
      expect(truncateText(null)).toBe('-')
    })

    it('should return "-" for undefined', () => {
      expect(truncateText(undefined)).toBe('-')
    })

    it('should return "-" for empty string', () => {
      expect(truncateText('')).toBe('-')
    })

    it('should handle exact length text', () => {
      const exactText = '12345678901234567890'
      const result = truncateText(exactText, 20)
      expect(result).toBe(exactText)
    })

    it('should use default maxLength of 50', () => {
      const text = 'a'.repeat(60)
      const result = truncateText(text)
      expect(result).toBe('a'.repeat(50) + '...')
    })
  })

  describe('formatPhoneNumber', () => {
    it('should format Uganda international format', () => {
      const result = formatPhoneNumber('256712345678')
      expect(result).toBe('+256 712 345 678')
    })

    it('should format Uganda local format', () => {
      const result = formatPhoneNumber('0712345678')
      expect(result).toBe('0712 345 678')
    })

    it('should return "-" for null', () => {
      expect(formatPhoneNumber(null)).toBe('-')
    })

    it('should return "-" for undefined', () => {
      expect(formatPhoneNumber(undefined)).toBe('-')
    })

    it('should return "-" for empty string', () => {
      expect(formatPhoneNumber('')).toBe('-')
    })

    it('should return original for unrecognized format', () => {
      const phone = '12345'
      expect(formatPhoneNumber(phone)).toBe(phone)
    })

    it('should handle phone with special characters', () => {
      const result = formatPhoneNumber('+256-712-345-678')
      expect(result).toBe('+256 712 345 678')
    })
  })

  describe('parseCurrency', () => {
    it('should parse formatted currency string', () => {
      expect(parseCurrency('UGX 1,000')).toBe(1000)
    })

    it('should parse currency without symbol', () => {
      expect(parseCurrency('1,000')).toBe(1000)
    })

    it('should parse large numbers', () => {
      expect(parseCurrency('UGX 1,000,000')).toBe(1000000)
    })

    it('should return 0 for null', () => {
      expect(parseCurrency(null)).toBe(0)
    })

    it('should return 0 for undefined', () => {
      expect(parseCurrency(undefined)).toBe(0)
    })

    it('should return 0 for empty string', () => {
      expect(parseCurrency('')).toBe(0)
    })

    it('should handle decimal values', () => {
      expect(parseCurrency('1,234.56')).toBe(1234.56)
    })

    it('should handle negative values', () => {
      expect(parseCurrency('-1,000')).toBe(-1000)
    })
  })
})
