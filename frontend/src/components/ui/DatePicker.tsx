import { useCallback, useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { fmtDate } from '../../format';

interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WD_NUMS = [2, 3, 4, 5, 6, 7, 1];
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export default function DatePicker({ value, onChange, placeholder = 'Chọn ngày...' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    openUp: boolean;
  } | null>(null);

  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const selected = value ? new Date(value + 'T00:00:00') : null;

  const updatePos = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const estHeight = 320;
      const openUp = below < estHeight + 8 && rect.top > below;
      setPos({
        left: rect.left,
        width: rect.width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        openUp
      });
    }
  }, []);

  const toggle = useCallback(() => {
    updatePos();
    setOpen((o) => !o);
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
      if (triggerRef.current && !triggerRef.current.contains(t)) {
        if (panelRef.current && !panelRef.current.contains(t)) {
          setOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [open]);

  useEffect(() => {
    if (open && selected) {
      setView({ year: selected.getFullYear(), month: selected.getMonth() });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstDay = new Date(view.year, view.month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (y: number, m: number, d: number) =>
    y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
  const isSelected = (y: number, m: number, d: number) =>
    !!selected && y === selected.getFullYear() && m === selected.getMonth() && d === selected.getDate();

  const portalStyle = {
    position: 'fixed' as const,
    top: pos?.top,
    bottom: pos?.bottom,
    left: pos?.left,
    width: pos?.width,
    zIndex: 9999
  };

  return (
    <div className="date-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`select-custom-trigger ${open ? 'open' : ''} ${selected ? '' : 'placeholder'}`}
        onClick={toggle}
      >
        <span className="select-custom-value">{selected ? fmtDate(value) : placeholder}</span>
        <span className="select-custom-chev">▾</span>
      </button>
      {open && pos &&
        ReactDOM.createPortal(
          <div ref={panelRef} className="cust-dropdown dropdown date-panel" style={portalStyle}>
            <div className="date-head">
              <button type="button" className="date-nav" onClick={() => setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))}>
                ‹
              </button>
              <span className="date-title">
                {MONTHS[view.month]} {view.year}
              </span>
              <button type="button" className="date-nav" onClick={() => setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))}>
                ›
              </button>
            </div>
            <div className="date-grid">
              {WEEKDAYS.map((w, i) => (
                <span key={w} className="date-wd" data-wd={WD_NUMS[i]}>
                  {w}
                </span>
              ))}
              {cells.map((d, i) =>
                d === null ? (
                  <span key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    className={`date-cell ${isToday(view.year, view.month, d) ? 'today' : ''} ${isSelected(view.year, view.month, d) ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(toISO(view.year, view.month, d));
                      setOpen(false);
                    }}
                  >
                    {d}
                  </button>
                )
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}