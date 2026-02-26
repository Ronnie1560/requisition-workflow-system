/**
 * Organizations API Service Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getUserOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationMembers,
  inviteUserToOrganization,
  removeMember,
  updateMemberRole,
  setOrganizationContext,
  getCurrentOrganizationId,
  clearOrganizationContext,
  // eslint-disable-next-line no-unused-vars
  getOrganizationStats,
  // eslint-disable-next-line no-unused-vars
  checkOrganizationLimits
} from './organizations.js'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

// Track mock calls
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()

// Mock Supabase
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: (table) => {
        mockFrom(table)

        const createFullChain = () => ({
          select: (...args) => {
            mockSelect(...args)
            return createFullChain()
          },
          eq: (field, value) => {
            mockEq(field, value)
            return createFullChain()
          },
          order: (field, opts) => {
            mockOrder(field, opts)
            return createFullChain()
          },
          single: () => mockSingle(),
          then: (resolve) => mockSingle().then(resolve),
          insert: (data) => {
            mockInsert(data)
            return createFullChain()
          },
          update: (data) => {
            mockUpdate(data)
            return createFullChain()
          },
          delete: () => {
            mockDelete()
            return createFullChain()
          }
        })

        return createFullChain()
      },
      rpc: (fnName, params) => {
        mockRpc(fnName, params)
        return mockSingle()
      }
    }
  }
})

describe('Organizations API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: null, error: null })
    localStorage.clear()
  })

  // =====================================================
  // ORGANIZATION OPERATIONS
  // =====================================================

  describe('getUserOrganizations', () => {
    it('fetches organizations the user belongs to', async () => {
      const mockData = [
        {
          id: 'member-1',
          role: 'owner',
          joined_at: '2024-01-01',
          organization: { id: 'org-1', name: 'Org One', slug: 'org-one', plan: 'free', status: 'active' }
        },
        {
          id: 'member-2',
          role: 'member',
          joined_at: '2024-02-01',
          organization: { id: 'org-2', name: 'Org Two', slug: 'org-two', plan: 'pro', status: 'active' }
        }
      ]
      mockSingle.mockResolvedValue({ data: mockData, error: null })

      const result = await getUserOrganizations()

      expect(mockFrom).toHaveBeenCalledWith('organization_members')
      expect(mockOrder).toHaveBeenCalledWith('joined_at', { ascending: true })
      expect(result.data).toEqual([
        { id: 'org-1', name: 'Org One', slug: 'org-one', plan: 'free', status: 'active', memberRole: 'owner', memberId: 'member-1' },
        { id: 'org-2', name: 'Org Two', slug: 'org-two', plan: 'pro', status: 'active', memberRole: 'member', memberId: 'member-2' }
      ])
      expect(result.error).toBeNull()
    })

    it('returns empty array when no organizations found', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      const result = await getUserOrganizations()

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('returns error on failure', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Database error') })

      const result = await getUserOrganizations()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Database error')
    })
  })

  describe('getOrganizationById', () => {
    it('fetches a single organization with members', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Org',
        organization_members: [{ id: 'member-1', role: 'owner' }]
      }
      mockSingle.mockResolvedValue({ data: mockOrg, error: null })

      const result = await getOrganizationById('org-1')

      expect(mockFrom).toHaveBeenCalledWith('organizations')
      expect(mockEq).toHaveBeenCalledWith('id', 'org-1')
      expect(result.data).toEqual(mockOrg)
      expect(result.error).toBeNull()
    })

    it('returns error when org not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Not found') })

      const result = await getOrganizationById('nonexistent')

      expect(result.data).toBeNull()
      expect(result.error).toBe('Not found')
    })
  })

  describe('createOrganization', () => {
    it('creates organization via RPC', async () => {
      const orgData = { name: 'New Org', slug: 'new-org', email: 'admin@new.org', plan: 'pro' }
      mockSingle.mockResolvedValue({ data: { id: 'new-org-id' }, error: null })

      const result = await createOrganization(orgData)

      expect(mockRpc).toHaveBeenCalledWith('create_organization', {
        p_name: 'New Org',
        p_slug: 'new-org',
        p_email: 'admin@new.org',
        p_plan: 'pro'
      })
      expect(result.data).toEqual({ id: 'new-org-id' })
      expect(result.error).toBeNull()
    })

    it('defaults email to null and plan to free', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'org-id' }, error: null })

      await createOrganization({ name: 'Basic', slug: 'basic' })

      expect(mockRpc).toHaveBeenCalledWith('create_organization', {
        p_name: 'Basic',
        p_slug: 'basic',
        p_email: null,
        p_plan: 'free'
      })
    })

    it('returns error on failure', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Duplicate slug') })

      const result = await createOrganization({ name: 'Test', slug: 'existing' })

      expect(result.data).toBeNull()
      expect(result.error).toBe('Duplicate slug')
    })
  })

  describe('updateOrganization', () => {
    it('updates organization fields', async () => {
      const updates = { name: 'Updated Org' }
      const updatedOrg = { id: 'org-1', name: 'Updated Org' }
      mockSingle.mockResolvedValue({ data: updatedOrg, error: null })

      const result = await updateOrganization('org-1', updates)

      expect(mockFrom).toHaveBeenCalledWith('organizations')
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'org-1')
      expect(result.data).toEqual(updatedOrg)
      expect(result.error).toBeNull()
    })

    it('returns error on failure', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Update failed') })

      const result = await updateOrganization('org-1', { name: 'Test' })

      expect(result.data).toBeNull()
      expect(result.error).toBe('Update failed')
    })
  })

  describe('deleteOrganization', () => {
    it('deletes an organization', async () => {
      mockSingle.mockResolvedValue({ error: null })

      const result = await deleteOrganization('org-1')

      expect(mockFrom).toHaveBeenCalledWith('organizations')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'org-1')
      expect(result.error).toBeNull()
    })

    it('returns error on failure', async () => {
      mockSingle.mockResolvedValue({ error: new Error('Permission denied') })

      const result = await deleteOrganization('org-1')

      expect(result.error).toBe('Permission denied')
    })
  })

  // =====================================================
  // MEMBER OPERATIONS
  // =====================================================

  describe('getOrganizationMembers', () => {
    it('fetches members with user data', async () => {
      const mockMembers = [
        { id: 'm-1', role: 'owner', user_id: 'u-1', users: { full_name: 'Alice', email: 'alice@test.com' } },
        { id: 'm-2', role: 'member', user_id: 'u-2', users: { full_name: 'Bob', email: 'bob@test.com' } }
      ]
      mockSingle.mockResolvedValue({ data: mockMembers, error: null })

      const result = await getOrganizationMembers('org-1')

      expect(mockFrom).toHaveBeenCalledWith('organization_members')
      expect(mockEq).toHaveBeenCalledWith('organization_id', 'org-1')
      expect(mockOrder).toHaveBeenCalledWith('role', { ascending: true })
      // Verify transform: users -> user
      expect(result.data[0].user).toEqual({ full_name: 'Alice', email: 'alice@test.com' })
      expect(result.data[1].user).toEqual({ full_name: 'Bob', email: 'bob@test.com' })
    })

    it('returns error on failure', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Fetch failed') })

      const result = await getOrganizationMembers('org-1')

      expect(result.data).toBeNull()
      expect(result.error).toBe('Fetch failed')
    })
  })

  describe('inviteUserToOrganization', () => {
    it('invites user via RPC with default role', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'invite-1' }, error: null })

      const result = await inviteUserToOrganization('org-1', 'new@test.com')

      expect(mockRpc).toHaveBeenCalledWith('invite_user_to_org', {
        p_org_id: 'org-1',
        p_email: 'new@test.com',
        p_role: 'member'
      })
      expect(result.data).toEqual({ id: 'invite-1' })
    })

    it('invites user with specified role', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'invite-2' }, error: null })

      await inviteUserToOrganization('org-1', 'admin@test.com', 'admin')

      expect(mockRpc).toHaveBeenCalledWith('invite_user_to_org', {
        p_org_id: 'org-1',
        p_email: 'admin@test.com',
        p_role: 'admin'
      })
    })
  })

  describe('removeMember', () => {
    it('removes a member by ID', async () => {
      mockSingle.mockResolvedValue({ error: null })

      const result = await removeMember('member-1')

      expect(mockFrom).toHaveBeenCalledWith('organization_members')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'member-1')
      expect(result.error).toBeNull()
    })
  })

  describe('updateMemberRole', () => {
    it('updates member role', async () => {
      const updatedMember = { id: 'member-1', role: 'admin' }
      mockSingle.mockResolvedValue({ data: updatedMember, error: null })

      const result = await updateMemberRole('member-1', 'admin')

      expect(mockFrom).toHaveBeenCalledWith('organization_members')
      expect(mockUpdate).toHaveBeenCalledWith({ role: 'admin' })
      expect(mockEq).toHaveBeenCalledWith('id', 'member-1')
      expect(result.data).toEqual(updatedMember)
    })
  })

  // =====================================================
  // ORGANIZATION CONTEXT HELPERS
  // =====================================================

  describe('setOrganizationContext', () => {
    it('stores org ID in localStorage', async () => {
      const result = await setOrganizationContext('org-123')

      expect(localStorage.setItem).toHaveBeenCalledWith('pcm_selected_org_id', 'org-123')
      expect(result.error).toBeNull()
    })

    it('removes org ID from localStorage when null', async () => {
      await setOrganizationContext(null)

      expect(localStorage.removeItem).toHaveBeenCalledWith('pcm_selected_org_id')
    })
  })

  describe('getCurrentOrganizationId', () => {
    it('returns stored org ID', () => {
      localStorage.getItem.mockReturnValue('org-456')

      expect(getCurrentOrganizationId()).toBe('org-456')
      expect(localStorage.getItem).toHaveBeenCalledWith('pcm_selected_org_id')
    })

    it('returns undefined when no org selected', () => {
      localStorage.getItem.mockReturnValue(undefined)

      expect(getCurrentOrganizationId()).toBeUndefined()
    })
  })

  describe('clearOrganizationContext', () => {
    it('removes org ID from localStorage', () => {
      clearOrganizationContext()

      expect(localStorage.removeItem).toHaveBeenCalledWith('pcm_selected_org_id')
    })
  })
})
