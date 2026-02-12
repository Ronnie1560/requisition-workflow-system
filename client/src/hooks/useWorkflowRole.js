import { useOrganization } from '../context/OrganizationContext'
import { useAuth } from '../context/AuthContext'

/**
 * Hook to get the current user's workflow role for the active organization.
 * 
 * This is the PRIMARY way to check user permissions for workflow operations
 * (review, approve, manage stores, etc.).
 * 
 * The workflow role is per-organization — a user can be a reviewer in one org
 * and a submitter in another. This replaces the old global `users.role`.
 * 
 * @returns {{
 *   workflowRole: string,
 *   isAdmin: boolean,
 *   isReviewer: boolean,
 *   isApprover: boolean,
 *   isStoreManager: boolean,
 *   isSubmitter: boolean
 * }}
 */
export function useWorkflowRole() {
  const { currentOrg } = useOrganization()
  const { profile } = useAuth()

  // Primary: org-scoped workflow role from organization_members
  // Fallback: legacy users.role (for backward compatibility during migration)
  const workflowRole = currentOrg?.workflow_role || profile?.role || 'submitter'

  const isAdmin = workflowRole === 'super_admin'
  const isReviewer = workflowRole === 'reviewer' || isAdmin
  const isApprover = workflowRole === 'approver' || isAdmin
  const isStoreManager = workflowRole === 'store_manager' || isAdmin
  const isSubmitter = workflowRole === 'submitter' || isAdmin

  return {
    workflowRole,
    isAdmin,
    isReviewer,
    isApprover,
    isStoreManager,
    isSubmitter
  }
}
