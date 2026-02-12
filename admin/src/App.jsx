import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'

// Lazy-load all authenticated pages — only LoginPage loads eagerly
const Dashboard = lazy(() => import('./pages/Dashboard'))
const TenantsPage = lazy(() => import('./pages/TenantsPage'))
const TenantDetailPage = lazy(() => import('./pages/TenantDetailPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const SecuritySettingsPage = lazy(() => import('./pages/SecuritySettingsPage'))

function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  )
}

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
              <Suspense fallback={<PageSpinner />}>
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
              </Suspense>
            </AdminLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
