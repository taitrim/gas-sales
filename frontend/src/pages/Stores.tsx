import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Store } from '../types';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FieldLabel from '../components/ui/FieldLabel';
import { avatarTone } from '../utils/avatar';
import { useToast } from '../components/Toast';

const emptyForm = { name: '', address: '', phone: '', managerId: '' };

export default function Stores() {
  const { toast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState<Store | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = useCallback(() => {
    api
      .getStores()
      .then(setStores)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function openCreate() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(s: Store) {
    setForm({
      name: s.name,
      address: s.address || '',
      phone: s.phone || '',
      managerId: s.managerId || ''
    });
    setEditing(s);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên cửa hàng.', 'err');
      return;
    }
    try {
      if (editing) {
        await api.updateStore({ ...form, id: editing.id, isActive: editing.isActive });
        toast('Đã cập nhật cửa hàng.');
      } else {
        await api.addStore(form);
        toast('Đã thêm cửa hàng.');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function toggleActive(s: Store) {
    try {
      await api.updateStore({
        id: s.id,
        name: s.name,
        address: s.address,
        phone: s.phone,
        managerId: s.managerId,
        isActive: !s.isActive
      });
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteStore(deleting.id);
      toast('Đã xóa cửa hàng.');
      setDeleting(null);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Cửa hàng</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Thêm cửa hàng
        </button>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : stores.length === 0 ? (
        <div className="empty">Không có cửa hàng nào.</div>
      ) : (
        <div className="cust-cards">
          {stores.map((s) => {
            const tone = avatarTone(s.name || '?');
            const initial = (s.name || '?').trim().charAt(0).toUpperCase();
            return (
              <div
                key={s.id}
                className={`order-card is-clickable${s.isActive ? '' : ' is-off'}`}
                role="button"
                tabIndex={0}
                aria-label={`Xem chi tiết cửa hàng ${s.name}`}
                onClick={() => openEdit(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openEdit(s);
                  }
                }}
              >
                <div className="oc-top">
                  <div className="oc-customer">
                    <div
                      className="oc-avatar"
                      style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}
                    >
                      {initial}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="oc-cust-name" title={s.name}>{s.name}</div>
                      <div className="oc-cust-phone">Quản lý: {s.managerId || '—'}</div>
                    </div>
                  </div>
                  <div className="oc-badges" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`badge ${s.isActive ? 'badge-green' : 'badge-gray'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      title="Bấm để bật/tắt"
                      onClick={() => toggleActive(s)}
                    >
                      {s.isActive ? 'Hoạt động' : 'Tạm khóa'}
                    </button>
                  </div>
                </div>

                <div className="oc-body">
                  {s.address && <div className="oc-addr" title={s.address}>📍 {s.address}</div>}

                  <div className="oc-meta">
                    <div className="oc-cell">
                      <span className="ic">📞</span>
                      <span>
                        SĐT: <b>{s.phone || '—'}</b>
                      </span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">🆔</span>
                      <span>
                        ID: <b>{s.id}</b>
                      </span>
                    </div>
                  </div>

                  <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-link" onClick={() => openEdit(s)}>
                      Sửa
                    </button>
                    <button className="btn-link danger" onClick={() => setDeleting(s)}>
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Sửa cửa hàng' : 'Thêm cửa hàng'}
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
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🏪</span>
                Thông tin cửa hàng
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="primary" req>
                    Tên cửa hàng
                  </FieldLabel>
                  <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="info">Số điện thoại</FieldLabel>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="field-input"
                    value={form.phone}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="muted">ID quản lý</FieldLabel>
                  <input
                    className="field-input"
                    value={form.managerId}
                    onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="muted">Địa chỉ</FieldLabel>
                  <input
                    className="field-input"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa cửa hàng"
          message={`Bạn có chắc muốn xóa cửa hàng "${deleting.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}