import React from 'react';

interface PageTitleProps {
  title: string;
  subtitle?: string;
  breadcrumbs: string[];
}

export const PageTitle: React.FC<PageTitleProps> = ({ title, subtitle, breadcrumbs }) => {
  return (
    <div className="mb-6">
      <nav className="flex items-center space-x-2 text-label-md text-on-surface-variant mb-2">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span className={idx === breadcrumbs.length - 1 ? 'text-primary font-bold' : ''}>{crumb}</span>
            {idx < breadcrumbs.length - 1 && <span className="opacity-50 text-[10px]">/</span>}
          </React.Fragment>
        ))}
      </nav>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-body-md text-on-surface-variant mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
  type?: 'success' | 'warning' | 'error' | 'default';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'default' }) => {
  const styles = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    default: 'bg-surface-container text-on-surface-variant border-outline-variant',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border ${styles[type]}`}>
      {status}
    </span>
  );
};
