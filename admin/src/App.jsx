import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import TenantsPage from './pages/TenantsPage'
import TenantDetailPage from './pages/TenantDetailPage'
import UsersPage from './pages/UsersPage'
import BillingPage from './pages/BillingPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditLogPage from './pages/AuditLogPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import FeedbackPage from './pages/FeedbackPage'
import SecuritySettingsPage from './pages/SecuritySettingsPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/tenants/:id" element={<TenantDetailPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/security" element={<SecuritySettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
