/**
 * Logger Utility Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, LogLevel } from './logger.js'

describe('Logger Utility', () => {
  let consoleSpy = {}

  beforeEach(() => {
    // Spy on console methods
    consoleSpy.error = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleSpy.warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleSpy.info = vi.spyOn(console, 'info').mockImplementation(() => {})
    consoleSpy.log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks()
  })

  describe('LogLevel', () => {
    it('should export correct log levels', () => {
      expect(LogLevel.ERROR).toBe('error')
      expect(LogLevel.WARN).toBe('warn')
      expect(LogLevel.INFO).toBe('info')
      expect(LogLevel.DEBUG).toBe('debug')
    })
  })

  describe('logger.error', () => {
    it('should be a function', () => {
      expect(typeof logger.error).toBe('function')
    })

    it('should call console.error with message', () => {
      logger.error('Test error message')
      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('should include the message in the output', () => {
      logger.error('Test error message')
      const call = consoleSpy.error.mock.calls[0]
      expect(call.some(arg => 
        typeof arg === 'string' && arg.includes('Test error message')
      )).toBe(true)
    })

    it('should handle additional arguments', () => {
      const errorObj = new Error('Test error')
      logger.error('Error occurred', errorObj)
      expect(consoleSpy.error).toHaveBeenCalled()
    })
  })

  describe('logger.warn', () => {
    it('should be a function', () => {
      expect(typeof logger.warn).toBe('function')
    })

    it('should not throw when called', () => {
      expect(() => logger.warn('Test warning')).not.toThrow()
    })
  })

  describe('logger.info', () => {
    it('should be a function', () => {
      expect(typeof logger.info).toBe('function')
    })

    it('should not throw when called', () => {
      expect(() => logger.info('Test info')).not.toThrow()
    })
  })

  describe('logger.debug', () => {
    it('should be a function', () => {
      expect(typeof logger.debug).toBe('function')
    })

    it('should not throw when called', () => {
      expect(() => logger.debug('Test debug')).not.toThrow()
    })
  })

  describe('logger.trace', () => {
    it('should be a function', () => {
      expect(typeof logger.trace).toBe('function')
    })

    it('should not throw when called', () => {
      expect(() => logger.trace('functionName', { arg: 'value' })).not.toThrow()
    })
  })

  describe('logger.traceEnd', () => {
    it('should be a function', () => {
      expect(typeof logger.traceEnd).toBe('function')
    })

    it('should not throw when called', () => {
      expect(() => logger.traceEnd('functionName', { result: 'value' })).not.toThrow()
    })
  })

  describe('Logger object', () => {
    it('should have all required methods', () => {
      expect(logger).toHaveProperty('error')
      expect(logger).toHaveProperty('warn')
      expect(logger).toHaveProperty('info')
      expect(logger).toHaveProperty('debug')
      expect(logger).toHaveProperty('trace')
      expect(logger).toHaveProperty('traceEnd')
    })
  })
})
