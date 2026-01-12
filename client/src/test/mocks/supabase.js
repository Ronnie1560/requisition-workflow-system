/**
 * Mock Supabase Client
 * PCM Requisition System
 * 
 * Provides mock implementations for Supabase operations in tests
 */

import { vi } from 'vitest'

// Mock user data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User'
  }
}

// Mock profile data
export const mockProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'submitter',
  department: 'IT',
  is_active: true
}

// Mock session data
export const mockSession = {
  user: mockUser,
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Date.now() + 3600000
}

// Mock project data
export const mockProjects = [
  { id: 'proj-1', code: 'PROJ001', name: 'Project Alpha', budget: 100000, is_active: true },
  { id: 'proj-2', code: 'PROJ002', name: 'Project Beta', budget: 50000, is_active: true }
]

// Mock expense account data
export const mockExpenseAccounts = [
  { id: 'exp-1', code: '5000', name: 'Office Supplies', is_active: true },
  { id: 'exp-2', code: '5100', name: 'Equipment', is_active: true }
]

// Mock requisition data
export const mockRequisitions = [
  {
    id: 'req-1',
    requisition_number: 'REQ-2026-001',
    title: 'Office Supplies Request',
    status: 'pending',
    total_amount: 1500,
    submitted_by: 'test-user-id',
    project_id: 'proj-1',
    created_at: '2026-01-10T10:00:00Z'
  },
  {
    id: 'req-2',
    requisition_number: 'REQ-2026-002',
    title: 'Equipment Purchase',
    status: 'approved',
    total_amount: 5000,
    submitted_by: 'test-user-id',
    project_id: 'proj-2',
    created_at: '2026-01-05T10:00:00Z'
  }
]

// Mock notification data
export const mockNotifications = [
  {
    id: 'notif-1',
    user_id: 'test-user-id',
    type: 'requisition_approved',
    title: 'Requisition Approved',
    message: 'Your requisition has been approved',
    is_read: false,
    created_at: '2026-01-11T10:00:00Z'
  }
]

// Create chainable mock query builder
const createQueryBuilder = (data = [], error = null) => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
    then: (resolve) => resolve({ data, error })
  }
  return builder
}

// Create mock Supabase client
export const createMockSupabaseClient = () => {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      })
    },
    from: vi.fn((table) => {
      switch (table) {
        case 'users':
          return createQueryBuilder([mockProfile])
        case 'projects':
          return createQueryBuilder(mockProjects)
        case 'expense_accounts':
          return createQueryBuilder(mockExpenseAccounts)
        case 'requisitions':
          return createQueryBuilder(mockRequisitions)
        case 'notifications':
          return createQueryBuilder(mockNotifications)
        default:
          return createQueryBuilder([])
      }
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test/file.pdf' }, error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
        remove: vi.fn().mockResolvedValue({ error: null })
      })
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn()
    })
  }
}

// Default mock instance
export const mockSupabase = createMockSupabaseClient()
