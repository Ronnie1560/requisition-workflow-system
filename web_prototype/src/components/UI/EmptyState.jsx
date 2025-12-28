import React from 'react';
import { Inbox, Search, AlertCircle, FileText, Users, MapPin } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  actionLabel,
  variant = 'default',
  className = ''
}) => {
  const variants = {
    default: {
      iconBg: 'bg-neutral-100',
      iconColor: 'text-neutral-400',
      titleColor: 'text-neutral-900',
      descColor: 'text-neutral-500'
    },
    primary: {
      iconBg: 'bg-primary-50',
      iconColor: 'text-primary-500',
      titleColor: 'text-neutral-900',
      descColor: 'text-neutral-600'
    },
    error: {
      iconBg: 'bg-error-50',
      iconColor: 'text-error-500',
      titleColor: 'text-error-900',
      descColor: 'text-error-600'
    },
  };

  const { iconBg, iconColor, titleColor, descColor } = variants[variant];

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className={`${iconBg} p-4 rounded-full mb-4`}>
        <Icon className={`w-12 h-12 ${iconColor}`} />
      </div>
      <h3 className={`text-lg font-semibold ${titleColor} mb-2`}>
        {title}
      </h3>
      {description && (
        <p className={`text-sm ${descColor} text-center max-w-md mb-6`}>
          {description}
        </p>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="btn btn-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// Preset empty states for common scenarios
export const EmptyTrips = ({ onAddTrip }) => (
  <EmptyState
    icon={MapPin}
    title="No Mission Trips Yet"
    description="Get started by creating your first mission trip. Track destinations, dates, and coordinate with ministry partners."
    action={onAddTrip}
    actionLabel="Create First Trip"
    variant="primary"
  />
);

export const EmptyBudgets = ({ onAddBudget }) => (
  <EmptyState
    icon={FileText}
    title="No Budgets Created"
    description="Start managing your mission finances by creating a budget. Allocate resources and track expenses for each partner."
    action={onAddBudget}
    actionLabel="Create Budget"
    variant="primary"
  />
);

export const EmptyPartners = ({ onAddPartner }) => (
  <EmptyState
    icon={Users}
    title="No Ministry Partners"
    description="Add your first ministry partner to start collaborating on mission trips and tracking their involvement."
    action={onAddPartner}
    actionLabel="Add Partner"
    variant="primary"
  />
);

export const EmptySearch = () => (
  <EmptyState
    icon={Search}
    title="No Results Found"
    description="We couldn't find anything matching your search. Try adjusting your filters or search terms."
    variant="default"
  />
);

export const ErrorState = ({ onRetry }) => (
  <EmptyState
    icon={AlertCircle}
    title="Something Went Wrong"
    description="We encountered an error loading this data. Please try again or contact support if the problem persists."
    action={onRetry}
    actionLabel="Try Again"
    variant="error"
  />
);

export default EmptyState;
