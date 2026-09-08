import { useState } from 'react';
import { api } from '../api';
import type { Expense } from '../types';
import { fmtDateTime, fmtMoney } from '../format';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { usePaginatedList } from '../hooks/usePaginatedList';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

export const EXPENSE_CATEGORIES = [
  'Mặt bằng',
  'Lương nhân viên',
  'Điện nước',
  'Marketing',
  'Vận chuyển',
  'Đồ dùng',
  'Thuế',
  'Khác'
];

const emptyForm = { category: 'Khác', amount: 0, note: '' };

export default function Expenses() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const {
    items: expenses,
    total,
    page,
    setPage,
    search,
    setSearch,
    loading,
    reload
  } = usePaginatedList<Expense>({
    fetcher: (p) => api.listExpenses({ page: p.page, pageSize: p.pageSize, search: p.search })
  });

  function openCreate() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(e: Expense) {
    setForm({ category: e.category, amount: Number(e.amount), note: e.note || '' });
    setEditing(e);
    setShowForm(true);
  }

  async function handleSave() {
    if (!Number(form.amount) || Number(form.amount) <= 0) {
      toast('Vui lòng nhập số tiền hợp lệ.', 'err');
      return;
    }
    try {
      if (editing) {
        await api.updateExpense({ ...form, id: editing.id });
        toast('Đã cập nhật phiếu chi.');
      } else {
        await api.addExpense(form);
        toast('Đã ghi phiếu chi.');
      }
      setShowForm(false);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteExpense(deleting.id);
      toast('Đã xóa phiếu chi, tiền đã hoàn lại quỹ.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Phiếu chi</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Ghi phiếu chi
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-search">
          <input
            type="search"
            placeholder="Tìm theo danh mục, ghi chú..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted toolbar-count">{total} phiếu chi</span>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : expenses.length === 0 ? (
        <div className="empty">Chưa có phiếu chi nào.</div>
      ) : (
        <>
          <div className="order-cards">
            {expenses.map((e) => (
              <div className="order-card" key={e.id}>
                <div className="oc-top">
                  <div className="oc-id">{e.id}</div>
                  <div className="oc-badges">
                    <span className="badge badge-amber">{e.category || 'Khác'}</span>
                  </div>
                </div>

                <div className="oc-body">
                  <div className="oc-customer">
                    <div className="oc-avatar oc-avatar-flat">🧾</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="oc-cust-name">{e.note || e.category}</div>
                      <div className="oc-cust-phone">{fmtDateTime(e.createdAt)}</div>
                    </div>
                  </div>

                  <div className="oc-meta">
                    <div className="oc-cell">
                      <span className="ic">👤</span>
                      <span>{e.createdBy || '—'}</span>
                    </div>
                  </div>

                  <div className="oc-total">
                    <span className="oc-total-label">Số tiền</span>
                    <span className="oc-total-val money-out">-{fmtMoney(e.amount)}</span>
                  </div>
                </div>

                <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-link" onClick={() => openEdit(e)}>
                    Sửa
                  </button>
                  <button className="btn-link danger" onClick={() => setDeleting(e)}>
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
        </>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Sửa phiếu chi' : 'Ghi phiếu chi'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editing ? 'Lưu thay đổi' : 'Ghi phiếu'}
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🧾</span>
                Thông tin phiếu chi
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="violet">Danh mục</FieldLabel>
                  <Select
                    value={form.category}
                    options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                    onChange={(v) => setForm({ ...form, category: v })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="danger" req>
                    Số tiền (VNĐ)
                  </FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="field-input"
                    value={form.amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="muted">Ghi chú</FieldLabel>
                  <textarea
                    className="field-input"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa phiếu chi"
          message={`Xóa phiếu chi ${fmtMoney(deleting.amount)} "${deleting.note || deleting.category}"? Số tiền sẽ được hoàn lại vào quỹ.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}