import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrganization } from '../../context/OrganizationContext'
import NotificationCenter from '../notifications/NotificationCenter'
import ToastContainer from '../notifications/ToastContainer'
import OrganizationSwitcher from '../organizations/OrganizationSwitcher'
import CreateOrganizationPrompt from '../organizations/CreateOrganizationPrompt'
import ReportsQuickViewDialog from '../dialogs/ReportsQuickViewDialog'
import TrialBanner from '../billing/TrialBanner'
import {
  Menu,
  X,
  Home,
  FileText,
  Package,
  Receipt,
  Settings,
  LogOut,
  User,
  Users,
  Search,
  ChevronDown,
  Folder,
  CreditCard,
  Box,
  Sliders,
  BarChart3,
  Building2,
  MessageSquareText
} from 'lucide-react'

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showReportsDialog, setShowReportsDialog] = useState(false)
  const { user, profile, signOut } = useAuth()
  const { currentOrg: _currentOrg, canManageOrg } = useOrganization()
  const navigate = useNavigate()
  const location = useLocation()

  // If user is not authenticated, don't render the layout
  // This prevents navigation from being visible after logout
  // Check !user first to ensure immediate hide on logout (regardless of loading state)
  if (!user) {
    return null
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Requisitions', href: '/requisitions', icon: FileText },
    { name: 'Projects', href: '/projects', icon: Folder, adminOnly: true },
    { name: 'Expense Accounts', href: '/expense-accounts', icon: CreditCard, adminOnly: true },
    { name: 'Items', href: '/items', icon: Box, adminOnly: true },
    { name: 'Purchase Orders', href: '/purchase-orders', icon: Package },
    { name: 'Receipts', href: '/receipts', icon: Receipt },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Users', href: '/users', icon: Users, adminOnly: true },
    { name: 'Feedback', href: '/feedback', icon: MessageSquareText },
    { name: 'Organization', href: '/settings/organization', icon: Building2, orgAdmin: true },
    { name: 'System', href: '/admin/system-settings', icon: Sliders, adminOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings }
  ]

  // Filter navigation based on user role and org permissions
  const filteredNavigation = navigation.filter(item => {
    if (item.adminOnly) {
      return profile?.role === 'super_admin'
    }
    if (item.orgAdmin) {
      return canManageOrg
    }
    return true
  })

  const handleSignOut = async () => {
    try {
      // IMPORTANT: Complete signOut BEFORE navigating
      // This ensures auth state is fully cleared before Login page mounts
      await signOut()
      // Navigate only after signOut completes
      navigate('/login')
    } catch (error) {
      // Log error but still navigate to login
      console.error('Sign out error:', error)
      navigate('/login')
    }
  }

  const isActive = (path) => {
    // Exact match
    if (location.pathname === path) return true
    
    // For /settings, don't highlight if we're on /settings/organization
    // (Organization has its own nav item)
    if (path === '/settings' && location.pathname.startsWith('/settings/organization')) {
      return false
    }
    
    // Check if current path starts with this path
    return location.pathname.startsWith(path + '/')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 fixed w-full z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side */}
            <div className="flex">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
              >
                {sidebarOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>

              {/* Logo */}
              <div className="flex-shrink-0 flex items-center ml-4 md:ml-0">
                <h1 className="text-xl font-bold text-indigo-600">
                  RWS
                </h1>
                <span className="ml-2 text-sm text-gray-600">Requisition Workflow</span>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="hidden md:block">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none sm:text-sm"
                  />
                </div>
              </div>

              {/* Quick Reports Access */}
              <button
                onClick={() => setShowReportsDialog(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Quick Reports"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="hidden lg:inline text-sm">Reports</span>
              </button>

              {/* Notifications */}
              <NotificationCenter />

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
                >
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {profile?.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-200">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {profile?.full_name}
                      </p>
                      <p className="text-xs text-gray-500">{profile?.email}</p>
                      <p className="text-xs text-indigo-600 mt-1 capitalize">
                        {profile?.role?.replace('_', ' ')}
                      </p>
                    </div>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <div className="flex pt-16">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 fixed md:static inset-y-0 left-0 z-20 w-64 bg-white border-r border-gray-200 pt-16 transition-transform duration-300 ease-in-out`}
        >
          <nav className="h-full overflow-y-auto p-4">
            {/* Organization Switcher */}
            <div className="mb-4">
              <OrganizationSwitcher />
            </div>
            
            <ul className="space-y-2">
              {filteredNavigation.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        active
                          ? 'bg-indigo-50 text-indigo-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          <TrialBanner />
          <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Organization Creation Prompt */}
      <CreateOrganizationPrompt />

      {/* Reports Quick View Dialog */}
      <ReportsQuickViewDialog
        isOpen={showReportsDialog}
        onClose={() => setShowReportsDialog(false)}
      />
    </div>
  )
}

export default MainLayout
