import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Drawer = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // sm, md, lg, xl, full
  position = 'right' // right, left
}) => {
  // Prevent body scroll when drawer is open
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

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full'
  };

  const positionClasses = {
    right: 'right-0',
    left: 'left-0'
  };

  const slideAnimation = {
    right: isOpen ? 'translate-x-0' : 'translate-x-full',
    left: isOpen ? 'translate-x-0' : '-translate-x-full'
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 ${positionClasses[position]} bottom-0 z-50 w-full ${sizeClasses[size]} bg-white shadow-2xl transform transition-transform duration-300 ease-out ${slideAnimation[position]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 id="drawer-title" className="text-xl font-bold text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              aria-label="Close drawer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-24 custom-scrollbar">
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default Drawer;
