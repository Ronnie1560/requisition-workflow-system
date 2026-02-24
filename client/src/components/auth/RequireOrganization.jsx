import PropTypes from 'prop-types'
import { useNavigate, Outlet } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { AlertCircle } from 'lucide-react'

/**
 * Route-level guard that prevents rendering child routes
 * until an organization is selected. Shows a loading spinner
 * while org data is being fetched, and a helpful prompt if
 * the user has no organization.
 *
 * Usage in App.jsx:
 *   <Route element={<RequireOrganization />}>
 *     ...org-dependent routes...
 *   </Route>
 */
const RequireOrganization = () => {
  const { currentOrg, loading } = useOrganization()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 ml-4">Loading organization...</p>
      </div>
    )
  }

  if (!currentOrg) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 m-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600" />
          <div>
            <h3 className="text-yellow-900 font-semibold">No Organization Selected</h3>
            <p className="text-yellow-700 text-sm mt-1">
              Please select or create an organization to continue.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/organizations/new')}
          className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
        >
          Create Organization
        </button>
      </div>
    )
  }

  return <Outlet />
}

RequireOrganization.propTypes = {}

export default RequireOrganization
