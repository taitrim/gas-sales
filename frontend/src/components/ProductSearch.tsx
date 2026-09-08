import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import type { Product } from '../types';
import { fmtMoney, fmtNumber } from '../format';

interface ProductSearchProps {
  products: Product[];
  addedIds: string[];
  onAdd: (productId: string) => void;
  placeholder?: string;
  importMode?: boolean;
}

export default function ProductSearch({
  products,
  addedIds,
  onAdd,
  placeholder = 'Thêm sản phẩm...',
  importMode = false
}: ProductSearchProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
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
      const estHeight = Math.min(12 + products.length * 52, 260);
      const openUp = below < estHeight + 8 && rect.top > below;
      setPos({
        left: rect.left,
        width: rect.width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        openUp,
        maxHeight: Math.min(260, (openUp ? rect.top : below) - 8)
      });
    }
  }, [products.length]);

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
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }, [products, search]);

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
    <div className="prod-search">
      <div className="prod-search-wrap">
        <span className="prod-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="prod-search-input field-input"
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
      {open && pos && filtered.length > 0 &&
        ReactDOM.createPortal(
          <div ref={dropdownRef} className="cust-dropdown dropdown" style={portalStyle}>
            {filtered.map((p) => {
              const added = addedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`cust-dropdown-item dropdown-item prod-item ${added ? 'added' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (added) return;
                    onAdd(p.id);
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  <div className="dropdown-item-name">{p.name}</div>
                  <div className="prod-item-sub">
                    <span className="prod-item-price">
                      {importMode ? `Nhập ${fmtMoney(p.importPrice)}` : fmtMoney(p.retailPrice)}
                    </span>
                    <span className={`prod-item-stock ${Number(p.stock) <= 0 ? 'out' : Number(p.stock) <= 10 ? 'low' : ''}`}>
                      Tồn {fmtNumber(p.stock)}
                    </span>
                    {added && <span className="prod-item-added">✓ Đã thêm</span>}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body
        )}
      {open && pos && filtered.length === 0 &&
        ReactDOM.createPortal(
          <div ref={dropdownRef} className="cust-dropdown dropdown" style={portalStyle}>
            <div className="cust-dropdown-empty dropdown-empty">Không tìm thấy sản phẩm</div>
          </div>,
          document.body
        )}
    </div>
  );
}