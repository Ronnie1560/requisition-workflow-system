import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { getCurrentOrgId } from './orgContext'

/**
 * Reports API Service
 * Handles fetching data for various reports and analytics
 */

/**
 * Get requisitions grouped by status
 */
export const getRequisitionsByStatus = async (startDate = null, endDate = null) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('requisitions')
      .select('id, status, total_amount, created_at, requisition_number')
      .eq('org_id', orgId) // Filter by current organization
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by status
    const grouped = data.reduce((acc, req) => {
      const status = req.status || 'unknown'
      if (!acc[status]) {
        acc[status] = {
          status,
          count: 0,
          totalAmount: 0,
          requisitions: []
        }
      }
      acc[status].count++
      acc[status].totalAmount += req.total_amount || 0
      acc[status].requisitions.push(req)
      return acc
    }, {})

    return { data: Object.values(grouped), error: null }
  } catch (error) {
    logger.error('Error fetching requisitions by status:', error)
    return { data: null, error }
  }
}

/**
 * Get requisitions grouped by submitter
 */
export const getRequisitionsBySubmitter = async (startDate = null, endDate = null) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('requisitions')
      .select(`
        id,
        status,
        total_amount,
        created_at,
        requisition_number,
        submitted_by_user:users!requisitions_submitted_by_fkey(id, full_name, email)
      `)
      .eq('org_id', orgId) // Filter by current organization
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by submitter
    const grouped = data.reduce((acc, req) => {
      const userId = req.submitted_by_user?.id || 'unknown'
      const userName = req.submitted_by_user?.full_name || 'Unknown User'
      const userEmail = req.submitted_by_user?.email || ''

      if (!acc[userId]) {
        acc[userId] = {
          userId,
          userName,
          userEmail,
          totalRequisitions: 0,
          draftCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          totalAmount: 0,
          approvedAmount: 0,
          requisitions: []
        }
      }

      acc[userId].totalRequisitions++
      acc[userId].totalAmount += req.total_amount || 0

      // Count by status
      if (req.status === 'draft') acc[userId].draftCount++
      if (req.status === 'pending' || req.status === 'under_review') acc[userId].pendingCount++
      if (req.status === 'approved') {
        acc[userId].approvedCount++
        acc[userId].approvedAmount += req.total_amount || 0
      }
      if (req.status === 'rejected') acc[userId].rejectedCount++

      acc[userId].requisitions.push(req)
      return acc
    }, {})

    return { data: Object.values(grouped), error: null }
  } catch (error) {
    logger.error('Error fetching requisitions by submitter:', error)
    return { data: null, error }
  }
}

/**
 * Get requisitions grouped by project
 */
export const getRequisitionsByProject = async (startDate = null, endDate = null) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('requisitions')
      .select(`
        id,
        status,
        total_amount,
        created_at,
        requisition_number,
        project:projects(id, code, name, budget)
      `)
      .eq('org_id', orgId) // Filter by current organization
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by project
    const grouped = data.reduce((acc, req) => {
      const projectId = req.project?.id || 'no-project'
      const projectCode = req.project?.code || 'N/A'
      const projectName = req.project?.name || 'No Project'
      const projectBudget = req.project?.budget || 0

      if (!acc[projectId]) {
        acc[projectId] = {
          projectId,
          projectCode,
          projectName,
          projectBudget,
          totalRequisitions: 0,
          draftCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          totalAmount: 0,
          approvedAmount: 0,
          budgetUtilization: 0,
          requisitions: []
        }
      }

      acc[projectId].totalRequisitions++
      acc[projectId].totalAmount += req.total_amount || 0

      // Count by status
      if (req.status === 'draft') acc[projectId].draftCount++
      if (req.status === 'pending' || req.status === 'under_review') acc[projectId].pendingCount++
      if (req.status === 'approved') {
        acc[projectId].approvedCount++
        acc[projectId].approvedAmount += req.total_amount || 0
      }
      if (req.status === 'rejected') acc[projectId].rejectedCount++

      acc[projectId].requisitions.push(req)
      return acc
    }, {})

    // Calculate budget utilization
    Object.values(grouped).forEach(project => {
      if (project.projectBudget > 0) {
        project.budgetUtilization = (project.approvedAmount / project.projectBudget) * 100
      }
    })

    return { data: Object.values(grouped), error: null }
  } catch (error) {
    logger.error('Error fetching requisitions by project:', error)
    return { data: null, error }
  }
}

/**
 * Get spending by expense account
 */
export const getSpendingByExpenseAccount = async (startDate = null, endDate = null) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('requisitions')
      .select(`
        id,
        status,
        total_amount,
        created_at,
        requisition_number,
        expense_account:expense_accounts(id, code, name, description),
        requisition_items(id, total_price)
      `)
      .eq('org_id', orgId) // Filter by current organization
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by expense account
    const grouped = {}

    data.forEach(req => {
      const expenseAccount = req.expense_account
      if (expenseAccount) {
        const accountId = expenseAccount.id
        const accountCode = expenseAccount.code
        const accountName = expenseAccount.name

        if (!grouped[accountId]) {
          grouped[accountId] = {
            accountId,
            accountCode,
            accountName,
            totalSpent: 0,
            approvedSpent: 0,
            pendingSpent: 0,
            requisitionCount: 0,
            itemCount: 0
          }
        }

        grouped[accountId].totalSpent += req.total_amount || 0
        grouped[accountId].itemCount += req.requisition_items?.length || 0
        grouped[accountId].requisitionCount++

        if (req.status === 'approved') {
          grouped[accountId].approvedSpent += req.total_amount || 0
        } else if (req.status === 'pending' || req.status === 'under_review' || req.status === 'reviewed') {
          grouped[accountId].pendingSpent += req.total_amount || 0
        }
      }
    })

    const result = Object.values(grouped)

    return { data: result, error: null }
  } catch (error) {
    logger.error('Error fetching spending by expense account:', error)
    return { data: null, error }
  }
}

/**
 * Get spending by time period
 */
export const getSpendingByTimePeriod = async (period = 'monthly', startDate = null, endDate = null) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('requisitions')
      .select('id, status, total_amount, created_at, requisition_number')
      .eq('org_id', orgId) // Filter by current organization
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by time period
    const grouped = {}

    data.forEach(req => {
      const date = new Date(req.created_at)
      let periodKey

      if (period === 'monthly') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else if (period === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        periodKey = `${date.getFullYear()}-Q${quarter}`
      } else if (period === 'yearly') {
        periodKey = `${date.getFullYear()}`
      }

      if (!grouped[periodKey]) {
        grouped[periodKey] = {
          period: periodKey,
          totalSpent: 0,
          approvedSpent: 0,
          pendingSpent: 0,
          rejectedSpent: 0,
          requisitionCount: 0,
          approvedCount: 0,
          pendingCount: 0,
          rejectedCount: 0
        }
      }

      grouped[periodKey].totalSpent += req.total_amount || 0
      grouped[periodKey].requisitionCount++

      if (req.status === 'approved') {
        grouped[periodKey].approvedSpent += req.total_amount || 0
        grouped[periodKey].approvedCount++
      } else if (req.status === 'pending' || req.status === 'under_review' || req.status === 'reviewed') {
        grouped[periodKey].pendingSpent += req.total_amount || 0
        grouped[periodKey].pendingCount++
      } else if (req.status === 'rejected') {
        grouped[periodKey].rejectedSpent += req.total_amount || 0
        grouped[periodKey].rejectedCount++
      }
    })

    // Sort by period
    const result = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period))

    return { data: result, error: null }
  } catch (error) {
    logger.error('Error fetching spending by time period:', error)
    return { data: null, error }
  }
}

/**
 * Get spending trends over time (always monthly for granular trend view)
 */
export const getSpendingTrends = async (startDate = null, endDate = null) => {
  try {
    // Use the monthly period function for trends
    const result = await getSpendingByTimePeriod('monthly', startDate, endDate)

    if (result.error) throw result.error

    // Calculate trends (month-over-month changes)
    const trendsData = result.data.map((item, index, array) => {
      const trend = {
        ...item,
        changeFromPrevious: 0,
        percentageChange: 0
      }

      if (index > 0) {
        const previous = array[index - 1]
        trend.changeFromPrevious = item.approvedSpent - previous.approvedSpent
        if (previous.approvedSpent > 0) {
          trend.percentageChange = (trend.changeFromPrevious / previous.approvedSpent) * 100
        }
      }

      return trend
    })

    return { data: trendsData, error: null }
  } catch (error) {
    logger.error('Error fetching spending trends:', error)
    return { data: null, error }
  }
}

/**
 * Export data to CSV format
 */
export const exportToCSV = (data, filename, columns) => {
  try {
    // Create CSV header
    const headers = columns.map(col => col.label).join(',')

    // Create CSV rows
    const rows = data.map(row => {
      return columns.map(col => {
        let value = col.accessor(row)
        // Handle values with commas by wrapping in quotes
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`
        }
        return value
      }).join(',')
    })

    // Combine header and rows
    const csv = [headers, ...rows].join('\n')

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    return { success: true, error: null }
  } catch (error) {
    logger.error('Error exporting to CSV:', error)
    return { success: false, error }
  }
}

/**
 * Get spending by project and expense account
 * Groups requisitions by project, then by expense account within each project
 */
export const getSpendingByProjectAndExpenseAccount = async (startDate = null, endDate = null, projectId = null) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('requisitions')
      .select(`
        id,
        status,
        total_amount,
        created_at,
        requisition_number,
        project:projects(id, code, name),
        expense_account:expense_accounts(id, code, name, project_id),
        requisition_items(id, total_price)
      `)
      .eq('org_id', orgId) // Filter by current organization
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    // Apply project filter if provided
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by project, then by expense account
    const projectGroups = {}

    data.forEach(req => {
      const project = req.project
      const expenseAccount = req.expense_account

      if (!project || !expenseAccount) return

      const projectId = project.id
      const accountId = expenseAccount.id

      // Initialize project group if it doesn't exist
      if (!projectGroups[projectId]) {
        projectGroups[projectId] = {
          projectId,
          projectCode: project.code,
          projectName: project.name,
          totalSpent: 0,
          approvedSpent: 0,
          pendingSpent: 0,
          requisitionCount: 0,
          expenseAccounts: {}
        }
      }

      // Initialize expense account within project if it doesn't exist
      if (!projectGroups[projectId].expenseAccounts[accountId]) {
        projectGroups[projectId].expenseAccounts[accountId] = {
          accountId,
          accountCode: expenseAccount.code,
          accountName: expenseAccount.name,
          totalSpent: 0,
          approvedSpent: 0,
          pendingSpent: 0,
          requisitionCount: 0,
          itemCount: 0
        }
      }

      // Add to project totals
      projectGroups[projectId].totalSpent += req.total_amount || 0
      projectGroups[projectId].requisitionCount++

      // Add to expense account totals
      const accountGroup = projectGroups[projectId].expenseAccounts[accountId]
      accountGroup.totalSpent += req.total_amount || 0
      accountGroup.itemCount += req.requisition_items?.length || 0
      accountGroup.requisitionCount++

      if (req.status === 'approved') {
        projectGroups[projectId].approvedSpent += req.total_amount || 0
        accountGroup.approvedSpent += req.total_amount || 0
      } else if (req.status === 'pending' || req.status === 'under_review' || req.status === 'reviewed') {
        projectGroups[projectId].pendingSpent += req.total_amount || 0
        accountGroup.pendingSpent += req.total_amount || 0
      }
    })

    // Convert nested objects to arrays
    const result = Object.values(projectGroups).map(project => ({
      ...project,
      expenseAccounts: Object.values(project.expenseAccounts)
    }))

    return { data: result, error: null }
  } catch (error) {
    logger.error('Error fetching spending by project and expense account:', error)
    return { data: null, error }
  }
}
