import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Product, StockAdjustment } from '../types';
import { fmtDateTime, fmtNumber } from '../format';
import Modal from '../components/Modal';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

const REASONS = ['Kiểm kê', 'Hư hỏng / mất mát', 'Nhập sai số liệu', 'Bổ sung', 'Khác'];

export default function StockAdjustments() {
  const { toast } = useToast();
  const [items, setItems] = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState('');
  const [newStock, setNewStock] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [adj, prods] = await Promise.all([api.getStockAdjustments(), api.getProducts()]);
      setItems(adj);
      setProducts(prods);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId), [productId, products]);

  function openCreate() {
    setProductId('');
    setNewStock('');
    setReason(REASONS[0]);
    setNote('');
    setShowForm(true);
  }

  async function submit() {
    if (!productId) {
      toast('Vui lòng chọn sản phẩm.', 'err');
      return;
    }
    if (newStock === '' || Number(newStock) < 0) {
      toast('Tồn kho mới không hợp lệ.', 'err');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createStockAdjustment({ productId, newStock: Number(newStock), reason, note });
      toast(`Đã điều chỉnh kho: ${res.changeQty >= 0 ? '+' : ''}${fmtNumber(res.changeQty)}.`);
      setShowForm(false);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Kiểm kê / Điều chỉnh kho</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Điều chỉnh kho
        </button>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Chưa có phiếu điều chỉnh kho.</div>
      ) : (
        <div className="order-cards">
          {items.map((a) => (
            <div className="order-card" key={a.id}>
              <div className="oc-top">
                <div className="oc-id">{a.id}</div>
                <div className="oc-badges">
                  <span className={`badge ${a.changeQty >= 0 ? 'badge-green' : 'badge-red'}`}>
                    {a.reason || 'Điều chỉnh'}
                  </span>
                </div>
              </div>

              <div className="oc-body">
                <div className="oc-customer">
                  <div className="oc-avatar oc-avatar-flat">📦</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="oc-cust-name">{a.productName}</div>
                    <div className="oc-cust-phone">{a.sku}</div>
                  </div>
                </div>

                <div className="oc-meta">
                  <div className="oc-cell">
                    <span className="ic">🕒</span>
                    <span>{fmtDateTime(a.createdAt)}</span>
                  </div>
                  <div className="oc-cell">
                    <span className="ic">📝</span>
                    <span>{a.note || '—'}</span>
                  </div>
                  <div className="oc-cell">
                    <span className="ic">👤</span>
                    <span>{a.createdBy || '—'}</span>
                  </div>
                </div>

                <div className="oc-total">
                  <span className="oc-total-label">Tồn {fmtNumber(a.oldStock)} → {fmtNumber(a.newStock)}</span>
                  <span
                    className="oc-total-val"
                    style={{ color: a.changeQty >= 0 ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {a.changeQty >= 0 ? '+' : ''}{fmtNumber(a.changeQty)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title="Điều chỉnh tồn kho"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}
              </button>
            </>
          }
        >
          <div className="form-stack">
            <div className="form-section sec-stock-prod">
              <div className="form-section-title">
                <span className="form-section-ic">📦</span>
                Sản phẩm điều chỉnh
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="primary" req>
                    Sản phẩm
                  </FieldLabel>
                  <Select
                    value={productId}
                    placeholder="— Chọn sản phẩm —"
                    options={products.map((p) => ({
                      value: p.id,
                      label: `${p.name} (tồn: ${fmtNumber(p.stock)})`
                    }))}
                    onChange={(v) => setProductId(v)}
                  />
                </div>
                {selectedProduct && (
                  <>
                    <div className="field">
                      <FieldLabel tone="muted">Tồn kho hiện tại</FieldLabel>
                      <input className="field-input" readOnly value={fmtNumber(selectedProduct.stock)} />
                    </div>
                    <div className="field">
                      <FieldLabel tone="success" req>
                        Tồn kho mới
                      </FieldLabel>
                      <input
                        type="number"
                        min={0}
                        className="field-input"
                        value={newStock}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewStock(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="form-section sec-stock-reason">
              <div className="form-section-title">
                <span className="form-section-ic">⚠️</span>
                Lý do &amp; ghi chú
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="danger" req>
                    Lý do
                  </FieldLabel>
                  <Select
                    value={reason}
                    options={REASONS.map((r) => ({ value: r, label: r }))}
                    onChange={(v) => setReason(v)}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="muted">Ghi chú</FieldLabel>
                  <textarea className="field-input" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}