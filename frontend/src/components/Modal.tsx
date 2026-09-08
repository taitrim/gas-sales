import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headActions?: ReactNode;
  wide?: boolean;
  sheet?: boolean;
  maxWidth?: number;
}

// Modal chuẩn — trên mobile tự biến thành bottom-sheet trượt lên kiểu native
export default function Modal({ title, onClose, children, footer, headActions, wide, sheet, maxWidth }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`modal ${wide ? 'wide' : ''} ${sheet ? 'sheet' : ''}`}
        style={maxWidth ? { maxWidth } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          {headActions && <div className="modal-head-actions">{headActions}</div>}
          <button className="close-btn" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}