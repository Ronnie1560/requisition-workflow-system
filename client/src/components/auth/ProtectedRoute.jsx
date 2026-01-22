import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { user, loading, sessionExpired, validateSession } = useAuth()
  const location = useLocation()

  // Validate session on route change
  useEffect(() => {
    if (user && !loading) {
      validateSession()
    }
  }, [location.pathname, user, loading, validateSession])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if no user or session expired
  if (!user || sessionExpired) {
    // Pass the current location so we can redirect back after login
    return <Navigate to="/login" state={{ from: location, sessionExpired: true }} replace />
  }

  return children
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired
}

export default ProtectedRoute
