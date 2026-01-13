/**
 * Organization Context Helper
 * Gets the currently selected organization ID for filtering queries
 */

/**
 * Get the currently selected organization ID from localStorage
 * This is used to filter all queries by the active organization
 */
export const getCurrentOrgId = () => {
  const orgId = localStorage.getItem('pcm_selected_org_id')
  if (!orgId) {
    console.warn('[orgContext] No organization selected - queries may fail')
  }
  return orgId
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
