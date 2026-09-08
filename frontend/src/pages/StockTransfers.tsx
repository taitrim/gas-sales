import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Product, StockTransfer, Store } from '../types';
import { fmtDateTime, fmtNumber } from '../format';
import Modal from '../components/Modal';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

interface Row {
  productId: string;
  quantity: number;
}

export default function StockTransfers() {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([{ productId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getStockTransfers()
      .then(setTransfers)
      .catch((err) => toast((err as Error).message, 'err'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
    Promise.all([api.getStores(), api.getProducts()])
      .then(([s, p]) => {
        setStores(s);
        setProducts(p);
      })
      .catch(() => {});
  }, [load]);

  function openForm() {
    setFromStoreId('');
    setToStoreId('');
    setNote('');
    setRows([{ productId: '', quantity: 1 }]);
    setShowForm(true);
  }

  function setRow(i: number, key: keyof Row, v: string | number) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: '', quantity: 1 }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    if (!fromStoreId || !toStoreId) {
      toast('Chọn kho nguồn và kho đích.', 'err');
      return;
    }
    if (fromStoreId === toStoreId) {
      toast('Kho nguồn và kho đích không được trùng.', 'err');
      return;
    }
    const items = rows.filter((r) => r.productId && Number(r.quantity) > 0);
    if (items.length === 0) {
      toast('Thêm ít nhất 1 sản phẩm.', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.createStockTransfer({
        fromStoreId,
        toStoreId,
        note: note.trim() || null,
        items
      });
      toast('Đã tạo phiếu chuyển kho.');
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
        <h1>Chuyển kho</h1>
        <button className="btn btn-primary" onClick={openForm}>
          + Phiếu chuyển kho
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row">
          <span className="muted">Chuyển tồn kho giữa các chi nhánh. Cần ít nhất 2 cửa hàng.</span>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : transfers.length === 0 ? (
        <div className="empty">Chưa có phiếu chuyển kho nào.</div>
      ) : (
        <div className="order-cards">
          {transfers.map((t) => {
            const qty = t.items.reduce((s, i) => s + Number(i.quantity), 0);
            return (
              <div className="order-card" key={t.id}>
                <div className="oc-top">
                  <div className="oc-id">{t.id}</div>
                  <div className="oc-badges">
                    <span
                      className="badge badge-blue"
                      title={`Số sản phẩm: ${t.items.length}`}
                    >
                      {t.items.length} món
                    </span>
                  </div>
                </div>

                <div className="oc-body">
                  <div className="oc-customer">
                    <div className="oc-avatar oc-avatar-flat">🚚</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="oc-cust-name">{t.fromStoreName}</div>
                      <div className="oc-cust-phone">từ kho nguồn</div>
                    </div>
                  </div>

                  <div className="oc-meta">
                    <div className="oc-cell">
                      <span className="ic">📥</span>
                      <span>
                        Đến: <b>{t.toStoreName}</b>
                      </span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">📦</span>
                      <span>{fmtNumber(qty)} SL</span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">🕒</span>
                      <span>{fmtDateTime(t.createdAt)}</span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">📝</span>
                      <span>{t.note || '—'}</span>
                    </div>
                  </div>

                  <div className="oc-total">
                    <span className="oc-total-label">Tổng SL</span>
                    <span className="oc-total-val money-primary">{fmtNumber(qty)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal
          title="Phiếu chuyển kho"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Tạo phiếu'}
              </button>
            </>
          }
        >
          <div className="form-stack">
            <div className="form-section sec-transfer-route">
              <div className="form-section-title">
                <span className="form-section-ic">🚚</span>
                Tuyến chuyển kho
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="primary" req>
                    Kho nguồn
                  </FieldLabel>
                  <Select
                    value={fromStoreId}
                    placeholder="— Chọn kho —"
                    options={stores.map((s) => ({ value: s.id, label: s.name }))}
                    onChange={(v) => setFromStoreId(v)}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="success" req>
                    Kho đích
                  </FieldLabel>
                  <Select
                    value={toStoreId}
                    placeholder="— Chọn kho —"
                    options={stores.map((s) => ({ value: s.id, label: s.name }))}
                    onChange={(v) => setToStoreId(v)}
                  />
                </div>
              </div>
            </div>

            <div className="form-section sec-transfer-note">
              <div className="form-section-title">
                <span className="form-section-ic">📝</span>
                Ghi chú
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="muted">Ghi chú</FieldLabel>
                  <textarea
                    className="field-input"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Chuyển hàng sang chi nhánh 2..."
                  />
                </div>
              </div>
            </div>

            <div className="form-section sec-transfer-items">
              <div className="form-section-title">
                <span className="form-section-ic">📦</span>
                Danh sách sản phẩm
              </div>
              <div className="form-section-body">
                {rows.map((r, i) => (
                  <div key={i} className="tier-row field full" style={{ padding: 0 }}>
                    <select
                      className="field-input"
                      style={{ flex: 2 }}
                      value={r.productId}
                      onChange={(e) => setRow(i, 'productId', e.target.value)}
                    >
                      <option value="">— Chọn sản phẩm —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({fmtNumber(p.stock)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      className="field-input"
                      style={{ flex: 1, maxWidth: 110 }}
                      placeholder="SL"
                      onFocus={(e) => e.target.select()}
                      value={r.quantity}
                      onChange={(e) => setRow(i, 'quantity', Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm tier-del"
                      aria-label="Xóa sản phẩm"
                      title="Xóa"
                      onClick={() => removeRow(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm field full" style={{ justifySelf: 'start' }} onClick={addRow}>
                  + Thêm sản phẩm
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}