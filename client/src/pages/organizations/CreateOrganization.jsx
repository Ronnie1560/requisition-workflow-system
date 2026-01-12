import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowLeft, Loader2 } from 'lucide-react'
import { useOrganization } from '../../context/OrganizationContext'

/**
 * Create Organization Page
 * Allows users to create a new organization
 */
export default function CreateOrganization() {
  const navigate = useNavigate()
  const { createOrganization } = useOrganization()
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Auto-generate slug from name
  const handleNameChange = (e) => {
    const name = e.target.value
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    
    setFormData(prev => ({ ...prev, name, slug }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (!formData.name.trim()) {
      setError('Organization name is required')
      setLoading(false)
      return
    }

    if (!formData.slug.trim()) {
      setError('Organization URL is required')
      setLoading(false)
      return
    }

    if (formData.slug.length < 3) {
      setError('Organization URL must be at least 3 characters')
      setLoading(false)
      return
    }

    const { error: createError } = await createOrganization(formData)

    if (createError) {
      setError(createError)
      setLoading(false)
    }
    // On success, createOrganization will reload the page
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            Create Organization
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Icon */}
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Set up your organization
            </h2>
            <p className="text-gray-600 mb-8">
              Create a new organization to manage requisitions, projects, and team members.
            </p>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Organization Name */}
              <div>
                <label 
                  htmlFor="name" 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={loading}
                />
              </div>

              {/* Slug (URL) */}
              <div>
                <label 
                  htmlFor="slug" 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Organization URL <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">
                    app.pcm.com/
                  </span>
                  <input
                    id="slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    }))}
                    placeholder="acme"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={3}
                    maxLength={50}
                    disabled={loading}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  This will be your organization&apos;s unique URL. Only lowercase letters, numbers, and hyphens.
                </p>
              </div>

              {/* Contact Email */}
              <div>
                <label 
                  htmlFor="email" 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Contact Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@acme.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>

              {/* Plan Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Free Plan Includes
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>✓ Up to 5 team members</li>
                  <li>✓ Up to 10 projects</li>
                  <li>✓ 100 requisitions per month</li>
                  <li>✓ Basic reports</li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                  You can upgrade your plan anytime in settings.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Organization'
                )}
              </button>
            </form>
          </div>

          {/* Footer Note */}
          <p className="text-center text-sm text-gray-500 mt-6">
            By creating an organization, you agree to our{' '}
            <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  )
}
