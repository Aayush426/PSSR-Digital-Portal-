import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Minus, Plus, Search, X } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
  helper?: string;
  group?: string;
}

interface MappingSectionProps {
  title: string;
  detail: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
}

export const MappingSection: React.FC<MappingSectionProps> = ({ title, detail, children, actions, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-body-md font-black text-on-surface">{title}</span>
          <span className="mt-1 block text-body-sm text-muted-foreground">{detail}</span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4">
          {actions && <div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div>}
          {children}
        </div>
      )}
    </section>
  );
};

interface SearchableSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, value, options, onChange, placeholder = 'Search options', disabled }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.helper ?? ''} ${option.group ?? ''}`.toLowerCase().includes(needle));
  }, [options, search]);
  const selected = options.find((option) => option.value === value);

  return (
    <label className="block">
      <span className="text-label-sm font-bold uppercase text-muted-foreground">{label}</span>
      <div className="mt-1 rounded-lg border border-border bg-card p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
          <input
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={selected ? selected.label : placeholder}
            className="h-9 w-full rounded border border-outline-variant bg-surface pl-9 pr-3 text-body-sm outline-none focus:border-primary disabled:opacity-60"
          />
        </div>
        <div className="mt-2 max-h-44 overflow-y-auto">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(option.value);
                setSearch('');
              }}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-body-sm hover:bg-surface-container-low disabled:opacity-60 ${option.value === value ? 'bg-primary/10 text-primary' : 'text-on-surface'}`}
            >
              <Check className={`mt-0.5 h-4 w-4 shrink-0 ${option.value === value ? 'opacity-100' : 'opacity-0'}`} />
              <span className="min-w-0">
                <span className="block font-bold">{option.label}</span>
                {option.helper && <span className="block text-label-sm text-muted-foreground">{option.helper}</span>}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2 py-3 text-body-sm font-semibold text-muted-foreground">No matching options.</p>}
        </div>
      </div>
    </label>
  );
};

interface SegmentedControlProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ label, value, options, onChange }) => (
  <div>
    <p className="text-label-sm font-bold uppercase text-muted-foreground">{label}</p>
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-lg border px-3 py-1.5 text-label-sm font-black transition-colors ${value === option.value ? 'border-primary bg-primary text-on-primary' : 'border-border bg-card text-on-surface-variant hover:border-primary hover:text-primary'}`}
          title={option.helper}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

interface FixedSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

export const FixedSelect: React.FC<FixedSelectProps> = ({ label, value, options, onChange }) => (
  <label className="block">
    <span className="text-label-sm font-bold uppercase text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-body-sm font-bold text-on-surface outline-none focus:border-primary"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
);

interface TileSelectorProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

export const TileSelector: React.FC<TileSelectorProps> = ({ label, value, options, onChange }) => (
  <div>
    <p className="text-label-sm font-bold uppercase text-muted-foreground">{label}</p>
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg border p-3 text-left transition-colors ${value === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-on-surface hover:border-primary/60'}`}
        >
          <span className="block text-body-sm font-black">{option.label}</span>
          {option.helper && <span className="mt-1 block text-label-sm font-semibold text-muted-foreground">{option.helper}</span>}
        </button>
      ))}
    </div>
  </div>
);

interface ChipMultiSelectProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export const ChipMultiSelect: React.FC<ChipMultiSelectProps> = ({ label, options, selected, onChange, placeholder = 'Search and add' }) => {
  const [search, setSearch] = useState('');
  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const available = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return options
      .filter((option) => !selected.includes(option.value))
      .filter((option) => !needle || `${option.label} ${option.helper ?? ''} ${option.group ?? ''}`.toLowerCase().includes(needle));
  }, [options, search, selected]);

  return (
    <div>
      <p className="text-label-sm font-bold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <span key={option.value} className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-label-sm font-black text-primary">
              {option.label}
              <button type="button" onClick={() => onChange(selected.filter((item) => item !== option.value))} aria-label={`Remove ${option.label}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {selectedOptions.length === 0 && <p className="text-body-sm font-semibold text-muted-foreground">No selections yet.</p>}
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} className="h-9 w-full rounded border border-outline-variant bg-surface pl-9 pr-3 text-body-sm outline-none focus:border-primary" />
        </div>
        <div className="mt-2 grid max-h-52 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
          {available.map((option) => (
            <button key={option.value} type="button" onClick={() => onChange([...selected, option.value])} className="rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-primary hover:bg-primary/5">
              <span className="block text-body-sm font-black text-on-surface">{option.label}</span>
              {option.helper && <span className="mt-0.5 block text-label-sm text-muted-foreground">{option.helper}</span>}
            </button>
          ))}
          {available.length === 0 && <p className="px-1 py-2 text-body-sm font-semibold text-muted-foreground">No more matching options.</p>}
        </div>
      </div>
    </div>
  );
};

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const Stepper: React.FC<StepperProps> = ({ label, value, onChange, min = 1, max = 999, step = 1 }) => {
  const update = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  return (
    <div>
      <p className="text-label-sm font-bold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 inline-flex h-10 items-center overflow-hidden rounded-lg border border-border bg-card">
        <button type="button" onClick={() => update(value - step)} className="flex h-full w-10 items-center justify-center border-r border-border text-on-surface-variant hover:bg-surface-container-low">
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-16 px-4 text-center text-body-sm font-black text-on-surface">{value}</span>
        <button type="button" onClick={() => update(value + step)} className="flex h-full w-10 items-center justify-center border-l border-border text-on-surface-variant hover:bg-surface-container-low">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
