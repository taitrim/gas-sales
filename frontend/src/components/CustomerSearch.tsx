import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';

export interface CustomerLike {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface CustomerSearchProps {
  customers: CustomerLike[];
  selectedId: string;
  selectedName?: string;
  selectedPhone?: string;
  onSelect: (c: CustomerLike) => void;
  placeholder?: string;
  collapsed?: boolean;
}

export default function CustomerSearch({
  customers,
  selectedId,
  selectedName,
  selectedPhone,
  onSelect,
  placeholder = 'Tìm khách hàng (tên/SĐT)...',
  collapsed = false
}: CustomerSearchProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    openUp: boolean;
    maxHeight: number;
  } | null>(null);

  const updatePos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const estHeight = Math.min(12 + customers.length * 48, 280);
      const openUp = below < estHeight + 8 && rect.top > below;
      setPos({
        left: rect.left,
        width: rect.width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        openUp,
        maxHeight: Math.min(280, (openUp ? rect.top : below) - 8)
      });
    }
  }, [customers.length]);

  const openDropdown = useCallback(() => {
    updatePos();
    setOpen(true);
  }, [updatePos]);

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
      if (inputRef.current && !inputRef.current.contains(t)) {
        if (dropdownRef.current && !dropdownRef.current.contains(t)) {
          setOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }, [customers, search]);

  const label = selectedId ? selectedName || customers.find((c) => c.id === selectedId)?.name : '';

  function handleSelect(c: CustomerLike) {
    onSelect(c);
    setSearch('');
    setOpen(false);
    setEditing(false);
  }

  const isCollapsed = collapsed && !!selectedId && !!label && !editing;

  if (isCollapsed) {
    return (
      <div className="cust-search">
        <button
          type="button"
          className="cust-search-chip"
          onClick={() => {
            setEditing(true);
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                openDropdown();
              }
            });
          }}
        >
          <span className="cust-search-avatar">{label.charAt(0).toUpperCase()}</span>
          <span className="cust-search-info">
            <b>{label}</b>
            {selectedPhone && <small>{selectedPhone}</small>}
          </span>
          <span className="cust-search-edit" title="Đổi khách hàng">✏️</span>
        </button>
      </div>
    );
  }

  const portalStyle = {
    position: 'fixed' as const,
    top: pos?.top,
    bottom: pos?.bottom,
    left: pos?.left,
    width: pos?.width,
    zIndex: 9999,
    maxHeight: pos?.maxHeight ?? 260,
    overflow: 'auto' as const
  };

  return (
    <div className="cust-search">
      <div className="cust-search-wrap">
        <input
          ref={inputRef}
          type="text"
          className="cust-search-input field-input"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            openDropdown();
          }}
          onFocus={openDropdown}
          autoComplete="off"
        />
      </div>
      {selectedId && label && (
        <div className="cust-search-selected">
          Đã chọn: <b>{label}</b>{' '}
          {selectedPhone && `(${selectedPhone})`}
        </div>
      )}
      {open && pos && filtered.length > 0 &&
        ReactDOM.createPortal(
          <div ref={dropdownRef} className="cust-dropdown dropdown" style={portalStyle}>
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`cust-dropdown-item dropdown-item ${c.id === selectedId ? 'selected' : ''}`}
                onClick={() => handleSelect(c)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="cust-dropdown-item-name dropdown-item-name">{c.name}</div>
                {c.phone && <div className="cust-dropdown-item-phone dropdown-item-phone">{c.phone}</div>}
              </div>
            ))}
          </div>,
          document.body
        )}
      {open && pos && search && filtered.length === 0 &&
        ReactDOM.createPortal(
          <div ref={dropdownRef} className="cust-dropdown dropdown" style={portalStyle}>
            <div className="cust-dropdown-empty dropdown-empty">Không tìm thấy khách hàng</div>
          </div>,
          document.body
        )}
    </div>
  );
}