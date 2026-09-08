import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as ReactDOM from 'react-dom';

export interface SelectOption {
  value: string;
  label: ReactNode;
  tone?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variant?: 'field' | 'badge';
  badgeTone?: string;
  disabled?: boolean;
}

// Dropdown chung — phong cách giống dropdown khách hàng (CustomerSearch)
export default function Select({
  value,
  options,
  onChange,
  placeholder = 'Chọn...',
  className = '',
  variant = 'field',
  badgeTone = '',
  disabled = false
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    openUp: boolean;
    maxHeight: number;
  } | null>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const estHeight = Math.min(12 + options.length * 41, 300);
    const openUp = below < estHeight + 8 && rect.top > below;
    setPos({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      openUp,
      maxHeight: Math.min(300, (openUp ? rect.top : below) - 8)
    });
  }, [options.length]);

  const selected = options.find((o) => o.value === value);

  const TONE_COLOR: Record<string, string> = {
    'badge-gray': 'var(--text-muted)',
    'badge-red': 'var(--danger)',
    'badge-yellow': 'var(--warning)',
    'badge-amber': 'var(--amber)',
    'badge-green': 'var(--success)',
    'badge-blue': 'var(--info)',
    'badge-purple': 'var(--violet)'
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current && !triggerRef.current.contains(t)) {
        if (panelRef.current && !panelRef.current.contains(t)) {
          setOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [open]);

  const portalStyle = {
    position: 'fixed' as const,
    top: pos?.top,
    bottom: pos?.bottom,
    left: pos?.left,
    width: pos?.width,
    zIndex: 9999,
    maxHeight: pos?.maxHeight ?? 300,
    overflow: 'auto' as const
  };

  if (variant === 'badge') {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          className={`badge ${badgeTone || selected?.tone || ''} select-badge ${open ? 'open' : ''}`}
          onClick={() => {
            if (disabled) return;
            updatePos();
            setOpen((o) => !o);
          }}
          disabled={disabled}
        >
          {selected?.label || placeholder}
        </button>
        {open && pos &&
          ReactDOM.createPortal(
            <div ref={panelRef} className="cust-dropdown dropdown" style={portalStyle}>
              {options.map((o) => (
                <div
                  key={o.value}
                  className={`cust-dropdown-item dropdown-item ${o.value === value ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </div>
              ))}
            </div>,
            document.body
          )}
      </>
    );
  }

  return (
    <div className={`select-custom ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className={`select-custom-trigger ${open ? 'open' : ''} ${selected ? '' : 'placeholder'}`}
        onClick={() => {
          if (disabled) return;
          updatePos();
          setOpen((o) => !o);
        }}
        disabled={disabled}
      >
        <span
          className="select-custom-value"
          style={selected?.tone ? { color: TONE_COLOR[selected.tone] || undefined, fontWeight: 600 } : undefined}
        >
          {selected?.label || placeholder}
        </span>
        <span className="select-custom-chev">▾</span>
      </button>
      {open && pos &&
        ReactDOM.createPortal(
          <div ref={panelRef} className="cust-dropdown dropdown" style={portalStyle}>
            {options.length === 0 && <div className="cust-dropdown-empty dropdown-empty">Không có lựa chọn</div>}
            {options.map((o) => (
              <div
                key={o.value}
                className={`cust-dropdown-item dropdown-item ${o.value === value ? 'selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}