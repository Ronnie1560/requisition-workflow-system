import type { SupabaseClient } from 'supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Read the active org claim injected by custom_access_token_hook.
// Only call this AFTER auth.getUser() has validated the token.
const getActiveOrgIdFromJwt = (authHeader: string | null): string | null => {
  try {
    const payload = (authHeader ?? '').replace(/^Bearer\s+/i, '').split('.')[1]
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
    return claims?.app_metadata?.org_id ?? claims?.org_id ?? null
  } catch {
    return null
  }
}

export type OrgAdminCheck =
  | { ok: true; orgId: string }
  | { ok: false; status: number; error: string }

/**
 * Resolve the org the caller is acting in (request body orgId, else the
 * JWT active-org claim) and verify the caller is an active admin/owner or
 * super_admin of THAT org via organization_members.
 *
 * Never use users.role / users.org_id for authorization: they are legacy
 * global columns and not tied to the org being acted on.
 */
export const requireOrgAdmin = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  authHeader: string | null,
  requestedOrgId: unknown,
): Promise<OrgAdminCheck> => {
  const orgId = typeof requestedOrgId === 'string' && requestedOrgId
    ? requestedOrgId
    : getActiveOrgIdFromJwt(authHeader)

  if (!orgId || !UUID_RE.test(orgId)) {
    return { ok: false, status: 403, error: 'Forbidden: No active organization selected' }
  }

  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('role, workflow_role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  const isOrgAdmin = !!membership && ['admin', 'owner'].includes(membership.role)
  const isSuperAdmin = membership?.workflow_role === 'super_admin'

  if (!isOrgAdmin && !isSuperAdmin) {
    return { ok: false, status: 403, error: 'Forbidden: Organization admin access required' }
  }

  return { ok: true, orgId }
}
