import Modal from './Modal';
import { fmtDateTime, fmtMoney, fmtNumber } from '../format';
import type { ReactNode } from 'react';
import type { ImportRecord } from '../types';

export default function ImportDetailModal({ imp, onClose }: { imp: ImportRecord; onClose: () => void }) {
  const rows: [string, ReactNode][] = [
    ['Mã phiếu', <b key="id">{imp.id}</b>],
    ['Ngày nhập', fmtDateTime(imp.createdAt)],
    ['Nhà cung cấp', imp.supplierName || '—'],
    ['Vận chuyển', imp.carrier || '—'],
    ['Phí ship', fmtMoney(imp.shippingFee || 0)],
    ['Tổng tiền', <b key="total" className="money-primary">{fmtMoney(imp.totalAmount)}</b>],
    ['Đã trả', <b key="paid" className="money-in">{fmtMoney(imp.paidAmount)}</b>],
    [
      'Còn nợ NCC',
      imp.remainingAmount > 0 ? (
        <b key="debt" className="money-debt">
          {fmtMoney(imp.remainingAmount)}
        </b>
      ) : (
        <span key="nodebt" className="badge badge-green">Đã trả đủ</span>
      )
    ]
  ];

  return (
    <Modal title={`Chi tiết nhập hàng · ${imp.id}`} onClose={onClose} sheet maxWidth={520}>
      <div className="detail-rows">
        {rows.map(([k, v]) => (
          <div className="detail-row" key={k}>
            <span className="detail-k">{k}</span>
            <span className="detail-v">{v}</span>
          </div>
        ))}
      </div>

      <div className="form-section-title" style={{ marginTop: 14 }}>
        📦 Sản phẩm ({imp.items.length})
      </div>
      <div className="sp-items">
        {imp.items.map((it, idx) => (
          <div className="sp-item" key={idx}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.productName}
            </span>
            <span className="muted">
              SL {fmtNumber(it.quantity)} × {fmtMoney(it.importPrice)}
            </span>
            <span className="money-primary" style={{ whiteSpace: 'nowrap' }}>
              {fmtMoney(it.quantity * it.importPrice)}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
