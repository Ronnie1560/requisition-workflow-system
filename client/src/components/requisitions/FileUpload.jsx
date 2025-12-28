import { useState, useEffect, useRef } from 'react'
import { Upload, File, X, AlertCircle, Loader } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadAttachment, deleteAttachment } from '../../services/api/requisitions'
import { formatFileSize } from '../../utils/formatters'
import { logger } from '../../utils/logger'

const FileUpload = ({ requisitionId, disabled }) => {
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  useEffect(() => {
    if (requisitionId) {
      loadAttachments()
    }
  }, [requisitionId])

  const loadAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('requisition_id', requisitionId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAttachments(data || [])
    } catch (err) {
      logger.error('Error loading attachments:', err)
    }
  }

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PDF, JPEG, and PNG files are allowed')
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 5MB')
      return false
    }
    return true
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError('')

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (validateFile(file)) {
        await uploadFile(file)
      }
    }
  }

  const handleFileSelect = async (e) => {
    setError('')
    const files = Array.from(e.target.files)
    for (const file of files) {
      if (validateFile(file)) {
        await uploadFile(file)
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadFile = async (file) => {
    setUploading(true)
    setError('')

    try {
      const { data, error } = await uploadAttachment(requisitionId, file)

      if (error) throw error

      // Reload attachments
      await loadAttachments()
    } catch (err) {
      logger.error('Error uploading file:', err)
      setError(err.message || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (attachment) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) {
      return
    }

    try {
      const { error } = await deleteAttachment(attachment.id, attachment.file_path)

      if (error) throw error

      // Remove from local state
      setAttachments(attachments.filter(a => a.id !== attachment.id))
    } catch (err) {
      logger.error('Error deleting attachment:', err)
      setError('Failed to delete attachment')
    }
  }

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Attachments
      </h2>

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50'
            : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-1">
              {disabled
                ? 'Save draft first to upload attachments'
                : 'Drag and drop files here, or click to browse'}
            </p>
            <p className="text-xs text-gray-500">
              Supported formats: PDF, JPEG, PNG (max 5MB)
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mt-4 space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <File className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.file_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.file_size)} •{' '}
                    {new Date(attachment.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={attachment.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View
                </a>
                {!disabled && (
                  <button
                    onClick={() => handleDelete(attachment)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FileUpload
