import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Plus, Folder, Search, Filter, Calendar, DollarSign, Users } from 'lucide-react'
import { getAllProjects } from '../../services/api/projects'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { logger } from '../../utils/logger'

const ProjectsList = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [allProjects, setAllProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [statusFilter])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const { data, error } = await getAllProjects({ is_active: statusFilter })
      if (error) throw error
      setAllProjects(data || [])
    } catch (err) {
      logger.error('Error loading projects:', err)
    } finally {
      setLoading(false)
    }
  }

  // Real-time filtering using useMemo
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return allProjects
    }

    const query = searchQuery.toLowerCase().trim()

    return allProjects.filter((project) => {
      // Search in code, name, and description
      const matchesCode = project.code?.toLowerCase().includes(query)
      const matchesName = project.name?.toLowerCase().includes(query)
      const matchesDescription = project.description?.toLowerCase().includes(query)

      return matchesCode || matchesName || matchesDescription
    })
  }, [allProjects, searchQuery])

  // Check if user can create projects (admins only)
  const canCreateProject = profile?.role === 'super_admin'

  const getProjectStatus = (project) => {
    if (!project.is_active) return { label: 'Inactive', color: 'bg-gray-500' }

    const now = new Date()
    const startDate = project.start_date ? new Date(project.start_date) : null
    const endDate = project.end_date ? new Date(project.end_date) : null

    if (endDate && endDate < now) {
      return { label: 'Completed', color: 'bg-blue-500' }
    }
    if (startDate && startDate > now) {
      return { label: 'Planned', color: 'bg-yellow-500' }
    }
    return { label: 'Active', color: 'bg-green-500' }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and monitor your organization's projects
          </p>
        </div>
        {canCreateProject && (
          <button
            onClick={() => navigate('/projects/create')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">
            {searchQuery ? 'Filtered Results' : 'Total Projects'}
          </p>
          <p className="text-2xl font-bold text-gray-900">{filteredProjects.length}</p>
          {searchQuery && (
            <p className="text-xs text-gray-500 mt-1">of {allProjects.length} total</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredProjects.filter(p => p.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Inactive</p>
          <p className="text-2xl font-bold text-gray-500">
            {filteredProjects.filter(p => !p.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-indigo-600">
            {formatCurrency(filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Real-time Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by code, name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value === 'true')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search hint */}
        {searchQuery && (
          <p className="mt-2 text-xs text-gray-500">
            Showing {filteredProjects.length} result{filteredProjects.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        )}
      </div>

      {/* Projects Grid */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 mt-4">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center">
            <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No projects found</p>
            <p className="text-sm text-gray-500 mb-6">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search term.`
                : 'Create your first project to get started'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 mb-4"
              >
                Clear Search
              </button>
            )}
            {canCreateProject && !searchQuery && (
              <button
                onClick={() => navigate('/projects/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {filteredProjects.map((project) => {
              const status = getProjectStatus(project)
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="border border-gray-200 rounded-lg p-6 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Folder className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{project.code}</h3>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white ${status.color} mt-1`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <h4 className="font-medium text-gray-900 mb-2">{project.name}</h4>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {project.description || 'No description'}
                  </p>

                  <div className="space-y-2 text-sm">
                    {project.budget && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <DollarSign className="w-4 h-4" />
                        <span>Budget: {formatCurrency(project.budget)}</span>
                      </div>
                    )}
                    {project.start_date && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {formatDate(project.start_date)}
                          {project.end_date && ` - ${formatDate(project.end_date)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectsList
