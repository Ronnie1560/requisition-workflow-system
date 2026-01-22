/**
 * Tests for RequisitionSummary Component
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RequisitionSummary from './RequisitionSummary'

// Mock the formatters
vi.mock('../../utils/formatters', () => ({
  formatCurrency: (amount) => `UGX ${amount.toLocaleString()}`
}))

describe('RequisitionSummary', () => {
  describe('Rendering', () => {
    it('should render with default values', () => {
      render(<RequisitionSummary />)

      expect(screen.getByText('Total Items')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('Grand Total')).toBeInTheDocument()
      expect(screen.getByText('UGX 0')).toBeInTheDocument()
    })

    it('should display the grand total correctly', () => {
      render(<RequisitionSummary grandTotal={150000} />)

      expect(screen.getByText('UGX 150,000')).toBeInTheDocument()
    })

    it('should display item count correctly', () => {
      render(<RequisitionSummary itemCount={5} />)

      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('should display last saved time when provided', () => {
      const testDate = new Date('2025-01-15T10:30:00')
      render(<RequisitionSummary lastSaved={testDate} />)

      expect(screen.getByText('Last Saved')).toBeInTheDocument()
      // Time format may vary based on locale, so just check the text is there
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
    })

    it('should not display last saved when not provided', () => {
      render(<RequisitionSummary />)

      expect(screen.queryByText('Last Saved')).not.toBeInTheDocument()
    })
  })

  describe('Status Badge', () => {
    it('should display Draft status when isDraft is true', () => {
      render(<RequisitionSummary isDraft={true} />)

      expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('should display Submitted status when isDraft is false', () => {
      render(<RequisitionSummary isDraft={false} />)

      expect(screen.getByText('Submitted')).toBeInTheDocument()
    })

    it('should apply correct styling for Draft status', () => {
      render(<RequisitionSummary isDraft={true} />)

      const badge = screen.getByText('Draft')
      expect(badge).toHaveClass('bg-yellow-100')
    })

    it('should apply correct styling for Submitted status', () => {
      render(<RequisitionSummary isDraft={false} />)

      const badge = screen.getByText('Submitted')
      expect(badge).toHaveClass('bg-green-100')
    })
  })

  describe('Large Numbers', () => {
    it('should format large grand totals correctly', () => {
      render(<RequisitionSummary grandTotal={1500000000} />)

      expect(screen.getByText('UGX 1,500,000,000')).toBeInTheDocument()
    })

    it('should display large item counts', () => {
      render(<RequisitionSummary itemCount={999} />)

      expect(screen.getByText('999')).toBeInTheDocument()
    })
  })

  describe('Combined Props', () => {
    it('should display all information together', () => {
      const testDate = new Date('2025-01-15T14:45:00')

      render(
        <RequisitionSummary
          grandTotal={250000}
          itemCount={3}
          lastSaved={testDate}
          isDraft={true}
        />
      )

      expect(screen.getByText('UGX 250,000')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Draft')).toBeInTheDocument()
      expect(screen.getByText('Last Saved')).toBeInTheDocument()
    })
  })
})
