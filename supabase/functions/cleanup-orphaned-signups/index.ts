import { serve } from 'http/server.ts'
import { createClient } from 'supabase'

/**
 * Edge Function: cleanup-orphaned-signups
 * 
 * Cleans up abandoned organization signups where the user never verified their email.
 * This function should be called periodically via a cron job (e.g., daily).
 * 
 * What it cleans up:
 * - Organizations where the owner's email is not verified
 * - Users who signed up but never verified within the retention period
 * - Associated organization_members, organization_settings, fiscal_year_settings
 * 
 * Security:
 * - Requires a secret key to prevent unauthorized access
 * - Only deletes data older than the retention period (default: 7 days)
 */

const CLEANUP_SECRET = Deno.env.get('CLEANUP_SECRET_KEY')
const RETENTION_DAYS = parseInt(Deno.env.get('ORPHAN_RETENTION_DAYS') || '7')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CleanupStats {
  organizationsDeleted: number
  usersDeleted: number
  authUsersDeleted: number
  errors: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const stats: CleanupStats = {
    organizationsDeleted: 0,
    usersDeleted: 0,
    authUsersDeleted: 0,
    errors: [],
  }

  try {
    // Verify the cleanup secret key
    const providedSecret = req.headers.get('x-cleanup-secret')
    
    if (!CLEANUP_SECRET) {
      console.error('CLEANUP_SECRET_KEY environment variable not configured')
      return new Response(
        JSON.stringify({ error: 'Cleanup function not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    if (providedSecret !== CLEANUP_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Create admin client using service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Calculate the cutoff date (records older than this will be cleaned up)
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    
    console.log(`Starting cleanup for orphaned signups older than ${RETENTION_DAYS} days (before ${cutoffDate})`)

    // Step 1: Find auth users who:
    // - Have not verified their email
    // - Were created before the cutoff date
    // - Are organization owners (created via signup flow)
    const { data: authUsers, error: authListError } = await supabaseAdmin.auth.admin.listUsers()

    if (authListError) {
      console.error('Error listing auth users:', authListError)
      stats.errors.push(`Failed to list auth users: ${authListError.message}`)
    } else {
      const unverifiedUsers = authUsers.users.filter(user => {
        const createdAt = new Date(user.created_at)
        const cutoff = new Date(cutoffDate)
        return !user.email_confirmed_at && createdAt < cutoff
      })

      console.log(`Found ${unverifiedUsers.length} unverified auth users older than ${RETENTION_DAYS} days`)

      for (const authUser of unverifiedUsers) {
        try {
          // Check if this user has a profile in our users table
          const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('id, org_id')
            .eq('id', authUser.id)
            .maybeSingle()

          if (userProfile) {
            // Check if user is an organization owner
            const { data: ownerMembership } = await supabaseAdmin
              .from('organization_members')
              .select('organization_id')
              .eq('user_id', authUser.id)
              .eq('role', 'owner')
              .maybeSingle()

            if (ownerMembership) {
              // This user created an organization but never verified - clean up the org
              const orgId = ownerMembership.organization_id

              console.log(`Cleaning up orphaned organization ${orgId} for unverified user ${authUser.email}`)

              // Check if the org has any other verified members
              const { data: otherMembers } = await supabaseAdmin
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', orgId)
                .neq('user_id', authUser.id)

              if (!otherMembers || otherMembers.length === 0) {
                // No other members - safe to delete the org
                
                // Delete organization members
                await supabaseAdmin
                  .from('organization_members')
                  .delete()
                  .eq('organization_id', orgId)

                // Delete organization settings
                await supabaseAdmin
                  .from('organization_settings')
                  .delete()
                  .eq('org_id', orgId)

                // Delete fiscal year settings
                await supabaseAdmin
                  .from('fiscal_year_settings')
                  .delete()
                  .eq('org_id', orgId)

                // Delete user profile
                await supabaseAdmin
                  .from('users')
                  .delete()
                  .eq('id', authUser.id)
                stats.usersDeleted++

                // Delete organization
                const { error: orgDeleteError } = await supabaseAdmin
                  .from('organizations')
                  .delete()
                  .eq('id', orgId)

                if (orgDeleteError) {
                  console.error(`Failed to delete organization ${orgId}:`, orgDeleteError)
                  stats.errors.push(`Failed to delete org ${orgId}: ${orgDeleteError.message}`)
                } else {
                  stats.organizationsDeleted++
                  console.log(`Deleted orphaned organization ${orgId}`)
                }

                // Delete auth user
                const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id)
                if (authDeleteError) {
                  console.error(`Failed to delete auth user ${authUser.id}:`, authDeleteError)
                  stats.errors.push(`Failed to delete auth user ${authUser.id}: ${authDeleteError.message}`)
                } else {
                  stats.authUsersDeleted++
                  console.log(`Deleted auth user ${authUser.email}`)
                }
              } else {
                console.log(`Organization ${orgId} has other members, skipping deletion`)
              }
            } else {
              // User profile exists but they're not an owner - might be an orphaned invite
              // Only delete if they have no org membership at all
              const { data: anyMembership } = await supabaseAdmin
                .from('organization_members')
                .select('id')
                .eq('user_id', authUser.id)
                .maybeSingle()

              if (!anyMembership) {
                // Orphaned user with no org membership
                console.log(`Cleaning up orphaned user ${authUser.email} with no organization`)
                
                await supabaseAdmin
                  .from('users')
                  .delete()
                  .eq('id', authUser.id)
                stats.usersDeleted++

                await supabaseAdmin.auth.admin.deleteUser(authUser.id)
                stats.authUsersDeleted++
              }
            }
          } else {
            // Auth user with no profile - orphaned from a failed signup
            console.log(`Cleaning up orphaned auth user ${authUser.email} with no profile`)
            
            await supabaseAdmin.auth.admin.deleteUser(authUser.id)
            stats.authUsersDeleted++
          }
        } catch (userError) {
          console.error(`Error processing user ${authUser.id}:`, userError)
          stats.errors.push(`Error processing user ${authUser.id}: ${userError.message}`)
        }
      }
    }

    // Step 2: Find organizations with no members (shouldn't happen, but just in case)
    const { data: orphanedOrgs, error: orphanOrgError } = await supabaseAdmin
      .from('organizations')
      .select(`
        id,
        name,
        created_at,
        organization_members(id)
      `)
      .lt('created_at', cutoffDate)

    if (orphanOrgError) {
      console.error('Error finding orphaned organizations:', orphanOrgError)
      stats.errors.push(`Failed to find orphaned orgs: ${orphanOrgError.message}`)
    } else if (orphanedOrgs) {
      const orgsWithNoMembers = orphanedOrgs.filter(
        org => !org.organization_members || org.organization_members.length === 0
      )

      console.log(`Found ${orgsWithNoMembers.length} organizations with no members`)

      for (const org of orgsWithNoMembers) {
        try {
          console.log(`Cleaning up organization ${org.name} (${org.id}) with no members`)

          // Delete organization settings
          await supabaseAdmin
            .from('organization_settings')
            .delete()
            .eq('org_id', org.id)

          // Delete fiscal year settings
          await supabaseAdmin
            .from('fiscal_year_settings')
            .delete()
            .eq('org_id', org.id)

          // Delete organization
          const { error: orgDeleteError } = await supabaseAdmin
            .from('organizations')
            .delete()
            .eq('id', org.id)

          if (orgDeleteError) {
            console.error(`Failed to delete organization ${org.id}:`, orgDeleteError)
            stats.errors.push(`Failed to delete org ${org.id}: ${orgDeleteError.message}`)
          } else {
            stats.organizationsDeleted++
            console.log(`Deleted orphaned organization ${org.id}`)
          }
        } catch (orgError) {
          console.error(`Error deleting organization ${org.id}:`, orgError)
          stats.errors.push(`Error deleting org ${org.id}: ${orgError.message}`)
        }
      }
    }

    console.log('Cleanup completed:', stats)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Orphaned signup cleanup completed',
        stats,
        retentionDays: RETENTION_DAYS,
        cutoffDate,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Unexpected error during cleanup:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        stats,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
