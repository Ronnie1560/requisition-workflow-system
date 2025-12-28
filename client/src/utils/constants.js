// Requisition Status Constants (must match database ENUM)
export const REQUISITION_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  PARTIALLY_RECEIVED: 'partially_received',
  COMPLETED: 'completed'
}

// Status Display Labels
export const STATUS_LABELS = {
  [REQUISITION_STATUS.DRAFT]: 'Draft',
  [REQUISITION_STATUS.PENDING]: 'Pending Review',
  [REQUISITION_STATUS.REVIEWED]: 'Pending Approval',
  [REQUISITION_STATUS.UNDER_REVIEW]: 'Under Review',
  [REQUISITION_STATUS.APPROVED]: 'Approved',
  [REQUISITION_STATUS.REJECTED]: 'Rejected',
  [REQUISITION_STATUS.CANCELLED]: 'Cancelled',
  [REQUISITION_STATUS.PARTIALLY_RECEIVED]: 'Partially Received',
  [REQUISITION_STATUS.COMPLETED]: 'Completed'
}

// Status Colors (matching Tailwind config)
export const STATUS_COLORS = {
  [REQUISITION_STATUS.DRAFT]: 'status-draft',
  [REQUISITION_STATUS.PENDING]: 'status-pending',
  [REQUISITION_STATUS.REVIEWED]: 'status-approval',
  [REQUISITION_STATUS.UNDER_REVIEW]: 'status-approval',
  [REQUISITION_STATUS.APPROVED]: 'status-approved',
  [REQUISITION_STATUS.REJECTED]: 'status-rejected',
  [REQUISITION_STATUS.CANCELLED]: 'status-rejected',
  [REQUISITION_STATUS.PARTIALLY_RECEIVED]: 'status-receiving',
  [REQUISITION_STATUS.COMPLETED]: 'status-closed'
}

// User Roles (must match database ENUM)
export const USER_ROLES = {
  SUBMITTER: 'submitter',
  REVIEWER: 'reviewer',
  APPROVER: 'approver',
  STORE_MANAGER: 'store_manager',
  SUPER_ADMIN: 'super_admin'
}

// Role Display Labels
export const ROLE_LABELS = {
  [USER_ROLES.SUBMITTER]: 'Submitter',
  [USER_ROLES.REVIEWER]: 'Reviewer',
  [USER_ROLES.APPROVER]: 'Approver',
  [USER_ROLES.STORE_MANAGER]: 'Store Manager',
  [USER_ROLES.SUPER_ADMIN]: 'Super Administrator'
}

// Requisition Types
export const REQUISITION_TYPES = {
  PURCHASE: 'purchase',
  EXPENSE: 'expense',
  PETTY_CASH: 'petty_cash'
}

// Requisition Type Labels
export const REQUISITION_TYPE_LABELS = {
  [REQUISITION_TYPES.PURCHASE]: 'Purchase Requisition',
  [REQUISITION_TYPES.EXPENSE]: 'Expense Claim',
  [REQUISITION_TYPES.PETTY_CASH]: 'Petty Cash Request'
}

// Currency
export const DEFAULT_CURRENCY = 'UGX'
export const CURRENCY_SYMBOL = 'UGX'

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// Date Formats
export const DATE_FORMAT = 'dd/MM/yyyy'
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm'
export const API_DATE_FORMAT = 'yyyy-MM-dd'
