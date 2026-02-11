/**
 * Tests for RequisitionMetadataForm Component
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import RequisitionMetadataForm from './RequisitionMetadataForm'

// Mock the logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

const mockFormData = {
  title: '',
  project_id: '',
  expense_account_id: '',
  description: '',
  justification: '',
  required_by: '',
  delivery_location: '',
  supplier_preference: '',
  is_urgent: false
}

const mockProjects = [
  { id: 'proj-1', code: 'PRJ001', name: 'Project Alpha' },
  { id: 'proj-2', code: 'PRJ002', name: 'Project Beta' }
]

const mockExpenseAccounts = [
  { id: 'exp-1', code: 'EXP001', name: 'Office Supplies', project_id: 'proj-1' },
  { id: 'exp-2', code: 'EXP002', name: 'Equipment', project_id: 'proj-1' },
  { id: 'exp-3', code: 'EXP003', name: 'Travel', project_id: 'proj-2' }
]

describe('RequisitionMetadataForm', () => {
  describe('Rendering', () => {
    it('should render the form with all fields', () => {
      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={vi.fn()}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      // Check for main title
      expect(screen.getByText('Requisition Details')).toBeInTheDocument()

      // Check for field labels
      expect(screen.getByLabelText(/Requisition Title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Project/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Expense Account/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Urgent Request/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Required By Date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Delivery Location/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Preferred Supplier/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Description$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Business Justification/i)).toBeInTheDocument()
    })

    it('should render project options in dropdown', () => {
      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={vi.fn()}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      const projectSelect = screen.getByLabelText(/^Project/i)
      expect(projectSelect).toBeInTheDocument()

      // Open dropdown to see options
      fireEvent.click(projectSelect)

      // Check that project options are rendered
      expect(screen.getByText('PRJ001 - Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('PRJ002 - Project Beta')).toBeInTheDocument()
    })

    it('should show loading states for dropdowns', () => {
      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={vi.fn()}
          projects={[]}
          expenseAccounts={[]}
          loadingProjects={true}
          loadingExpenseAccounts={true}
        />
      )

      expect(screen.getByText('Loading projects...')).toBeInTheDocument()
    })

    it('should disable expense account when no project selected', () => {
      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={vi.fn()}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      const expenseSelect = screen.getByLabelText(/Expense Account/i)
      expect(expenseSelect).toBeDisabled()
      expect(screen.getByText('Select a project first')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should call onChange when title is typed', () => {
      const handleChange = vi.fn()

      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={handleChange}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      const titleInput = screen.getByLabelText(/Requisition Title/i)
      fireEvent.change(titleInput, { target: { value: 'New Requisition' } })

      expect(handleChange).toHaveBeenCalled()
    })

    it('should call onChange when project is selected', () => {
      const handleChange = vi.fn()

      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={handleChange}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      // Open the project dropdown and click an option
      const projectSelect = screen.getByLabelText(/^Project/i)
      fireEvent.click(projectSelect)
      fireEvent.click(screen.getByText('PRJ001 - Project Alpha'))

      expect(handleChange).toHaveBeenCalled()
    })

    it('should call onChange when urgent checkbox is clicked', () => {
      const handleChange = vi.fn()

      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={handleChange}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      const urgentCheckbox = screen.getByLabelText(/Urgent Request/i)
      fireEvent.click(urgentCheckbox)

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('Expense Account Filtering', () => {
    it('should filter expense accounts by selected project', () => {
      const formDataWithProject = {
        ...mockFormData,
        project_id: 'proj-1'
      }

      render(
        <RequisitionMetadataForm
          formData={formDataWithProject}
          onChange={vi.fn()}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      // Open the expense account dropdown
      const expenseSelect = screen.getByLabelText(/Expense Account/i)
      fireEvent.click(expenseSelect)

      // Should show accounts for proj-1 only
      expect(screen.getByText('EXP001 - Office Supplies')).toBeInTheDocument()
      expect(screen.getByText('EXP002 - Equipment')).toBeInTheDocument()
      
      // Should NOT show account for proj-2
      expect(screen.queryByText('EXP003 - Travel')).not.toBeInTheDocument()
    })

    it('should enable expense account dropdown when project is selected', () => {
      const formDataWithProject = {
        ...mockFormData,
        project_id: 'proj-1'
      }

      render(
        <RequisitionMetadataForm
          formData={formDataWithProject}
          onChange={vi.fn()}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      const expenseSelect = screen.getByLabelText(/Expense Account/i)
      expect(expenseSelect).not.toBeDisabled()
    })
  })

  describe('Disabled State', () => {
    it('should disable all fields when disabled prop is true', () => {
      render(
        <RequisitionMetadataForm
          formData={mockFormData}
          onChange={vi.fn()}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
          disabled={true}
        />
      )

      expect(screen.getByLabelText(/Requisition Title/i)).toBeDisabled()
      expect(screen.getByLabelText(/^Project/i)).toBeDisabled()
      expect(screen.getByLabelText(/Urgent Request/i)).toBeDisabled()
      expect(screen.getByLabelText(/Required By Date/i)).toBeDisabled()
      expect(screen.getByLabelText(/Delivery Location/i)).toBeDisabled()
      expect(screen.getByLabelText(/Preferred Supplier/i)).toBeDisabled()
      expect(screen.getByLabelText(/^Description$/i)).toBeDisabled()
      expect(screen.getByLabelText(/Business Justification/i)).toBeDisabled()
    })
  })

  describe('Pre-filled Values', () => {
    it('should display pre-filled form values', () => {
      const filledFormData = {
        title: 'Office Supplies Q1',
        project_id: 'proj-1',
        expense_account_id: 'exp-1',
        description: 'Monthly office supplies',
        justification: 'Required for operations',
        required_by: '2025-03-15',
        delivery_location: 'Main Office',
        supplier_preference: 'Staples',
        is_urgent: true
      }

      render(
        <RequisitionMetadataForm
          formData={filledFormData}
          onChange={vi.fn()}
          projects={mockProjects}
          expenseAccounts={mockExpenseAccounts}
        />
      )

      expect(screen.getByLabelText(/Requisition Title/i)).toHaveValue('Office Supplies Q1')
      expect(screen.getByLabelText(/^Description$/i)).toHaveValue('Monthly office supplies')
      expect(screen.getByLabelText(/Business Justification/i)).toHaveValue('Required for operations')
      expect(screen.getByLabelText(/Delivery Location/i)).toHaveValue('Main Office')
      expect(screen.getByLabelText(/Preferred Supplier/i)).toHaveValue('Staples')
      expect(screen.getByLabelText(/Urgent Request/i)).toBeChecked()
    })
  })
})
