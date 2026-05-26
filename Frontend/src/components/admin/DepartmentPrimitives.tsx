import React from 'react';

type PrimitiveValue = React.ReactNode;

interface MiniMetricProps {
  label: string;
  value: PrimitiveValue;
  className?: string;
}

export const MiniMetric: React.FC<MiniMetricProps> = ({ label, value, className = '' }) => (
  <span className={`block rounded-lg border border-border bg-card px-2.5 py-2 shadow-sm ${className}`}>
    <span className="block truncate text-body-sm font-black text-on-surface">{value}</span>
    <span className="mt-0.5 block truncate text-[10px] font-black uppercase text-muted-foreground">{label}</span>
  </span>
);

interface LabeledValueProps {
  label: string;
  value: PrimitiveValue;
  className?: string;
}

export const LabeledValue: React.FC<LabeledValueProps> = ({ label, value, className = '' }) => (
  <div className={`min-w-0 rounded-lg border border-border bg-card px-3 py-2 ${className}`}>
    <p className="truncate text-label-sm font-bold uppercase text-muted-foreground">{label}</p>
    <p className="mt-1 truncate text-body-sm font-semibold text-on-surface">{value}</p>
  </div>
);

export interface SummaryChipItem {
  key: string | number;
  label: React.ReactNode;
  title?: string;
}

interface SummaryChipsProps {
  items: SummaryChipItem[];
  visible?: number;
  empty?: string;
  className?: string;
}

export const SummaryChips: React.FC<SummaryChipsProps> = ({
  items,
  visible = items.length,
  empty = 'No records mapped',
  className = '',
}) => {
  if (items.length === 0) {
    return <p className="text-body-sm font-semibold text-muted-foreground">{empty}</p>;
  }

  const visibleItems = items.slice(0, visible);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {visibleItems.map((item) => (
        <span
          key={item.key}
          title={item.title}
          className="inline-flex min-h-7 max-w-full items-center rounded-lg border border-border bg-card px-2.5 py-1 text-label-sm font-black text-on-surface shadow-sm"
        >
          <span className="truncate">{item.label}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex min-h-7 items-center rounded-lg border border-border bg-surface-container px-2.5 py-1 text-label-sm font-black text-muted-foreground">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
};
