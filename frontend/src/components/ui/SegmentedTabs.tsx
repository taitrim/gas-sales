import type { ReactNode } from 'react';

interface SegmentedTabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}

// Tab dạng segmented — mobile friendly, full width
export default function SegmentedTabs<T extends string>({ value, onChange, options, className = '' }: SegmentedTabsProps<T>) {
  return (
    <div className={`seg ${className}`.trim()} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}