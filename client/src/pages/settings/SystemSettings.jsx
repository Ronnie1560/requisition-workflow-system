import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getOrganizationSettings,
  updateOrganizationSettings,
  getFiscalYearSettings,
  updateFiscalYearSettings,
  getApprovalWorkflows,
  updateApprovalWorkflow,
  createApprovalWorkflow,
  deleteApprovalWorkflow,
  toggleWorkflowStatus
} from '../../services/api/systemSettings'
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  activateCategory
} from '../../services/api/categories'
import { Trash2, Plus, Edit2, X, Upload, Image } from 'lucide-react'
import { logger } from '../../utils/logger'

export default function SystemSettings() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('organization')
  const [loading, setLoading] = useState({
    organization: true,
    fiscal: false,
    workflows: false,
    categories: false
  })
  const [dataLoaded, setDataLoaded] = useState({
    organization: false,
    fiscal: false,
    workflows: false,
    categories: false
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditingOrg, setIsEditingOrg] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  // Organization data
  const [orgData, setOrgData] = useState({
    organization_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    tax_id: '',
    logo_url: ''
  })

  // Fiscal year data
  const [fiscalData, setFiscalData] = useState({
    fiscal_year_start_month: 1,
    fiscal_year_start_day: 1,
    current_fiscal_year: new Date().getFullYear()
  })

  // Approval workflows
  const [workflows, setWorkflows] = useState([])
  const [editingWorkflow, setEditingWorkflow] = useState(null)
  const [showWorkflowModal, setShowWorkflowModal] = useState(false)

  // Categories
  const [categories, setCategories] = useState([])
  const [editingCategory, setEditingCategory] = useState(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)

  // Check if user is admin
  useEffect(() => {
    if (profile && profile.role !== 'super_admin') {
      navigate('/dashboard')
    }
  }, [profile, navigate])

  // Load data for the active tab only
  useEffect(() => {
    if (!dataLoaded[activeTab]) {
      loadTabData(activeTab)
    }
  }, [activeTab])

  const loadTabData = async (tab) => {
    setLoading(prev => ({ ...prev, [tab]: true }))
    setError('')

    try {
      switch (tab) {
        case 'organization':
          await loadOrganizationSettings()
          break
        case 'fiscal':
          await loadFiscalSettings()
          break
        case 'workflows':
          await loadWorkflows()
          break
        case 'categories':
          await loadCategories()
          break
      }
      setDataLoaded(prev => ({ ...prev, [tab]: true }))
    } catch (err) {
      logger.error(`Error loading ${tab} settings:`, err)
      setError(`Failed to load ${tab} settings`)
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }))
    }
  }

  const loadOrganizationSettings = async () => {
    const { data, error } = await getOrganizationSettings()
    if (error) throw error

    if (data) {
      setOrgData({
        organization_name: data.organization_name || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        state_province: data.state_province || '',
        postal_code: data.postal_code || '',
        country: data.country || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        tax_id: data.tax_id || '',
        logo_url: data.logo_url || ''
      })
      setLogoPreview(data.logo_url || null)
    }
  }

  const loadFiscalSettings = async () => {
    const { data, error } = await getFiscalYearSettings()
    if (error) throw error

    if (data) {
      setFiscalData({
        fiscal_year_start_month: data.fiscal_year_start_month || 1,
        fiscal_year_start_day: data.fiscal_year_start_day || 1,
        current_fiscal_year: data.current_fiscal_year || new Date().getFullYear()
      })
    }
  }

  const loadWorkflows = async () => {
    const { data, error } = await getApprovalWorkflows()
    if (error) throw error

    if (data) {
      setWorkflows(data)
    }
  }

  const loadCategories = async () => {
    const { data, error } = await getAllCategories()
    if (error) throw error

    if (data) {
      setCategories(data)
    }
  }

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Logo file size must be less than 5MB')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleEditOrg = () => {
    setIsEditingOrg(true)
    setError('')
  }

  const handleCancelEditOrg = () => {
    setIsEditingOrg(false)
    setLogoFile(null)
    setLogoPreview(orgData.logo_url || null)
    setError('')
    // Reload organization data to reset form
    loadOrganizationSettings()
  }

  const handleOrgSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      let logoUrl = orgData.logo_url

      // If a new logo file was selected, convert to base64 for storage
      if (logoFile) {
        logoUrl = logoPreview
      }

      const dataToUpdate = {
        ...orgData,
        logo_url: logoUrl
      }

      const { error } = await updateOrganizationSettings(dataToUpdate)
      if (error) throw error

      setSuccess('Organization settings updated successfully')
      setIsEditingOrg(false)
      setLogoFile(null)
      setTimeout(() => setSuccess(''), 3000)
      // Reload to get fresh data
      await loadOrganizationSettings()
    } catch (err) {
      logger.error('Error updating organization settings:', err)
      setError(err.message || 'Failed to update organization settings')
    } finally {
      setSaving(false)
    }
  }

  const handleFiscalSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await updateFiscalYearSettings(fiscalData)
      if (error) throw error

      setSuccess('Fiscal year settings updated successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error updating fiscal year settings:', err)
      setError(err.message || 'Failed to update fiscal year settings')
    } finally {
      setSaving(false)
    }
  }

  const handleWorkflowSubmit = async (workflowData) => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      let result
      if (editingWorkflow?.id) {
        result = await updateApprovalWorkflow(editingWorkflow.id, workflowData)
      } else {
        result = await createApprovalWorkflow(workflowData)
      }

      if (result.error) throw result.error

      setSuccess(`Workflow ${editingWorkflow?.id ? 'updated' : 'created'} successfully`)
      setShowWorkflowModal(false)
      setEditingWorkflow(null)
      await loadWorkflows()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error saving workflow:', err)
      setError(err.message || 'Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWorkflow = async (id) => {
    if (!window.confirm('Are you sure you want to delete this workflow?')) return

    try {
      const { error } = await deleteApprovalWorkflow(id)
      if (error) throw error

      setSuccess('Workflow deleted successfully')
      await loadWorkflows()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error deleting workflow:', err)
      setError(err.message || 'Failed to delete workflow')
    }
  }

  const handleToggleWorkflow = async (id, currentStatus) => {
    try {
      const { error } = await toggleWorkflowStatus(id, !currentStatus)
      if (error) throw error

      setSuccess(`Workflow ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
      await loadWorkflows()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error toggling workflow:', err)
      setError(err.message || 'Failed to toggle workflow status')
    }
  }

  // Category handlers
  const handleCategorySubmit = async (categoryData) => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      let result
      if (editingCategory?.id) {
        result = await updateCategory(editingCategory.id, categoryData)
      } else {
        result = await createCategory(categoryData)
      }

      if (result.error) throw result.error

      setSuccess(`Category ${editingCategory?.id ? 'updated' : 'created'} successfully`)
      setShowCategoryModal(false)
      setEditingCategory(null)
      await loadCategories()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error saving category:', err)
      setError(err.message || 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return

    try {
      const { error } = await deleteCategory(id)
      if (error) throw error

      setSuccess('Category deleted successfully')
      await loadCategories()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error deleting category:', err)
      setError(err.message || 'Failed to delete category')
    }
  }

  const handleToggleCategory = async (id, currentStatus) => {
    try {
      const action = currentStatus ? deleteCategory : activateCategory
      const { error } = await action(id)
      if (error) throw error

      setSuccess(`Category ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
      await loadCategories()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error toggling category:', err)
      setError(err.message || 'Failed to toggle category status')
    }
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Show loading only for the active tab
  const isLoadingCurrentTab = loading[activeTab]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-2">Configure organization details, fiscal year, and approval workflows</p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-md">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('organization')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'organization'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Organization Details
              </button>
              <button
                onClick={() => setActiveTab('fiscal')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'fiscal'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Fiscal Year
              </button>
              <button
                onClick={() => setActiveTab('workflows')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'workflows'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Approval Workflows
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'categories'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Categories
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Loading State */}
            {isLoadingCurrentTab ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-gray-600">Loading {activeTab} settings...</div>
              </div>
            ) : (
              <>
                {/* Organization Tab */}
                {activeTab === 'organization' && (
                  <form onSubmit={handleOrgSubmit} className="space-y-6">
                {/* Logo Upload Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Image className="w-5 h-5" />
                    Organization Logo
                  </h3>
                  <div className="flex items-start gap-6">
                    {/* Logo Preview */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Organization Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Image className="w-12 h-12 text-gray-400" />
                        )}
                      </div>
                    </div>
                    {/* Upload Button */}
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-3">
                        Upload your organization logo. Recommended size: 200x200px or larger. Max file size: 5MB.
                      </p>
                      <div className="flex gap-3">
                        <label className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium ${
                          isEditingOrg
                            ? 'bg-white text-gray-700 hover:bg-gray-50 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}>
                          <Upload className="w-4 h-4" />
                          Choose Logo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            disabled={!isEditingOrg}
                            className="hidden"
                          />
                        </label>
                        {logoPreview && isEditingOrg && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogoFile(null)
                              setLogoPreview(null)
                              setOrgData({ ...orgData, logo_url: '' })
                            }}
                            className="px-4 py-2 text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={orgData.organization_name}
                      onChange={(e) => setOrgData({ ...orgData, organization_name: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={orgData.address_line1}
                      onChange={(e) => setOrgData({ ...orgData, address_line1: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={orgData.address_line2}
                      onChange={(e) => setOrgData({ ...orgData, address_line2: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={orgData.city}
                      onChange={(e) => setOrgData({ ...orgData, city: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={orgData.state_province}
                      onChange={(e) => setOrgData({ ...orgData, state_province: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={orgData.postal_code}
                      onChange={(e) => setOrgData({ ...orgData, postal_code: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={orgData.country}
                      onChange={(e) => setOrgData({ ...orgData, country: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={orgData.phone}
                      onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={orgData.email}
                      onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={orgData.website}
                      onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="https://"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      value={orgData.tax_id}
                      onChange={(e) => setOrgData({ ...orgData, tax_id: e.target.value })}
                      disabled={!isEditingOrg}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  {!isEditingOrg ? (
                    <button
                      type="button"
                      onClick={handleEditOrg}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Organization Details
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelEditOrg}
                        disabled={saving}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-400"
                      >
                        {saving ? 'Updating...' : 'Update Changes'}
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            {/* Fiscal Year Tab */}
            {activeTab === 'fiscal' && (
              <form onSubmit={handleFiscalSubmit} className="space-y-6">
                <div className="max-w-2xl space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <p className="text-sm text-blue-800">
                      Configure when your organization's fiscal year starts. This affects reporting periods and budget planning.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fiscal Year Start Month <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={fiscalData.fiscal_year_start_month}
                        onChange={(e) => setFiscalData({ ...fiscalData, fiscal_year_start_month: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {months.map((month, index) => (
                          <option key={index + 1} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fiscal Year Start Day <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="31"
                        value={fiscalData.fiscal_year_start_day}
                        onChange={(e) => setFiscalData({ ...fiscalData, fiscal_year_start_day: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Fiscal Year <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={fiscalData.current_fiscal_year}
                        onChange={(e) => setFiscalData({ ...fiscalData, current_fiscal_year: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <p className="text-sm text-gray-700">
                      <strong>Current setting:</strong> Fiscal year starts on{' '}
                      {months[fiscalData.fiscal_year_start_month - 1]} {fiscalData.fiscal_year_start_day}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Approval Workflows Tab */}
            {activeTab === 'workflows' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Define approval workflows based on requisition amount thresholds
                  </p>
                  <button
                    onClick={() => {
                      setEditingWorkflow({
                        workflow_name: '',
                        description: '',
                        amount_threshold_min: 0,
                        amount_threshold_max: null,
                        required_approvers_count: 1,
                        approval_roles: ['super_admin'],
                        is_active: true,
                        priority: workflows.length + 1
                      })
                      setShowWorkflowModal(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Workflow
                  </button>
                </div>

                {/* Workflows Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Workflow Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount Range
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approvers
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {workflows.map((workflow) => (
                        <tr key={workflow.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{workflow.workflow_name}</div>
                            {workflow.description && (
                              <div className="text-sm text-gray-500">{workflow.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${workflow.amount_threshold_min?.toLocaleString()} -{' '}
                            {workflow.amount_threshold_max ? `$${workflow.amount_threshold_max.toLocaleString()}` : 'No limit'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {workflow.required_approvers_count} approver{workflow.required_approvers_count !== 1 ? 's' : ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleWorkflow(workflow.id, workflow.is_active)}
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                workflow.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {workflow.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setEditingWorkflow(workflow)
                                setShowWorkflowModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteWorkflow(workflow.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {workflows.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                            No workflows configured. Click "Add Workflow" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Categories Tab */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Manage item categories for better organization and filtering
                  </p>
                  <button
                    onClick={() => {
                      setEditingCategory({
                        code: '',
                        name: '',
                        description: '',
                        is_active: true
                      })
                      setShowCategoryModal(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Category
                  </button>
                </div>

                {/* Categories Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Code
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categories.map((category) => (
                        <tr key={category.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {category.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{category.name}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {category.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleCategory(category.id, category.is_active)}
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                category.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {category.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setEditingCategory(category)
                                setShowCategoryModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {categories.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                            No categories configured. Click "Add Category" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>

        {/* Workflow Modal */}
        {showWorkflowModal && <WorkflowModal workflow={editingWorkflow} onSave={handleWorkflowSubmit} onClose={() => {
          setShowWorkflowModal(false)
          setEditingWorkflow(null)
        }} saving={saving} />}

        {/* Category Modal */}
        {showCategoryModal && <CategoryModal category={editingCategory} onSave={handleCategorySubmit} onClose={() => {
          setShowCategoryModal(false)
          setEditingCategory(null)
        }} saving={saving} />}
      </div>
    </div>
  )
}

// Workflow Modal Component
function WorkflowModal({ workflow, onSave, onClose, saving }) {
  const [formData, setFormData] = useState({
    workflow_name: workflow?.workflow_name || '',
    description: workflow?.description || '',
    amount_threshold_min: workflow?.amount_threshold_min || 0,
    amount_threshold_max: workflow?.amount_threshold_max || '',
    required_approvers_count: workflow?.required_approvers_count || 1,
    approval_roles: workflow?.approval_roles || ['super_admin'],
    is_active: workflow?.is_active !== undefined ? workflow.is_active : true,
    priority: workflow?.priority || 1
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const dataToSubmit = {
      ...formData,
      amount_threshold_max: formData.amount_threshold_max === '' ? null : parseFloat(formData.amount_threshold_max)
    }
    onSave(dataToSubmit)
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {workflow?.id ? 'Edit Workflow' : 'Add Workflow'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workflow Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.workflow_name}
                onChange={(e) => setFormData({ ...formData, workflow_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount_threshold_min}
                  onChange={(e) => setFormData({ ...formData, amount_threshold_min: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount_threshold_max}
                  onChange={(e) => setFormData({ ...formData, amount_threshold_max: e.target.value })}
                  placeholder="No limit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required Approvers <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.required_approvers_count}
                onChange={(e) => setFormData({ ...formData, required_approvers_count: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Lower numbers have higher priority</p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Workflow'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Category Modal Component
function CategoryModal({ category, onSave, onClose, saving }) {
  const [formData, setFormData] = useState({
    code: category?.code || '',
    name: category?.name || '',
    description: category?.description || '',
    is_active: category?.is_active !== undefined ? category.is_active : true
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {category?.id ? 'Edit Category' : 'Add Category'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., OFF, IT, SVC"
              />
              <p className="text-xs text-gray-500 mt-1">Short code for the category (will be converted to uppercase)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Office Supplies, IT Equipment, Services"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description of this category"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
