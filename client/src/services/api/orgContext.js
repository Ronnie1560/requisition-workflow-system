/**
 * Organization Context Helper
 * Gets the currently selected organization ID for filtering queries
 */

// Track if we've already logged the warning to avoid console spam
let hasLoggedNoOrgWarning = false

/**
 * Get the currently selected organization ID from localStorage
 * This is used to filter all queries by the active organization
 */
export const getCurrentOrgId = () => {
  const orgId = localStorage.getItem('pcm_selected_org_id')
  if (!orgId && !hasLoggedNoOrgWarning) {
    // Only log once per session to avoid console spam during initial load
    console.debug('[orgContext] No organization selected yet - this is normal during initial load')
    hasLoggedNoOrgWarning = true
  }
  return orgId
}

/**
 * Reset the warning flag (call this on logout)
 */
export const resetOrgWarningFlag = () => {
  hasLoggedNoOrgWarning = false
}

/**
 * Add organization filter to a Supabase query
 * Usage: applyOrgFilter(supabase.from('projects').select('*'))
 */
export const applyOrgFilter = (query) => {
  const orgId = getCurrentOrgId()
  if (!orgId) {
    throw new Error('No organization selected. Please select an organization first.')
  }
  return query.eq('org_id', orgId)
}

/**
 * Check if an organization is currently selected
 */
export const hasSelectedOrg = () => {
  return !!localStorage.getItem('pcm_selected_org_id')
}
