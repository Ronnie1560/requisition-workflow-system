import React, { useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';

const FullScreenModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  icon: Icon,
  iconColor = 'text-primary-600',
  iconBg = 'bg-primary-100'
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-md animate-fade-in" />

      {/* Modal Container */}
      <div className="relative h-full flex flex-col animate-scale-in">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {Icon && (
                  <div className={`p-3 rounded-xl ${iconBg}`}>
                    <Icon className={`h-8 w-8 ${iconColor}`} />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                  {subtitle && (
                    <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
                aria-label="Close modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-6 py-8 custom-scrollbar">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenModal;
