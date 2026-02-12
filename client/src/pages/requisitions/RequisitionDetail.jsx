import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrganization } from '../../context/OrganizationContext'
import {
  ArrowLeft,
  Calendar,
  User,
  Building,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  FileSpreadsheet,
  Download
} from 'lucide-react'
import {
  getRequisitionById,
  startReview,
  markAsReviewed,
  approveRequisition,
  rejectRequisition,
  addComment
} from '../../services/api/requisitions'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { STATUS_LABELS } from '../../utils/constants'
import RequisitionPrintDialog from '../../components/dialogs/RequisitionPrintDialog'
import { logger } from '../../utils/logger'

const RequisitionDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { currentOrg } = useOrganization()

  const [requisition, setRequisition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalAction, setApprovalAction] = useState(null) // 'approve' or 'reject'
  const [approvalComments, setApprovalComments] = useState('')
  const [processing, setProcessing] = useState(false)

  // Comments state
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  useEffect(() => {
    loadRequisition()
  }, [id])

  const loadRequisition = async () => {
    setLoading(true)
    const { data, error } = await getRequisitionById(id)
    if (error) {
      setError('Failed to load requisition')
      logger.error('Error:', error)
    } else {
      setRequisition(data)
    }
    setLoading(false)
  }

  const getStatusBadgeClass = (status) => {
    const statusStyles = {
      'draft': 'bg-gray-100 text-gray-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'under_review': 'bg-blue-100 text-blue-800',
      'reviewed': 'bg-blue-100 text-blue-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-600',
      'partially_received': 'bg-purple-100 text-purple-800',
      'completed': 'bg-indigo-100 text-indigo-800'
    }
    return statusStyles[status] || 'bg-gray-100 text-gray-800'
  }

  const handleApprove = () => {
    setApprovalAction('approve')
    setShowApprovalModal(true)
  }

  const handleReject = () => {
    setApprovalAction('reject')
    setShowApprovalModal(true)
  }

  const handleApprovalSubmit = async () => {
    if (approvalAction === 'reject' && !approvalComments.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    setProcessing(true)
    setError('')

    try {
      let result
      if (approvalAction === 'approve') {
        result = await approveRequisition(id, user.id, approvalComments)
      } else if (approvalAction === 'reject') {
        result = await rejectRequisition(id, user.id, approvalComments)
      } else if (approvalAction === 'reviewed') {
        result = await markAsReviewed(id, user.id, approvalComments)
      }

      if (result.error) throw result.error

      setShowApprovalModal(false)
      setApprovalComments('')
      await loadRequisition() // Reload to show updated status
    } catch (err) {
      setError(err.message || 'Failed to process requisition')
    } finally {
      setProcessing(false)
    }
  }

  const handleStartReview = async () => {
    setProcessing(true)
    setError('')

    try {
      const result = await startReview(id, user.id)
      if (result.error) throw result.error
      await loadRequisition()
    } catch (err) {
      setError(err.message || 'Failed to start review')
    } finally {
      setProcessing(false)
    }
  }

  const handleMarkAsReviewed = () => {
    setApprovalAction('reviewed')
    setShowApprovalModal(true)
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setAddingComment(true)
    setError('')

    try {
      const result = await addComment({
        requisition_id: id,
        user_id: user.id,
        comment_text: newComment,
        is_internal: false
      })

      if (result.error) throw result.error

      setNewComment('')
      await loadRequisition() // Reload to show new comment
    } catch (err) {
      setError(err.message || 'Failed to add comment')
    } finally {
      setAddingComment(false)
    }
  }

  // Reviewers can start review (pending) or mark as reviewed (under_review)
  // BUT they cannot review their own requisitions (conflict of interest)
  const canReview = () => {
    if (!profile || !requisition || !user) return false
    const status = requisition.status
    const isReviewer = ['reviewer', 'super_admin'].includes(profile.role)
    const isOwnRequisition = requisition.submitted_by === user.id

    // Reviewers cannot review their own requisitions (conflict of interest)
    if (isOwnRequisition && profile.role === 'reviewer') {
      return false
    }

    return isReviewer && (status === 'pending' || status === 'under_review')
  }

  // Check if user can edit this draft
  const canEditDraft = () => {
    if (!requisition || !user) return false
    return requisition.status === 'draft' && requisition.submitted_by === user.id
  }

  // Approvers can only approve/reject requisitions that are 'reviewed'
  const canApprove = () => {
    if (!profile || !requisition || !user) return false
    const status = requisition.status
    const isOwnRequisition = requisition.submitted_by === user.id

    // Super admin can approve at any stage
    if (profile.role === 'super_admin') {
      return status === 'reviewed' || status === 'pending' || status === 'under_review'
    }

    // Approvers cannot approve their own requisitions (conflict of interest)
    if (isOwnRequisition && profile.role === 'approver') {
      return false
    }

    // Regular approvers can only approve reviewed requisitions
    const isApprover = profile.role === 'approver'
    return isApprover && status === 'reviewed'
  }

  const canReject = () => {
    if (!profile || !requisition || !user) return false
    const status = requisition.status
    const isOwnRequisition = requisition.submitted_by === user.id

    // Super admin can reject at any stage
    if (profile.role === 'super_admin') {
      return status === 'pending' || status === 'under_review' || status === 'reviewed'
    }

    // Reviewers can reject during review, but NOT their own requisitions
    const isReviewer = profile.role === 'reviewer'
    if (isReviewer) {
      // Cannot reject own requisitions
      if (isOwnRequisition) return false
      return status === 'pending' || status === 'under_review'
    }

    // Approvers can reject reviewed requisitions, but NOT their own
    const isApprover = profile.role === 'approver'
    if (isApprover) {
      // Cannot reject own requisitions
      if (isOwnRequisition) return false
      return status === 'reviewed'
    }

    return false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading requisition...</p>
        </div>
      </div>
    )
  }

  if (error && !requisition) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!requisition) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Requisition not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/requisitions')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{requisition.title}</h1>
            <p className="text-sm text-gray-600">{requisition.requisition_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Print & Export Dialog Button */}
          <button
            onClick={() => setShowPrintDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            title="Preview, Print & Export"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Preview & Export
          </button>
          {canEditDraft() && (
            <button
              onClick={() => navigate(`/requisitions/edit/${requisition.id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Edit className="w-5 h-5" />
              Edit Draft
            </button>
          )}
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(requisition.status)}`}
          >
            {STATUS_LABELS[requisition.status] || requisition.status}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Requisition Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Requisition Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Building className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">Project</p>
              <p className="font-medium">{requisition.project?.name}</p>
              <p className="text-sm text-gray-500">{requisition.project?.code}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">Expense Account</p>
              <p className="font-medium">
                {requisition.expense_account?.name || '-'}
              </p>
              <p className="text-sm text-gray-500">
                {requisition.expense_account?.code || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">Submitted By</p>
              <p className="font-medium">{requisition.submitted_by_user?.full_name || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">Submitted On</p>
              <p className="font-medium">
                {requisition.submitted_at ? formatDate(requisition.submitted_at) : 'Not submitted'}
              </p>
            </div>
          </div>

          {requisition.required_by && (
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Required By</p>
                <p className="font-medium">{formatDate(requisition.required_by)}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="font-medium text-lg">{formatCurrency(requisition.total_amount)}</p>
            </div>
          </div>
        </div>

        {requisition.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-1">Description</p>
            <p className="text-gray-800">{requisition.description}</p>
          </div>
        )}

        {requisition.justification && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-1">Justification</p>
            <p className="text-gray-800">{requisition.justification}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            {requisition.requisition_items?.length || 0} {(requisition.requisition_items?.length || 0) === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">UOM</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requisition.requisition_items?.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{item.line_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{item.item?.name}</p>
                    <p className="text-xs text-gray-500">{item.item?.code}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.item_description || '-'}
                    {item.notes && (
                      <p className="text-xs text-indigo-600 mt-1 italic">Note: {item.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-center">{item.uom?.name}</td>
                  <td className="px-4 py-3 text-sm text-center">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan="6" className="px-4 py-3 text-right font-semibold">Grand Total:</td>
                <td className="px-4 py-3 text-right font-bold text-lg">
                  {formatCurrency(requisition.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Attachments */}
      {requisition.attachments && requisition.attachments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Attachments</h2>
          <div className="space-y-2">
            {requisition.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">{attachment.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {(attachment.file_size / 1024).toFixed(1)} KB • {formatDate(attachment.created_at)}
                    </p>
                  </div>
                </div>
                <a
                  href={attachment.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-200 rounded"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Comments & Activity</h2>

        {/* Existing Comments */}
        <div className="space-y-4 mb-6">
          {requisition.comments && requisition.comments.length > 0 ? (
            requisition.comments.map((comment) => (
              <div key={comment.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{comment.user?.full_name}</span>
                  <span className="text-xs text-gray-500">
                    {formatDate(comment.created_at)}
                  </span>
                  {comment.user?.role && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                      {comment.user.role}
                    </span>
                  )}
                </div>
                <p className="text-gray-700">{comment.comment_text}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No comments yet</p>
          )}
        </div>

        {/* Add Comment */}
        <div className="border-t pt-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="3"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleAddComment}
              disabled={addingComment || !newComment.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingComment ? 'Adding...' : 'Add Comment'}
            </button>
          </div>
        </div>
      </div>

      {/* Review Actions (for Reviewers) */}
      {canReview() && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Review Actions</h2>
          <div className="flex gap-3">
            {requisition.status === 'pending' && (
              <button
                onClick={handleStartReview}
                disabled={processing}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Clock className="w-5 h-5" />
                {processing ? 'Starting...' : 'Start Review'}
              </button>
            )}
            {requisition.status === 'under_review' && (
              <button
                onClick={handleMarkAsReviewed}
                disabled={processing}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                Mark as Reviewed
              </button>
            )}
            {canReject() && (
              <button
                onClick={handleReject}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <AlertCircle className="w-5 h-5" />
                Reject
              </button>
            )}
          </div>
        </div>
      )}

      {/* Approval Actions (for Approvers) */}
      {(canApprove() || (canReject() && !canReview())) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Approval Actions</h2>
          <div className="flex gap-3">
            {canApprove() && (
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-5 h-5" />
                Approve
              </button>
            )}
            {canReject() && !canReview() && (
              <button
                onClick={handleReject}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <AlertCircle className="w-5 h-5" />
                Reject
              </button>
            )}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {approvalAction === 'approve' ? 'Approve Requisition' :
               approvalAction === 'reject' ? 'Reject Requisition' :
               'Mark as Reviewed'}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {approvalAction === 'reject' ? 'Reason for Rejection *' : 'Comments (Optional)'}
              </label>
              <textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder={
                  approvalAction === 'approve'
                    ? 'Add any comments about this approval...'
                    : 'Please provide a reason for rejection...'
                }
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowApprovalModal(false)
                  setApprovalComments('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={handleApprovalSubmit}
                disabled={processing || (approvalAction === 'reject' && !approvalComments.trim())}
                className={`px-4 py-2 rounded-lg text-white ${
                  approvalAction === 'approve' || approvalAction === 'reviewed'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processing
                  ? 'Processing...'
                  : approvalAction === 'approve'
                  ? 'Approve'
                  : approvalAction === 'reject'
                  ? 'Reject'
                  : 'Mark as Reviewed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Dialog */}
      <RequisitionPrintDialog
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        requisition={requisition}
        organization={currentOrg}
      />
    </div>
  )
}

export default RequisitionDetail
