import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { OrganizationProvider } from './context/OrganizationContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import ErrorBoundary from './components/common/ErrorBoundary'
import PageLoader from './components/common/PageLoader'

// Auth pages - loaded eagerly for fast initial load
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import OrganizationSignup from './pages/auth/OrganizationSignup'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

// Dashboard - loaded eagerly as it's the main landing page
import Dashboard from './pages/dashboard/DashboardEnhanced'

// Lazy-loaded pages for code splitting
// Organizations
const CreateOrganization = lazy(() => import('./pages/organizations/CreateOrganization'))
const OrganizationSettings = lazy(() => import('./pages/organizations/OrganizationSettings'))

// Requisitions
const RequisitionsList = lazy(() => import('./pages/requisitions/RequisitionsList'))
const CreateRequisition = lazy(() => import('./pages/requisitions/CreateRequisition'))
const RequisitionDetail = lazy(() => import('./pages/requisitions/RequisitionDetail'))
const TemplatesManagement = lazy(() => import('./pages/requisitions/TemplatesManagement'))

// Users
const UsersList = lazy(() => import('./pages/users/UsersList'))
const InviteUser = lazy(() => import('./pages/users/InviteUser'))
const UserDetail = lazy(() => import('./pages/users/UserDetail'))

// Projects
const ProjectsList = lazy(() => import('./pages/projects/ProjectsList'))
const CreateProject = lazy(() => import('./pages/projects/CreateProject'))
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'))

// Expense Accounts
const ExpenseAccountsList = lazy(() => import('./pages/expense-accounts/ExpenseAccountsList'))
const CreateExpenseAccount = lazy(() => import('./pages/expense-accounts/CreateExpenseAccount'))
const ExpenseAccountDetail = lazy(() => import('./pages/expense-accounts/ExpenseAccountDetail'))

// Items
const ItemsList = lazy(() => import('./pages/items/ItemsList'))
const CreateItem = lazy(() => import('./pages/items/CreateItem'))
const ItemDetail = lazy(() => import('./pages/items/ItemDetail'))

// Settings
const UserSettings = lazy(() => import('./pages/settings/UserSettings'))
const SystemSettings = lazy(() => import('./pages/settings/SystemSettings'))

// Reports - heavy component, good candidate for lazy loading
const ReportsEnhanced = lazy(() => import('./pages/reports/ReportsEnhanced'))

// Connection Test (for testing)
const ConnectionTest = lazy(() => import('./pages/ConnectionTest'))

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <OrganizationProvider>
          <NotificationProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/signup-organization" element={<OrganizationSignup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/connection-test" element={<ConnectionTest />} />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />

                    {/* Organization routes */}
                    <Route path="organizations/new" element={<CreateOrganization />} />
                    <Route path="settings/organization" element={<OrganizationSettings />} />

                    {/* Requisitions routes */}
                    <Route path="requisitions" element={<RequisitionsList />} />
                  <Route path="requisitions/create" element={<CreateRequisition />} />
                  <Route path="requisitions/edit/:id" element={<CreateRequisition />} />
              <Route path="requisitions/templates" element={<TemplatesManagement />} />
              <Route path="requisitions/:id" element={<RequisitionDetail />} />

              {/* User management routes */}
              <Route path="users" element={<UsersList />} />
              <Route path="users/invite" element={<InviteUser />} />
              <Route path="users/:id" element={<UserDetail />} />

              {/* Projects routes */}
              <Route path="projects" element={<ProjectsList />} />
              <Route path="projects/create" element={<CreateProject />} />
              <Route path="projects/edit/:id" element={<CreateProject />} />
              <Route path="projects/:id" element={<ProjectDetail />} />

              {/* Expense Accounts routes */}
              <Route path="expense-accounts" element={<ExpenseAccountsList />} />
              <Route path="expense-accounts/create" element={<CreateExpenseAccount />} />
              <Route path="expense-accounts/edit/:id" element={<CreateExpenseAccount />} />
              <Route path="expense-accounts/:id" element={<ExpenseAccountDetail />} />

              {/* Items routes */}
              <Route path="items" element={<ItemsList />} />
              <Route path="items/create" element={<CreateItem />} />
              <Route path="items/edit/:id" element={<CreateItem />} />
              <Route path="items/:id" element={<ItemDetail />} />

              <Route
                path="purchase-orders"
                element={<div className="text-center py-12 text-gray-500">Purchase Orders page coming soon...</div>}
              />
              <Route
                path="receipts"
                element={<div className="text-center py-12 text-gray-500">Receipts page coming soon...</div>}
              />

              {/* Reports */}
              <Route path="reports" element={<ReportsEnhanced />} />

              {/* Settings */}
              <Route path="settings" element={<UserSettings />} />
              <Route path="profile" element={<UserSettings />} />
              <Route path="admin/system-settings" element={<SystemSettings />} />
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
          </NotificationProvider>
        </OrganizationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
