import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Promotion } from '../types';
import { fmtDate, fmtMoney } from '../format';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

const emptyForm = {
  code: '',
  name: '',
  discountType: 'percent' as 'percent' | 'amount',
  discountValue: 0,
  minOrderAmount: 0,
  maxDiscount: 0,
  active: true,
  startDate: '',
  endDate: '',
  usageLimit: 0
};

export default function Promotions() {
  const { toast } = useToast();
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.getPromotions());
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(p: Promotion) {
    setForm({
      code: p.code,
      name: p.name,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
      maxDiscount: p.maxDiscount,
      active: p.active,
      startDate: p.startDate || '',
      endDate: p.endDate || '',
      usageLimit: p.usageLimit
    });
    setEditing(p);
    setShowForm(true);
  }

  function discountLabel(p: Promotion) {
    if (p.discountType === 'percent') {
      return `${p.discountValue}%` + (p.maxDiscount > 0 ? ` (tối đa ${fmtMoney(p.maxDiscount)})` : '');
    }
    return fmtMoney(p.discountValue);
  }

  async function handleSave() {
    if (!form.code.trim()) {
      toast('Vui lòng nhập mã khuyến mãi.', 'err');
      return;
    }
    if (!form.discountValue || form.discountValue <= 0) {
      toast('Giá trị chiết khấu phải lớn hơn 0.', 'err');
      return;
    }
    try {
      if (editing) {
        await api.updatePromotion({ ...form, id: editing.id });
        toast('Đã cập nhật khuyến mãi.');
      } else {
        await api.addPromotion(form);
        toast('Đã thêm khuyến mãi.');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deletePromotion(deleting.id);
      toast('Đã xóa khuyến mãi.');
      setDeleting(null);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Khuyến mãi</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Thêm khuyến mãi
        </button>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Chưa có khuyến mãi nào.</div>
      ) : (
        <div className="cust-cards">
          {items.map((p) => (
            <div
              className="order-card is-clickable"
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`Xem chi tiết khuyến mãi ${p.name || p.id}`}
              onClick={() => openEdit(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openEdit(p);
                }
              }}
            >
              <div className="oc-top">
                <div className="oc-customer">
                  <div className="oc-avatar oc-avatar-flat">🎁</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="oc-cust-name" style={{ color: 'var(--primary-dark)' }}>{p.code}</div>
                    <div className="oc-cust-phone">{p.name || '—'}</div>
                  </div>
                </div>
                <div className="oc-badges">
                  {p.active ? (
                    <span className="badge badge-green">Hoạt động</span>
                  ) : (
                    <span className="badge badge-gray">Tắt</span>
                  )}
                </div>
              </div>

              <div className="oc-body">
                <div className="oc-meta">
                  <div className="oc-cell">
                    <span className="ic">🏷️</span>
                    <span>
                      Chiết khấu: <b className="money-out">{discountLabel(p)}</b>
                    </span>
                  </div>
                  <div className="oc-cell">
                    <span className="ic">🧾</span>
                    <span>
                      Đơn tối thiểu:{' '}
                      <b className="money-primary">{p.minOrderAmount > 0 ? fmtMoney(p.minOrderAmount) : '—'}</b>
                    </span>
                  </div>
                  <div className="oc-cell">
                    <span className="ic">📅</span>
                    <span>
                      Hiệu lực:{' '}
                      <b>{p.startDate || p.endDate ? `${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}` : 'Vô thời hạn'}</b>
                    </span>
                  </div>
                  <div className="oc-cell">
                    <span className="ic">📈</span>
                    <span>
                      Đã dùng: <b>{p.usageLimit > 0 ? `${p.usedCount}/${p.usageLimit}` : p.usedCount}</b>
                    </span>
                  </div>
                </div>

                <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-link" onClick={() => openEdit(p)}>
                    Sửa
                  </button>
                  <button className="btn-link danger" onClick={() => setDeleting(p)}>
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Lưu
              </button>
            </>
          }
        >
          <div className="form-stack">
            <div className="form-section sec-promo-info">
              <div className="form-section-title">
                <span className="form-section-ic">🎟️</span>
                Thông tin mã khuyến mãi
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="primary" req>
                    Mã
                  </FieldLabel>
                  <input
                    className="field-input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="VD: GIAM10"
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="info">Tên</FieldLabel>
                  <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="violet">Loại giảm giá</FieldLabel>
                  <Select
                    value={form.discountType}
                    options={[
                      { value: 'percent', label: 'Phần trăm (%)' },
                      { value: 'amount', label: 'Số tiền cố định' }
                    ]}
                    onChange={(v) => setForm({ ...form, discountType: v as 'percent' | 'amount' })}
                  />
                </div>
                {form.discountType === 'percent' && (
                  <div className="field">
                    <FieldLabel tone="amber">Giảm tối đa (VNĐ)</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      className="field-input"
                      value={form.maxDiscount}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                    />
                    <div className="hint">Nhập 0 = không giới hạn.</div>
                  </div>
                )}
                <div className="field">
                  <FieldLabel tone="success">
                    {form.discountType === 'percent' ? 'Giá trị (%)' : 'Số tiền (VNĐ)'}
                  </FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="field-input"
                    value={form.discountValue}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="muted">Đơn hàng tối thiểu (VNĐ)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="field-input"
                    value={form.minOrderAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section sec-promo-sched">
              <div className="form-section-title">
                <span className="form-section-ic">📅</span>
                Thời hạn &amp; giới hạn
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="info">Bắt đầu</FieldLabel>
                  <input className="field-input" type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="danger">Kết thúc</FieldLabel>
                  <input className="field-input" type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="amber">Số lượt dùng tối đa</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="field-input"
                    value={form.usageLimit}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                  />
                  <div className="hint">Nhập 0 = không giới hạn.</div>
                </div>
                <div className="field">
                  <FieldLabel tone="success">Trạng thái</FieldLabel>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    Đang hoạt động
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa khuyến mãi"
          message={`Bạn có chắc muốn xóa mã "${deleting.code}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}