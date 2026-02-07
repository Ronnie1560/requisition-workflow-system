/**
 * Tests for RequisitionActionButtons Component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RequisitionActionButtons from './RequisitionActionButtons'

// Mock the SaveTemplateModal
vi.mock('./SaveTemplateModal', () => ({
  default: ({ isOpen, onClose, onSave }) => 
    isOpen ? (
      <div data-testid="template-modal">
        <button onClick={() => onSave({ template_name: 'Test Template' })}>
          Save Template
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const defaultProps = {
  onSaveDraft: vi.fn(),
  onSubmit: vi.fn(),
  onSaveTemplate: vi.fn()
}

const renderComponent = (props = {}) => {
  return render(
    <BrowserRouter>
      <RequisitionActionButtons {...defaultProps} {...props} />
    </BrowserRouter>
  )
}

describe('RequisitionActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render Cancel button', () => {
      renderComponent()

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should render Save as Template button', () => {
      renderComponent()

      expect(screen.getByRole('button', { name: /save as template/i })).toBeInTheDocument()
    })

    it('should render Save Draft button', () => {
      renderComponent()

      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
    })

    it('should render Submit button when isDraft and hasRequisitionId', () => {
      renderComponent({ isDraft: true, hasRequisitionId: true })

      expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument()
    })

    it('should NOT render Submit button when no requisitionId', () => {
      renderComponent({ isDraft: true, hasRequisitionId: false })

      expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument()
    })

    it('should NOT render Submit button when not a draft', () => {
      renderComponent({ isDraft: false, hasRequisitionId: true })

      expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument()
    })

    it('should show Update Draft text when hasRequisitionId', () => {
      renderComponent({ hasRequisitionId: true })

      expect(screen.getByRole('button', { name: /update draft/i })).toBeInTheDocument()
    })
  })

  describe('Button Interactions', () => {
    it('should call onSaveDraft when Save Draft is clicked', () => {
      const onSaveDraft = vi.fn()
      renderComponent({ onSaveDraft })

      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

      expect(onSaveDraft).toHaveBeenCalledWith(false)
    })

    it('should call onSubmit when Submit is clicked and confirmed', async () => {
      const onSubmit = vi.fn()
      renderComponent({ onSubmit, isDraft: true, hasRequisitionId: true })

      // Click submit to open confirmation dialog
      fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

      // Confirm in the dialog
      await waitFor(() => {
        expect(screen.getByText(/submit requisition for review/i)).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /^yes, submit$/i }))

      expect(onSubmit).toHaveBeenCalled()
    })

    it('should navigate to requisitions on Cancel click', () => {
      renderComponent()

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockNavigate).toHaveBeenCalledWith('/requisitions')
    })

    it('should open template modal when Save as Template is clicked', () => {
      renderComponent()

      fireEvent.click(screen.getByRole('button', { name: /save as template/i }))

      expect(screen.getByTestId('template-modal')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should show Saving... text when saving', () => {
      renderComponent({ saving: true })

      expect(screen.getByText(/saving/i)).toBeInTheDocument()
    })

    it('should show Submitting... text when loading', () => {
      renderComponent({ loading: true, isDraft: true, hasRequisitionId: true })

      expect(screen.getByText(/submitting/i)).toBeInTheDocument()
    })

    it('should disable all buttons when loading', () => {
      renderComponent({ loading: true, isDraft: true, hasRequisitionId: true })

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /save as template/i })).toBeDisabled()
    })

    it('should disable all buttons when saving', () => {
      renderComponent({ saving: true })

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /save as template/i })).toBeDisabled()
    })
  })

  describe('Disabled State', () => {
    it('should disable action buttons when disabled prop is true', () => {
      renderComponent({ disabled: true, isDraft: true, hasRequisitionId: true })

      expect(screen.getByRole('button', { name: /save as template/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /update draft/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /submit for review/i })).toBeDisabled()
    })

    it('should NOT disable Cancel button when disabled', () => {
      renderComponent({ disabled: true })

      // Cancel should still work to allow leaving the form
      expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
    })
  })

  describe('Template Modal', () => {
    it('should close modal when close is clicked', async () => {
      renderComponent()

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: /save as template/i }))
      expect(screen.getByTestId('template-modal')).toBeInTheDocument()

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: /close/i }))

      await waitFor(() => {
        expect(screen.queryByTestId('template-modal')).not.toBeInTheDocument()
      })
    })

    it('should call onSaveTemplate when template is saved', async () => {
      const onSaveTemplate = vi.fn()
      renderComponent({ onSaveTemplate })

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: /save as template/i }))

      // Save template
      fireEvent.click(screen.getByRole('button', { name: /save template/i }))

      await waitFor(() => {
        expect(onSaveTemplate).toHaveBeenCalledWith({ template_name: 'Test Template' })
      })
    })
  })
})
