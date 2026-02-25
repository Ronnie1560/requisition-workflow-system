/**
 * Users API Service Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAllUsers,
  getUserById,
  getUserStats,
  updateUser,
  updateUserRole,
  toggleUserStatus,
  assignUserToProject,
  removeUserFromProject,
  updateProjectAssignment,
  deleteUser,
  clearUsersCache
} from './users.js'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock orgContext
vi.mock('./orgContext', () => ({
  getCurrentOrgId: vi.fn(() => 'test-org-id')
}))

// Mock auditLogger
vi.mock('../../utils/auditLogger', () => ({
  logCrossOrgAccess: vi.fn()
}))

// Track mock calls - use vi.hoisted() for variables referenced inside vi.mock factories
const {
  mockSelect, mockInsert, mockUpdate, mockDelete,
  mockEq, mockOr, mockIn, mockOrder, mockSingle,
  mockFrom, mockRpc, mockGetSession, mockInvoke
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockEq: vi.fn(),
  mockOr: vi.fn(),
  mockIn: vi.fn(),
  mockOrder: vi.fn(),
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockInvoke: vi.fn()
}))

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
          or: (filter) => {
            mockOr(filter)
            return createFullChain()
          },
          in: (field, values) => {
            mockIn(field, values)
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
      },
      auth: {
        getSession: mockGetSession
      },
      functions: {
        invoke: mockInvoke
      }
    }
  }
})

describe('Users API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: null, error: null })
    clearUsersCache()
  })

  // =====================================================
  // FETCH OPERATIONS
  // =====================================================

  describe('getAllUsers', () => {
    it('fetches all users for current org', async () => {
      const mockUsers = [
        { id: 'u-1', full_name: 'Alice', email: 'alice@test.com' },
        { id: 'u-2', full_name: 'Bob', email: 'bob@test.com' }
      ]
      mockSingle.mockResolvedValue({ data: mockUsers, error: null })

      const result = await getAllUsers()

      expect(mockFrom).toHaveBeenCalledWith('users_with_assignments')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result.data).toEqual(mockUsers)
      expect(result.error).toBeNull()
    })

    it('applies role filter', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllUsers({ role: 'admin' })

      expect(mockEq).toHaveBeenCalledWith('role', 'admin')
    })

    it('applies is_active filter', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllUsers({ is_active: true })

      expect(mockEq).toHaveBeenCalledWith('is_active', true)
    })

    it('applies search filter', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllUsers({ search: 'alice' })

      expect(mockOr).toHaveBeenCalledWith('full_name.ilike.%alice%,email.ilike.%alice%')
    })

    it('returns cached data on subsequent calls without filters', async () => {
      const mockUsers = [{ id: 'u-1', full_name: 'Cached' }]
      mockSingle.mockResolvedValue({ data: mockUsers, error: null })

      // First call - hits API
      await getAllUsers()
      // Second call - should use cache
      const result = await getAllUsers()

      // from() should only be called once (cached second time)
      expect(mockFrom).toHaveBeenCalledTimes(1)
      expect(result.data).toEqual(mockUsers)
    })

    it('bypasses cache with forceRefresh', async () => {
      const mockUsers = [{ id: 'u-1' }]
      mockSingle.mockResolvedValue({ data: mockUsers, error: null })

      await getAllUsers()
      await getAllUsers({}, true)

      expect(mockFrom).toHaveBeenCalledTimes(2)
    })

    it('throws error when no org selected', async () => {
      const { getCurrentOrgId } = await import('./orgContext')
      getCurrentOrgId.mockReturnValueOnce(null)

      const result = await getAllUsers()

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('returns cached data on API error if cache exists', async () => {
      const mockUsers = [{ id: 'u-1', full_name: 'Cached' }]
      // First call succeeds and caches
      mockSingle.mockResolvedValueOnce({ data: mockUsers, error: null })
      await getAllUsers()

      // Second call with force refresh fails
      mockSingle.mockResolvedValueOnce({ data: null, error: new Error('Network error') })
      const result = await getAllUsers({}, true)

      expect(result.data).toEqual(mockUsers)
    })
  })

  describe('getUserById', () => {
    it('fetches user by ID with project assignments', async () => {
      const mockUser = { id: 'u-1', full_name: 'Alice', project_assignments: [] }
      mockSingle.mockResolvedValue({ data: mockUser, error: null })

      const result = await getUserById('u-1')

      expect(mockFrom).toHaveBeenCalledWith('users')
      expect(mockEq).toHaveBeenCalledWith('id', 'u-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data).toEqual(mockUser)
    })

    it('returns error when user not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Not found') })

      const result = await getUserById('nonexistent')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('getUserStats', () => {
    it('computes stats from organization members', async () => {
      const mockMembers = [
        { workflow_role: 'submitter', is_active: true, user: { is_active: true } },
        { workflow_role: 'reviewer', is_active: true, user: { is_active: true } },
        { workflow_role: 'approver', is_active: false, user: { is_active: true } },
        { workflow_role: 'submitter', is_active: true, user: { is_active: false } }
      ]
      mockSingle.mockResolvedValue({ data: mockMembers, error: null })

      const result = await getUserStats()

      expect(mockFrom).toHaveBeenCalledWith('organization_members')
      expect(mockEq).toHaveBeenCalledWith('organization_id', 'test-org-id')
      expect(result.data.total).toBe(4)
      expect(result.data.active).toBe(2) // both is_active and user.is_active must be true
      expect(result.data.inactive).toBe(2)
      expect(result.data.byRole.submitter).toBe(2)
      expect(result.data.byRole.reviewer).toBe(1)
      expect(result.data.byRole.approver).toBe(1)
    })

    it('returns empty stats when no org selected', async () => {
      const { getCurrentOrgId } = await import('./orgContext')
      getCurrentOrgId.mockReturnValueOnce(null)

      const result = await getUserStats()

      expect(result.data.total).toBe(0)
      expect(result.data.byRole.submitter).toBe(0)
    })
  })

  // =====================================================
  // UPDATE OPERATIONS
  // =====================================================

  describe('updateUser', () => {
    it('updates user profile fields', async () => {
      const updates = { full_name: 'Alice Updated' }
      mockSingle.mockResolvedValue({ data: { id: 'u-1', ...updates }, error: null })

      const result = await updateUser('u-1', updates)

      expect(mockFrom).toHaveBeenCalledWith('users')
      expect(mockUpdate).toHaveBeenCalledWith(updates)
      expect(mockEq).toHaveBeenCalledWith('id', 'u-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data.full_name).toBe('Alice Updated')
    })

    it('throws when no org selected', async () => {
      const { getCurrentOrgId } = await import('./orgContext')
      getCurrentOrgId.mockReturnValueOnce(null)

      const result = await updateUser('u-1', { full_name: 'Test' })

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('updateUserRole', () => {
    it('calls RPC to update workflow role', async () => {
      mockSingle.mockResolvedValue({ data: true, error: null })

      const result = await updateUserRole('u-1', 'approver')

      expect(mockRpc).toHaveBeenCalledWith('update_member_workflow_role', {
        p_org_id: 'test-org-id',
        p_user_id: 'u-1',
        p_workflow_role: 'approver'
      })
      expect(result.error).toBeNull()
    })
  })

  describe('toggleUserStatus', () => {
    it('activates a user', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'u-1', is_active: true }, error: null })

      const result = await toggleUserStatus('u-1', true)

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: true })
      expect(mockEq).toHaveBeenCalledWith('id', 'u-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data.is_active).toBe(true)
    })

    it('deactivates a user', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'u-1', is_active: false }, error: null })

      const result = await toggleUserStatus('u-1', false)

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false })
      expect(result.data.is_active).toBe(false)
    })
  })

  // =====================================================
  // PROJECT ASSIGNMENT OPERATIONS
  // =====================================================

  describe('assignUserToProject', () => {
    it('assigns user after verifying project org', async () => {
      // First call: project lookup returns matching org
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'proj-1', org_id: 'test-org-id' }, error: null })
        // Second call: insert assignment
        .mockResolvedValueOnce({ data: { id: 'assignment-1', user_id: 'u-1', project_id: 'proj-1' }, error: null })

      const result = await assignUserToProject('u-1', 'proj-1', 'viewer', 'admin-1')

      expect(result.data).toEqual({ id: 'assignment-1', user_id: 'u-1', project_id: 'proj-1' })
      expect(result.error).toBeNull()
    })

    it('rejects cross-org project assignment', async () => {
      // Project belongs to different org
      mockSingle.mockResolvedValueOnce({ data: { id: 'proj-1', org_id: 'other-org-id' }, error: null })

      const result = await assignUserToProject('u-1', 'proj-1', 'viewer', 'admin-1')

      const { logCrossOrgAccess } = await import('../../utils/auditLogger')
      expect(logCrossOrgAccess).toHaveBeenCalled()
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('removeUserFromProject', () => {
    it('removes assignment by ID scoped to org', async () => {
      mockSingle.mockResolvedValue({ error: null })

      const result = await removeUserFromProject('assignment-1')

      expect(mockFrom).toHaveBeenCalledWith('user_project_assignments')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'assignment-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.error).toBeNull()
    })
  })

  describe('updateProjectAssignment', () => {
    it('updates assignment role scoped to org', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'a-1', role: 'editor' }, error: null })

      const result = await updateProjectAssignment('a-1', 'editor')

      expect(mockUpdate).toHaveBeenCalledWith({ role: 'editor' })
      expect(mockEq).toHaveBeenCalledWith('id', 'a-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data.role).toBe('editor')
    })
  })

  // =====================================================
  // DELETE OPERATIONS
  // =====================================================

  describe('deleteUser', () => {
    it('soft deletes by deactivating', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'u-1', is_active: false }, error: null })

      const result = await deleteUser('u-1')

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false })
      expect(mockEq).toHaveBeenCalledWith('id', 'u-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data.is_active).toBe(false)
    })
  })
})
