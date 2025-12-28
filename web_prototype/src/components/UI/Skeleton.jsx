import React from 'react';

const Skeleton = ({
  variant = 'text',
  width = 'full',
  height,
  className = '',
  count = 1,
  circle = false
}) => {
  const variants = {
    text: 'rounded',
    rectangular: 'rounded-lg',
    circle: 'rounded-full',
  };

  const getHeightClass = () => {
    if (height) return `h-${height}`;
    if (variant === 'text') return 'h-4';
    if (variant === 'rectangular') return 'h-32';
    if (circle) return 'h-12';
    return 'h-4';
  };

  const getWidthClass = () => {
    if (width === 'full') return 'w-full';
    return `w-${width}`;
  };

  const baseClasses = `
    bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200
    bg-[length:200%_100%]
    animate-shimmer
    ${circle || variant === 'circle' ? 'rounded-full' : variants[variant]}
    ${getWidthClass()}
    ${getHeightClass()}
    ${className}
  `;

  if (count > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={baseClasses} />
        ))}
      </div>
    );
  }

  return <div className={baseClasses} />;
};

// Preset skeleton layouts
export const SkeletonCard = () => (
  <div className="bg-white rounded-xl p-6 space-y-4 border border-neutral-200">
    <div className="flex items-center gap-4">
      <Skeleton variant="circle" width="12" height="12" />
      <div className="flex-1 space-y-2">
        <Skeleton width="3/4" />
        <Skeleton width="1/2" />
      </div>
    </div>
    <Skeleton variant="rectangular" height="24" />
    <div className="flex gap-2">
      <Skeleton width="20" />
      <Skeleton width="20" />
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5 }) => (
  <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
    <div className="p-4 border-b border-neutral-200">
      <Skeleton width="48" />
    </div>
    <div className="divide-y divide-neutral-100">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="p-4 flex items-center gap-4">
          <Skeleton width="8" />
          <Skeleton width="32" />
          <Skeleton width="24" />
          <Skeleton width="16" className="ml-auto" />
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonDashboard = () => (
  <div className="space-y-6">
    <Skeleton height="8" className="w-1/3" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl p-6 space-y-3 border border-neutral-200">
          <Skeleton variant="circle" width="12" height="12" />
          <Skeleton width="20" />
          <Skeleton height="8" className="w-2/3" />
        </div>
      ))}
    </div>
    <SkeletonTable rows={8} />
  </div>
);

export default Skeleton;
