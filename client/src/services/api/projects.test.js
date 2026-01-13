/**
 * Projects API Service Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  activateProject
} from './projects.js'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

// Create mock query builder methods
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockOr = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

// Create chainable mock
const _createChainableMock = (resolvedValue) => {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(resolvedValue)),
    then: (resolve) => Promise.resolve(resolvedValue).then(resolve)
  }
  return chain
}

// Mock Supabase
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: (table) => {
        mockFrom(table)
        
        // Return different mock based on current test expectations
        const chain = {
          select: (...args) => {
            mockSelect(...args)
            return {
              ...chain,
              eq: (field, value) => {
                mockEq(field, value)
                return {
                  ...chain,
                  single: () => mockSingle(),
                  eq: (f2, v2) => {
                    mockEq(f2, v2)
                    return {
                      ...chain,
                      single: () => mockSingle()
                    }
                  }
                }
              },
              or: (filter) => {
                mockOr(filter)
                return chain
              },
              order: (field, opts) => {
                mockOrder(field, opts)
                return {
                  ...chain,
                  eq: (f, v) => {
                    mockEq(f, v)
                    return chain
                  },
                  or: (filter) => {
                    mockOr(filter)
                    return chain
                  },
                  then: (resolve) => mockSingle().then(resolve)
                }
              },
              then: (resolve) => mockSingle().then(resolve)
            }
          },
          insert: (data) => {
            mockInsert(data)
            return {
              ...chain,
              select: () => ({
                ...chain,
                single: () => mockSingle()
              })
            }
          },
          update: (data) => {
            mockUpdate(data)
            return {
              ...chain,
              eq: (field, value) => {
                mockEq(field, value)
                return {
                  ...chain,
                  select: () => ({
                    ...chain,
                    single: () => mockSingle()
                  })
                }
              }
            }
          }
        }
        
        return chain
      }
    }
  }
})

describe('Projects API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: null, error: null })
  })

  describe('getAllProjects', () => {
    it('fetches all projects', async () => {
      const mockProjects = [
        { id: '1', name: 'Project A', code: 'PRJ-A' },
        { id: '2', name: 'Project B', code: 'PRJ-B' }
      ]
      mockSingle.mockResolvedValue({ data: mockProjects, error: null })

      const result = await getAllProjects()

      expect(mockFrom).toHaveBeenCalledWith('projects')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result.data).toEqual(mockProjects)
      expect(result.error).toBeNull()
    })

    it('applies is_active filter', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllProjects({ is_active: true })

      expect(mockEq).toHaveBeenCalledWith('is_active', true)
    })

    it('applies search filter', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllProjects({ search: 'test' })

      expect(mockOr).toHaveBeenCalledWith('code.ilike.%test%,name.ilike.%test%')
    })

    it('returns error on failure', async () => {
      const mockError = new Error('Database error')
      mockSingle.mockResolvedValue({ data: null, error: mockError })

      const result = await getAllProjects()

      expect(result.data).toBeNull()
      expect(result.error).toEqual(mockError)
    })
  })

  describe('getProjectById', () => {
    it('fetches project by ID with relations', async () => {
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        created_by_user: { full_name: 'John Doe', email: 'john@example.com' }
      }
      mockSingle.mockResolvedValue({ data: mockProject, error: null })

      const result = await getProjectById('project-123')

      expect(mockFrom).toHaveBeenCalledWith('projects')
      expect(mockEq).toHaveBeenCalledWith('id', 'project-123')
      expect(result.data).toEqual(mockProject)
      expect(result.error).toBeNull()
    })

    it('returns error when project not found', async () => {
      const mockError = { code: 'PGRST116', message: 'Not found' }
      mockSingle.mockResolvedValue({ data: null, error: mockError })

      const result = await getProjectById('nonexistent')

      expect(result.data).toBeNull()
      expect(result.error).toEqual(mockError)
    })
  })

  describe('createProject', () => {
    it('creates a new project', async () => {
      const newProject = {
        name: 'New Project',
        code: 'NEW-001',
        budget: 100000,
        created_by: 'user-123'
      }
      const createdProject = { id: 'new-id', ...newProject }
      mockSingle.mockResolvedValue({ data: createdProject, error: null })

      const result = await createProject(newProject)

      expect(mockFrom).toHaveBeenCalledWith('projects')
      expect(mockInsert).toHaveBeenCalledWith([newProject])
      expect(result.data).toEqual(createdProject)
    })

    it('returns error when creation fails', async () => {
      const mockError = new Error('Duplicate code')
      mockSingle.mockResolvedValue({ data: null, error: mockError })

      const result = await createProject({ name: 'Test', code: 'EXISTING' })

      expect(result.data).toBeNull()
      expect(result.error).toEqual(mockError)
    })
  })

  describe('updateProject', () => {
    it('updates project data', async () => {
      const updates = { name: 'Updated Name', budget: 50000 }
      const updatedProject = { id: 'project-123', ...updates }
      mockSingle.mockResolvedValue({ data: updatedProject, error: null })

      const result = await updateProject('project-123', updates)

      expect(mockFrom).toHaveBeenCalledWith('projects')
      expect(mockUpdate).toHaveBeenCalledWith(updates)
      expect(mockEq).toHaveBeenCalledWith('id', 'project-123')
      expect(result.data).toEqual(updatedProject)
    })

    it('returns error when update fails', async () => {
      const mockError = new Error('Update failed')
      mockSingle.mockResolvedValue({ data: null, error: mockError })

      const result = await updateProject('project-123', { name: 'Test' })

      expect(result.error).toEqual(mockError)
    })
  })

  describe('deleteProject', () => {
    it('soft deletes project by setting is_active to false', async () => {
      const deletedProject = { id: 'project-123', is_active: false }
      mockSingle.mockResolvedValue({ data: deletedProject, error: null })

      const result = await deleteProject('project-123')

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false })
      expect(mockEq).toHaveBeenCalledWith('id', 'project-123')
      expect(result.data.is_active).toBe(false)
    })
  })

  describe('activateProject', () => {
    it('activates project by setting is_active to true', async () => {
      const activatedProject = { id: 'project-123', is_active: true }
      mockSingle.mockResolvedValue({ data: activatedProject, error: null })

      const result = await activateProject('project-123')

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: true })
      expect(mockEq).toHaveBeenCalledWith('id', 'project-123')
      expect(result.data.is_active).toBe(true)
    })
  })
})
