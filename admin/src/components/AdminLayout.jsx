import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  ScrollText,
  Megaphone,
  MessageSquareText,
  LogOut,
  Shield,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tenants', icon: Building2, label: 'Tenants' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/audit-log', icon: ScrollText, label: 'Audit Log' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/feedback', icon: MessageSquareText, label: 'Feedback' },
  { to: '/security', icon: ShieldCheck, label: 'Security' },
]

export default function AdminLayout({ children }) {
  const { platformAdmin, signOut, signingOut } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 dark:bg-gray-950 text-white flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-800">
          <Shield className="h-7 w-7 text-primary-400" />
          <div>
            <div className="font-bold text-sm tracking-wide">LedgerWorkflow</div>
            <div className="text-xs text-gray-400">Admin Platform</div>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Admin info + sign out */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-sm font-medium text-gray-200 truncate">
            {platformAdmin?.name || platformAdmin?.email}
          </div>
          <div className="text-xs text-gray-500 truncate">{platformAdmin?.email}</div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className={`mt-3 flex items-center gap-2 text-sm transition-colors ${
              signingOut
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-red-400'
            }`}
          >
            {signingOut ? (
              <div className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-6 gap-4">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {navItems.find((item) =>
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            )?.label || 'Admin'}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
