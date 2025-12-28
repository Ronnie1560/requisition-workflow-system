import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

// Dashboard
import Dashboard from './pages/dashboard/DashboardEnhanced'

// Requisitions
import RequisitionsList from './pages/requisitions/RequisitionsList'
import CreateRequisition from './pages/requisitions/CreateRequisition'
import RequisitionDetail from './pages/requisitions/RequisitionDetail'
import TemplatesManagement from './pages/requisitions/TemplatesManagement'

// Users
import UsersList from './pages/users/UsersList'
import InviteUser from './pages/users/InviteUser'
import UserDetail from './pages/users/UserDetail'

// Projects
import ProjectsList from './pages/projects/ProjectsList'
import CreateProject from './pages/projects/CreateProject'
import ProjectDetail from './pages/projects/ProjectDetail'

// Expense Accounts
import ExpenseAccountsList from './pages/expense-accounts/ExpenseAccountsList'
import CreateExpenseAccount from './pages/expense-accounts/CreateExpenseAccount'
import ExpenseAccountDetail from './pages/expense-accounts/ExpenseAccountDetail'

// Items
import ItemsList from './pages/items/ItemsList'
import CreateItem from './pages/items/CreateItem'
import ItemDetail from './pages/items/ItemDetail'

// Settings
import UserSettings from './pages/settings/UserSettings'
import SystemSettings from './pages/settings/SystemSettings'

// Reports
import ReportsEnhanced from './pages/reports/ReportsEnhanced'

// Connection Test (for testing)
import ConnectionTest from './pages/ConnectionTest'

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
