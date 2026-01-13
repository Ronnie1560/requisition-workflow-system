import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'

const ConnectionTest = () => {
  const [connectionStatus, setConnectionStatus] = useState('testing')
  const [error, setError] = useState(null)
  const [projectInfo, setProjectInfo] = useState(null)

  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    setConnectionStatus('testing')
    setError(null)

    try {
      // Test 1: Check if Supabase client is initialized
      if (!supabase) {
        throw new Error('Supabase client is not initialized')
      }

      // Test 2: Try to get the current session (this will work even without authentication)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError && sessionError.message !== 'Auth session missing!') {
        throw sessionError
      }

      // Test 3: Try to query a system table to verify connection
      const { error: queryError } = await supabase
        .from('_non_existent_table_test')
        .select('*')
        .limit(1)

      // We expect an error here (table doesn't exist), but if we get a specific error
      // about the table not existing, it means we successfully connected to Supabase
      if (queryError) {
        // Check if it's a "relation does not exist" error, which is actually good!
        if (queryError.message.includes('relation') ||
            queryError.message.includes('does not exist') ||
            queryError.code === '42P01' ||
            queryError.code === 'PGRST116') {
          setConnectionStatus('connected')
          setProjectInfo({
            url: import.meta.env.VITE_SUPABASE_URL,
            hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
            sessionExists: !!sessionData?.session
          })
        } else {
          throw queryError
        }
      } else {
        // Unexpected success - table exists
        setConnectionStatus('connected')
        setProjectInfo({
          url: import.meta.env.VITE_SUPABASE_URL,
          hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
          sessionExists: !!sessionData?.session
        })
      }
    } catch (err) {
      logger.error('Connection test failed:', err)
      setConnectionStatus('failed')
      setError(err.message || 'Unknown error occurred')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            PCM Requisition System
          </h1>
          <p className="text-gray-600">Supabase Connection Test</p>
        </div>

        <div className="space-y-6">
          {/* Connection Status */}
          <div className="border-2 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Connection Status
            </h2>

            <div className="flex items-center gap-3">
              {connectionStatus === 'testing' && (
                <>
                  <div className="w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-yellow-700 font-medium">Testing connection...</span>
                </>
              )}

              {connectionStatus === 'connected' && (
                <>
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="text-green-700 font-medium">Connected successfully!</span>
                </>
              )}

              {connectionStatus === 'failed' && (
                <>
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-red-700 font-medium">Connection failed</span>
                </>
              )}
            </div>
          </div>

          {/* Project Information */}
          {projectInfo && (
            <div className="border-2 rounded-lg p-6 bg-green-50">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Project Information
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Supabase URL:</span>
                  <span className="font-mono text-sm text-gray-800 truncate ml-2">
                    {projectInfo.url || 'Not configured'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Anon Key Configured:</span>
                  <span className={`font-medium ${projectInfo.hasAnonKey ? 'text-green-600' : 'text-red-600'}`}>
                    {projectInfo.hasAnonKey ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Session:</span>
                  <span className={`font-medium ${projectInfo.sessionExists ? 'text-green-600' : 'text-gray-600'}`}>
                    {projectInfo.sessionExists ? 'Yes' : 'No (Not logged in)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Information */}
          {error && (
            <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
              <h2 className="text-xl font-semibold mb-4 text-red-800">
                Error Details
              </h2>
              <p className="text-red-700 font-mono text-sm break-words">
                {error}
              </p>
              <div className="mt-4 text-sm text-red-600">
                <p className="font-semibold mb-2">Troubleshooting tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verify your Supabase URL in .env.local</li>
                  <li>Verify your Supabase Anon Key in .env.local</li>
                  <li>Make sure your Supabase project is active</li>
                  <li>Check your internet connection</li>
                  <li>Restart the development server after changing .env.local</li>
                </ul>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={testConnection}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Test Connection Again
            </button>
          </div>

          {/* Next Steps */}
          {connectionStatus === 'connected' && (
            <div className="border-2 border-green-300 rounded-lg p-6 bg-green-50">
              <h2 className="text-xl font-semibold mb-4 text-green-800">
                Next Steps
              </h2>
              <ul className="list-disc list-inside space-y-2 text-green-700">
                <li>Create database tables in Supabase</li>
                <li>Set up authentication</li>
                <li>Build requisition forms</li>
                <li>Implement approval workflows</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConnectionTest
