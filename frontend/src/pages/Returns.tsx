import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ReturnRecord } from '../types';
import { fmtDateTime, fmtMoney, fmtNumber } from '../format';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

export default function Returns() {
  const { toast } = useToast();
  const [items, setItems] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ReturnRecord | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.getReturns());
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }

  const totalRefund = items.reduce((s, r) => s + r.refundAmount, 0);

  return (
    <div>
      <div className="page-head">
        <h1>Trả hàng / Hoàn tiền</h1>
        <button className="btn btn-primary" onClick={load}>
          ⟳ Làm mới
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card tone-slate">
          <div className="stat-icon">🔄</div>
          <div className="stat-body">
            <div className="label">Số phiếu trả</div>
            <div className="value">{items.length}</div>
          </div>
        </div>
        <div className="stat-card tone-amber">
          <div className="stat-icon">💸</div>
          <div className="stat-body">
            <div className="label">Tổng hoàn tiền</div>
            <div className="value">{fmtMoney(totalRefund)}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Chưa có phiếu trả hàng.</div>
      ) : (
        <div className="order-cards">
          {items.map((r) => {
            const qty = r.items.reduce((s, it) => s + Number(it.quantity), 0);
            return (
              <div
                className="order-card is-clickable"
                key={r.id}
                role="button"
                tabIndex={0}
                aria-label={`Xem chi tiết phiếu trả ${r.id}`}
                onClick={() => setDetail(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetail(r);
                  }
                }}
              >
                <div className="oc-top">
                  <div className="oc-id">{r.id}</div>
                  <div className="oc-badges">
                    <span className="badge badge-gray">Đơn {r.orderId}</span>
                  </div>
                </div>

                <div className="oc-body">
                  <div className="oc-customer">
                    <div className="oc-avatar">{(r.customerName || 'K').charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="oc-cust-name">{r.customerName || 'Khách lẻ'}</div>
                      <div className="oc-cust-phone">{fmtDateTime(r.createdAt)}</div>
                    </div>
                  </div>

                  <div className="oc-meta">
                    <div className="oc-cell">
                      <span className="ic">📦</span>
                      <span>
                        {r.items.length} món · {fmtNumber(qty)} SL
                      </span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">📝</span>
                      <span>{r.reason || '—'}</span>
                    </div>
                  </div>

                  <div className="oc-total">
                    <span className="oc-total-label">Hoàn tiền</span>
                    <span className="oc-total-val money-out">{fmtMoney(r.refundAmount)}</span>
                  </div>
                </div>

                <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-link" onClick={() => setDetail(r)}>
                    Chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <Modal title={`Phiếu trả ${detail.id}`} onClose={() => setDetail(null)} wide>
          <div className="stats-grid" style={{ marginBottom: 14 }}>
            <div className="stat-card tone-slate">
              <div className="stat-icon">🛒</div>
              <div className="stat-body">
                <div className="label">Đơn gốc</div>
                <div className="value" style={{ fontSize: 16 }}>{detail.orderId}</div>
              </div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-icon">💸</div>
              <div className="stat-body">
                <div className="label">Hoàn tiền</div>
                <div className="value">{fmtMoney(detail.refundAmount)}</div>
              </div>
            </div>
          </div>
          <div className="card table-wrap" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="right">SL</th>
                  <th className="right">Giá</th>
                  <th className="right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i}>
                    <td data-label="Sản phẩm">
                      {it.productName}
                      <div className="muted">{it.sku}</div>
                    </td>
                    <td data-label="SL" className="right">{fmtNumber(it.quantity)}</td>
                    <td data-label="Giá" className="right">{fmtMoney(it.price)}</td>
                    <td data-label="Thành tiền" className="right">{fmtMoney(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}