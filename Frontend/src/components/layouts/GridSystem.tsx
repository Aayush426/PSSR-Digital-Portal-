import React, { ReactNode } from 'react';

/**
 * Responsive operational grid for metrics, cards, and data summaries.
 * Provides intelligent column layouts that adapt to content and screen size.
 */

interface OperationalGridProps {
  children: ReactNode;
  /** Number of columns: 2, 3, 4 (auto-responds) */
  columns?: 2 | 3 | 4;
  /** Gap size between items */
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Don't use responsive breakpoints (fixed columns) */
  fixed?: boolean;
}

const columnMap = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
};

const gapMap = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export const OperationalGrid: React.FC<OperationalGridProps> = ({
  children,
  columns = 4,
  gap = 'md',
  className = '',
  fixed = false,
}) => {
  const colClass = columnMap[columns];
  const gapClass = gapMap[gap];
  
  return (
    <div className={`grid ${colClass} ${gapClass} w-full ${className}`}>
      {children}
    </div>
  );
};

/**
 * Simple metric card component.
 * Displays a label and value in a consistent format.
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'highlight' | 'muted';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  detail,
  icon,
  variant = 'default',
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-surface-container-lowest border border-outline-variant',
    highlight: 'bg-primary/5 border border-primary/20',
    muted: 'bg-surface-container border border-outline-variant/50',
  };

  return (
    <div className={`${variantStyles[variant]} rounded p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-tight">{label}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-headline-md font-black text-on-surface">{value}</span>
            {unit && <span className="text-body-sm text-on-surface-variant">{unit}</span>}
          </div>
          {detail && <p className="text-body-sm text-on-surface-variant mt-1">{detail}</p>}
        </div>
        {icon && <div className="shrink-0 text-outline-variant">{icon}</div>}
      </div>
    </div>
  );
};

/**
 * Info panel for grouped related information.
 */
interface InfoPanelProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  variant?: 'default' | 'bordered' | 'subtle';
  className?: string;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  title,
  children,
  actions,
  variant = 'default',
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-surface-container-lowest border border-outline-variant',
    bordered: 'border-l-4 border-l-primary bg-primary/5',
    subtle: 'bg-surface-container border-0',
  };

  return (
    <div className={`${variantStyles[variant]} rounded p-4 ${className}`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-headline-sm font-black text-on-surface">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
};

/**
 * Compact profile grid for key-value pairs.
 */
interface ProfileGridProps {
  items: Array<[label: string, value: string | number | ReactNode]>;
  columns?: 1 | 2;
  className?: string;
}

export const ProfileGrid: React.FC<ProfileGridProps> = ({
  items,
  columns = 2,
  className = '',
}) => {
  return (
    <div className={`grid ${columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4 ${className}`}>
      {items.map((item, idx) => (
        <div key={idx} className="space-y-0.5">
          <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-tight">{item[0]}</p>
          <p className="text-body-md font-semibold text-on-surface">{item[1]}</p>
        </div>
      ))}
    </div>
  );
};

/**
 * Config card for displaying configuration with actions.
 */
interface ConfigCardProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: Array<[label: string, value: string | number | ReactNode]>;
  actions: ReactNode;
  className?: string;
}

export const ConfigCard: React.FC<ConfigCardProps> = ({
  title,
  icon: Icon,
  items,
  actions,
  className = '',
}) => {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded p-4 space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
        <h4 className="text-body-md font-black text-on-surface flex-1">{title}</h4>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2 py-1">
            <span className="text-label-sm font-bold text-on-surface-variant">{item[0]}</span>
            <span className="text-body-sm font-semibold text-on-surface text-right">{item[1]}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant">{actions}</div>
    </div>
  );
};
