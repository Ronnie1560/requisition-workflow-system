import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2, Users, CreditCard, Settings, Calendar,
  Loader2, Save, Pencil, X, ExternalLink, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, ArrowUpRight
} from 'lucide-react'
import { useOrganization } from '../../context/OrganizationContext'
import {
  getFiscalYearSettings,
  updateFiscalYearSettings
} from '../../services/api/systemSettings'
import { getOrganizationUsage, getBillingHistory, createPortalSession } from '../../services/api/billing'
import { getPlanConfig, formatPrice, PLAN_ORDER } from '../../config/plans'

/**
 * Organization Settings Page
 * Manage organization details and fiscal year settings
 */
export default function OrganizationSettings() {
  const {
    currentOrg,
    updateOrganization,
    isOwner,
    canManageOrg,
    refreshOrganizations,
  } = useOrganization()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Initialize tab from URL param
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'general')
  const [_loading, _setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editMode, setEditMode] = useState(false)

  // Billing state
  const [usage, setUsage] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  // General settings form
  const [generalForm, setGeneralForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: '',
    tax_id: '',
  })

  // Fiscal year settings
  const [fiscalData, setFiscalData] = useState({
    fiscal_year_start_month: 1,
    fiscal_year_start_day: 1,
    current_fiscal_year: new Date().getFullYear()
  })
  const [loadingFiscal, setLoadingFiscal] = useState(false)

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Load initial data
  useEffect(() => {
    if (currentOrg) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing form with external org data
      setGeneralForm({
        name: currentOrg.name || '',
        email: currentOrg.email || '',
        phone: currentOrg.phone || '',
        website: currentOrg.website || '',
        address_line1: currentOrg.address_line1 || '',
        address_line2: currentOrg.address_line2 || '',
        city: currentOrg.city || '',
        state_province: currentOrg.state_province || '',
        postal_code: currentOrg.postal_code || '',
        country: currentOrg.country || 'Uganda',
        tax_id: currentOrg.tax_id || '',
      })
    }
  }, [currentOrg])

  // Load fiscal year settings callback
  const loadFiscal = useCallback(async () => {
    if (!currentOrg?.id) return

    setLoadingFiscal(true)
    const { data, error: fetchError } = await getFiscalYearSettings(currentOrg.id)

    if (data) {
      setFiscalData({
        fiscal_year_start_month: data.fiscal_year_start_month,
        fiscal_year_start_day: data.fiscal_year_start_day,
        current_fiscal_year: data.current_fiscal_year
      })
    }
    if (fetchError) {
      setError(fetchError)
    }
    setLoadingFiscal(false)
  }, [currentOrg])

  // Load fiscal year when tab changes
  useEffect(() => {
    if (activeTab === 'fiscal') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Data loading on tab change is intentional
      loadFiscal()
    }
  }, [activeTab, loadFiscal])

  // Load billing data when billing tab is active
  useEffect(() => {
    if (activeTab === 'billing' && currentOrg?.id) {
      const loadBillingData = async () => {
        setBillingLoading(true)
        const [usageResult, historyResult] = await Promise.all([
          getOrganizationUsage(currentOrg.id),
          getBillingHistory(currentOrg.id),
        ])
        if (usageResult.data) setUsage(usageResult.data)
        if (historyResult.data) setBillingHistory(historyResult.data)
        setBillingLoading(false)
      }
      loadBillingData()
    }
  }, [activeTab, currentOrg?.id])

  // Handle checkout success/cancel from URL params
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time sync from URL param, not a cascading render
      setSuccess('Your subscription has been activated! It may take a moment to reflect.')
      setActiveTab('billing')
      // Refresh org data to get updated plan
      refreshOrganizations()
    } else if (checkout === 'cancelled') {
      setError('Checkout was cancelled.')
      setActiveTab('billing')
    }
  }, [searchParams, refreshOrganizations])

  // Manage Stripe billing portal
  const handleManageBilling = async () => {
    setPortalLoading(true)
    setError(null)
    const { data, error: portalError } = await createPortalSession(currentOrg.id)
    if (portalError) {
      setError(portalError)
      setPortalLoading(false)
      return
    }
    if (data?.url) {
      window.location.href = data.url
    }
    setPortalLoading(false)
  }

  const handleSaveGeneral = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await updateOrganization(generalForm)

    if (updateError) {
      setError(updateError)
    } else {
      setSuccess('Organization settings saved successfully')
      setEditMode(false) // Exit edit mode after successful save
    }
    setSaving(false)
  }

  const handleSaveFiscal = async (e) => {
    e.preventDefault()
    if (!currentOrg?.id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await updateFiscalYearSettings(currentOrg.id, fiscalData)

    if (updateError) {
      setError(updateError)
    } else {
      setSuccess('Fiscal year settings saved successfully')
    }
    setSaving(false)
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'fiscal', label: 'Fiscal Year', icon: Calendar },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ]

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Organization Settings
              </h1>
              <p className="text-sm text-gray-500">{currentOrg.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="flex gap-8">
          {/* Sidebar Tabs */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Tab Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* General Tab */}
            {activeTab === 'general' && (
              <form onSubmit={handleSaveGeneral} className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    General Settings
                  </h2>
                  {canManageOrg && !editMode && (
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Details
                    </button>
                  )}
                  {canManageOrg && editMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false)
                        // Reset form to current org values
                        if (currentOrg) {
                          setGeneralForm({
                            name: currentOrg.name || '',
                            email: currentOrg.email || '',
                            phone: currentOrg.phone || '',
                            website: currentOrg.website || '',
                            address_line1: currentOrg.address_line1 || '',
                            address_line2: currentOrg.address_line2 || '',
                            city: currentOrg.city || '',
                            state_province: currentOrg.state_province || '',
                            postal_code: currentOrg.postal_code || '',
                            country: currentOrg.country || 'Uganda',
                            tax_id: currentOrg.tax_id || '',
                          })
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  )}
                </div>

                {/* Info Banner for Team Members */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        Manage Team Members
                      </p>
                      <p className="text-sm text-blue-700">
                        To invite and manage team members, workflow roles, and permissions, visit the{' '}
                        <a href="/users" className="font-semibold underline hover:text-blue-900">
                          Users & Permissions
                        </a>{' '}
                        page.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={generalForm.name}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, name: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!editMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={generalForm.email}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, email: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!editMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={generalForm.phone}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!editMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={generalForm.website}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, website: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!editMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      disabled={!editMode}
                    />
                  </div>
                </div>

                <hr className="border-gray-200" />

                <h3 className="text-md font-medium text-gray-900">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={generalForm.address_line1}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, address_line1: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!editMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={generalForm.city}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, city: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!editMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={generalForm.country}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, country: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!editMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      disabled={!editMode}
                    />
                  </div>
                </div>

                {editMode && (
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false)
                        // Reset form to current org values
                        if (currentOrg) {
                          setGeneralForm({
                            name: currentOrg.name || '',
                            email: currentOrg.email || '',
                            phone: currentOrg.phone || '',
                            website: currentOrg.website || '',
                            address_line1: currentOrg.address_line1 || '',
                            address_line2: currentOrg.address_line2 || '',
                            city: currentOrg.city || '',
                            state_province: currentOrg.state_province || '',
                            postal_code: currentOrg.postal_code || '',
                            country: currentOrg.country || 'Uganda',
                            tax_id: currentOrg.tax_id || '',
                          })
                        }
                      }}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* Fiscal Year Tab */}
            {activeTab === 'fiscal' && (
              <form onSubmit={handleSaveFiscal} className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Fiscal Year Settings
                </h2>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Configure when your organization's fiscal year starts. This affects reporting periods and budget planning for this organization.
                  </p>
                </div>

                {loadingFiscal ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="max-w-2xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fiscal Year Start Month <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={fiscalData.fiscal_year_start_month}
                          onChange={(e) => setFiscalData({ ...fiscalData, fiscal_year_start_month: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={!canManageOrg}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={!canManageOrg}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={!canManageOrg}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Current setting:</strong> Fiscal year starts on{' '}
                        {months[fiscalData.fiscal_year_start_month - 1]} {fiscalData.fiscal_year_start_day}
                      </p>
                    </div>

                    {canManageOrg && (
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Subscription & Billing
                  </h2>
                  {currentOrg.stripe_customer_id && isOwner && (
                    <button
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                      Manage Billing
                    </button>
                  )}
                </div>

                {/* Current Plan Card */}
                {(() => {
                  const planConfig = getPlanConfig(currentOrg.plan)
                  const isTrialing = currentOrg.status === 'trial'
                  const trialDaysLeft = isTrialing && currentOrg.trial_ends_at
                    ? Math.max(0, Math.ceil((new Date(currentOrg.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
                    : 0

                  return (
                    <div className={`p-5 rounded-xl border-2 ${
                      isTrialing ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm text-gray-500">Current Plan</p>
                          <p className="text-2xl font-bold text-gray-900 capitalize">
                            {planConfig.name}
                            {planConfig.price > 0 && (
                              <span className="text-base font-normal text-gray-500 ml-2">
                                {formatPrice(planConfig.price)}/mo
                              </span>
                            )}
                          </p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                          currentOrg.status === 'active' ? 'bg-green-100 text-green-700' :
                          currentOrg.status === 'trial' ? 'bg-yellow-100 text-yellow-700' :
                          currentOrg.status === 'suspended' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {currentOrg.status === 'active' ? (
                            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                          ) : currentOrg.status === 'trial' ? (
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Trial</span>
                          ) : (
                            <span className="capitalize">{currentOrg.status}</span>
                          )}
                        </span>
                      </div>

                      {/* Trial countdown */}
                      {isTrialing && (
                        <div className="flex items-center gap-2 p-3 bg-yellow-100 rounded-lg text-yellow-800 text-sm">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>
                            {trialDaysLeft > 0
                              ? `Your trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}. Upgrade to keep your features.`
                              : 'Your trial has expired. Upgrade now to continue using premium features.'}
                          </span>
                        </div>
                      )}

                      {/* Subscription end date */}
                      {currentOrg.subscription_ends_at && currentOrg.status === 'active' && (
                        <p className="text-sm text-gray-500 mt-2">
                          Next billing date: {new Date(currentOrg.subscription_ends_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Usage Cards */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Current Usage</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        label: 'Team Members',
                        current: usage?.users ?? '—',
                        max: currentOrg.max_users || 5,
                        icon: Users,
                      },
                      {
                        label: 'Projects',
                        current: usage?.projects ?? '—',
                        max: currentOrg.max_projects || 10,
                        icon: Building2,
                      },
                      {
                        label: 'Requisitions/mo',
                        current: usage?.requisitions_this_month ?? '—',
                        max: currentOrg.max_requisitions_per_month || 100,
                        icon: TrendingUp,
                      },
                    ].map((item) => {
                      const IconComp = item.icon
                      const { label, current, max } = item
                      const isUnlimited = max === -1
                      const percentage = isUnlimited ? 0 : (typeof current === 'number' ? (current / max) * 100 : 0)
                      const isNearLimit = !isUnlimited && percentage >= 80
                      const isAtLimit = !isUnlimited && percentage >= 100

                      return (
                        <div key={label} className="p-4 bg-white border border-gray-200 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <IconComp className="w-4 h-4 text-gray-400" />
                              <p className="text-sm text-gray-500">{label}</p>
                            </div>
                            {isAtLimit && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          </div>
                          <p className={`text-2xl font-bold ${
                            isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-900'
                          }`}>
                            {billingLoading ? (
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            ) : (
                              <>
                                {typeof current === 'number' ? current : current}
                                <span className="text-base font-normal text-gray-400">
                                  {' / '}{isUnlimited ? '∞' : max}
                                </span>
                              </>
                            )}
                          </p>
                          {!isUnlimited && typeof current === 'number' && (
                            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Upgrade CTA */}
                {currentOrg.plan !== 'enterprise' && isOwner && (
                  <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          {currentOrg.plan === 'free' ? 'Upgrade to unlock more' : 'Need more capacity?'}
                        </h3>
                        <p className="text-blue-100 mb-4 text-sm">
                          Get more users, projects, and advanced features with a higher plan.
                        </p>
                      </div>
                      <ArrowUpRight className="w-6 h-6 text-blue-200 flex-shrink-0" />
                    </div>
                    <button
                      onClick={() => navigate('/billing/plans')}
                      className="px-5 py-2.5 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      View Plans & Pricing
                    </button>
                  </div>
                )}

                {/* Billing History */}
                {billingHistory.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Billing History</h3>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left p-3 font-medium text-gray-500">Event</th>
                            <th className="text-left p-3 font-medium text-gray-500">Date</th>
                            <th className="text-right p-3 font-medium text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingHistory.map((event) => (
                            <tr key={event.id} className="border-b border-gray-50 last:border-0">
                              <td className="p-3">
                                <span className="capitalize text-gray-900">
                                  {event.event_type.replace(/_/g, ' ')}
                                </span>
                                {event.plan_to && (
                                  <span className="text-xs text-gray-500 ml-2 capitalize">
                                    → {event.plan_to}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-gray-500">
                                {new Date(event.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-right font-medium text-gray-900">
                                {event.amount_cents > 0
                                  ? `$${(event.amount_cents / 100).toFixed(2)}`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
