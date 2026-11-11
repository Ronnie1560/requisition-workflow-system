import type { SupabaseClient, User } from 'supabase'

// auth.admin.listUsers() returns one page (50 users by default), so any
// lookup that reads only the first page silently misses everyone after it.
const PER_PAGE = 1000
// Safety stop in case the API ever ignores `page` and returns full pages forever.
const MAX_PAGES = 1000

/** Yield every auth user, one page at a time. Throws on an API error. */
export async function* iterateAuthUsers(admin: SupabaseClient): AsyncGenerator<User[]> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw error

    const users = data?.users ?? []
    if (users.length > 0) yield users
    if (users.length < PER_PAGE) return
  }
  throw new Error(`Auth user listing exceeded ${MAX_PAGES} pages`)
}

/**
 * Every auth user. Collect the full list before deleting any of them:
 * deleting while paging shifts later users onto earlier pages and skips them.
 */
export const listAllAuthUsers = async (admin: SupabaseClient): Promise<User[]> => {
  const all: User[] = []
  for await (const users of iterateAuthUsers(admin)) all.push(...users)
  return all
}

/** The auth user with this email (case-insensitive), or null. Stops at the first match. */
export const findAuthUserByEmail = async (
  admin: SupabaseClient,
  email: string,
): Promise<User | null> => {
  const target = email.trim().toLowerCase()
  for await (const users of iterateAuthUsers(admin)) {
    const match = users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match
  }
  return null
}
