import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ImportRecord, Supplier, SupplierTransaction } from '../types';
import { fmtDateTime, fmtMoney } from '../format';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import FieldLabel from '../components/ui/FieldLabel';
import { avatarTone } from '../utils/avatar';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { exportCSV } from '../export';
import { useToast } from '../components/Toast';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  taxCode: '',
  bankInfo: '',
  note: ''
};

export default function Suppliers() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  // payment flow
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [amount, setAmount] = useState(0);
  const [payNote, setPayNote] = useState('');
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [importsLoading, setImportsLoading] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [allocAmounts, setAllocAmounts] = useState<Record<string, number>>({});
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  // transaction history
  const [history, setHistory] = useState<Supplier | null>(null);
  const [txs, setTxs] = useState<SupplierTransaction[]>([]);

  const {
    items: suppliers,
    total,
    page,
    setPage,
    search,
    setSearch,
    loading,
    reload
  } = usePaginatedList<Supplier>({
    fetcher: (p) => api.listSuppliers({ page: p.page, pageSize: p.pageSize, search: p.search })
  });

  function openCreate() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(s: Supplier) {
    setForm({ ...s });
    setEditing(s);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên nhà cung cấp.', 'err');
      return;
    }
    try {
      if (editing) {
        await api.updateSupplier({ ...form, id: editing.id });
        toast('Đã cập nhật nhà cung cấp.');
      } else {
        await api.addSupplier(form);
        toast('Đã thêm nhà cung cấp.');
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
      await api.deleteSupplier(deleting.id);
      toast('Đã xóa nhà cung cấp.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function openHistory(s: Supplier) {
    setHistory(s);
    setTxs([]);
    try {
      const list = await api.getSupplierTransactions(s.id);
      setTxs(list);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handlePay() {
    if (!paying || amount <= 0) {
      toast('Vui lòng nhập số tiền hợp lệ.', 'err');
      return;
    }
    try {
      const items = Array.from(checkedIds)
        .map((id) => ({ importId: id, amount: allocAmounts[id] || 0 }))
        .filter((a) => a.amount > 0);
      await api.createSupplierPayment({
        supplierId: paying.id,
        amount,
        note: payNote,
        items
      });
      toast(`Đã ghi nhận thanh toán ${fmtMoney(amount)} cho ${paying.name}.`);
      setPaying(null);
      setAmount(0);
      setPayNote('');
      setCheckedIds(new Set());
      setAllocAmounts({});
      setRangeFrom('');
      setRangeTo('');
      if (history?.id === paying.id) openHistory(paying);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function loadSupplierImports(s: Supplier) {
    setImportsLoading(true);
    setImports([]);
    try {
      const res = await api.listImports({
        page: 1,
        pageSize: 100,
        supplierId: s.id
      });
      setImports(res.items.filter((i) => Number(i.remainingAmount) > 0));
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setImportsLoading(false);
    }
  }

  function openPay(s: Supplier) {
    setPaying(s);
    setAmount(0);
    setPayNote('');
    setCheckedIds(new Set());
    setAllocAmounts({});
    setRangeFrom('');
    setRangeTo('');
    amountManuallySet.current = false;
    loadSupplierImports(s);
  }

  function toggleAll() {
    amountManuallySet.current = false;
    setCheckedIds((prev) => {
      if (prev.size === imports.length) return new Set();
      return new Set(imports.map((i) => i.id));
    });
  }

  function quickPay() {
    amountManuallySet.current = false;
    const allIds = new Set(imports.map((i) => i.id));
    setCheckedIds(allIds);
    setAllocAmounts((a) => {
      const next = { ...a };
      imports.forEach((i) => {
        next[i.id] = Number(i.remainingAmount);
      });
      return next;
    });
  }

  function toggleImport(id: string, remaining: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setAllocAmounts((a) => ({ ...a, [id]: remaining }));
      }
      return next;
    });
  }

  function selectRange() {
    amountManuallySet.current = false;
    if (!rangeFrom || !rangeTo) {
      toast('Chọn khoảng thời gian trước khi áp dụng.', 'err');
      return;
    }
    const from = new Date(rangeFrom).getTime();
    const to = new Date(rangeTo).getTime();
    const inRange = imports.filter((i) => {
      const t = new Date(i.createdAt).getTime();
      return t >= from && t <= to;
    });
    if (inRange.length === 0) {
      toast('Không có phiếu nhập còn nợ trong khoảng này.', 'err');
      return;
    }
    setCheckedIds(new Set(inRange.map((i) => i.id)));
    setAllocAmounts((a) => {
      const next = { ...a };
      inRange.forEach((i) => {
        next[i.id] = Number(i.remainingAmount);
      });
      return next;
    });
    toast(`Chọn ${inRange.length} phiếu nhập trong khoảng thời gian.`);
  }

  const selectedTotal = Array.from(checkedIds).reduce((s, id) => s + (allocAmounts[id] || 0), 0);
  const amountManuallySet = useRef(false);

  useEffect(() => {
    if (amountManuallySet.current) return;
    setAmount(selectedTotal);
  }, [selectedTotal]);

  async function exportSuppliers() {
    try {
      const all = await api.getSuppliers();
      exportCSV(
        ['Tên NCC', 'SĐT', 'Email', 'Địa chỉ', 'Mã số thuế', 'Ngân hàng', 'Ghi chú'],
        all.map((s) => [s.name, s.phone, s.email, s.address, s.taxCode, s.bankInfo, s.note]),
        'nha-cung-cap.csv'
      );
      toast('Đã xuất CSV.');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Nhà cung cấp</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Thêm NCC
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-search">
          <input
            type="search"
            placeholder="Tìm tên, SĐT, mã số thuế..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted toolbar-count">{total} nhà cung cấp</span>
          <button className="btn btn-ghost btn-sm" onClick={exportSuppliers} title="Xuất CSV toàn bộ nhà cung cấp">
            ⬇ Xuất CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : suppliers.length === 0 ? (
        <div className="empty">Không có nhà cung cấp nào.</div>
      ) : (
        <>
          <div className="cust-cards">
            {suppliers.map((s) => {
              const tone = avatarTone(s.name || '?');
              const initial = (s.name || '?').trim().charAt(0).toUpperCase();
              return (
                <div
                  className="order-card is-clickable"
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Xem chi tiết nhà cung cấp ${s.name}`}
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
                        <div className="oc-cust-phone">{s.phone || 'Chưa có SĐT'}</div>
                      </div>
                    </div>
                    <div className="oc-badges" />
                  </div>

                  <div className="oc-body">
                    {s.address && <div className="oc-addr" title={s.address}>📍 {s.address}</div>}

                    <div className="oc-meta">
                      <div className="oc-cell">
                        <span className="ic">✉️</span>
                        <span>
                          Email: <b>{s.email || '—'}</b>
                        </span>
                      </div>
                      <div className="oc-cell">
                        <span className="ic">🧾</span>
                        <span>
                          MST: <b>{s.taxCode || '—'}</b>
                        </span>
                      </div>
                      <div className="oc-cell">
                        <span className="ic">🏦</span>
                        <span>
                          Ngân hàng: <b>{s.bankInfo || '—'}</b>
                        </span>
                      </div>
                    </div>

                    <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-link" onClick={() => openHistory(s)}>
                        📒 Giao dịch
                      </button>
                      <button className="btn-link" onClick={() => openPay(s)}>
                        💳 Thanh toán
                      </button>
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
          <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
        </>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
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
                Thông tin nhà cung cấp
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="primary" req>
                    Tên nhà cung cấp
                  </FieldLabel>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="info">Số điện thoại</FieldLabel>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="violet">Email</FieldLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="muted">Địa chỉ</FieldLabel>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🏦</span>
                Hóa đơn &amp; thanh toán
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="amber">Mã số thuế</FieldLabel>
                  <input
                    value={form.taxCode}
                    onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="success">Thông tin ngân hàng</FieldLabel>
                  <input
                    placeholder="Vietcombank — 0123456789"
                    value={form.bankInfo}
                    onChange={(e) => setForm({ ...form, bankInfo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">📝</span>
                Ghi chú
              </div>
              <textarea
                className="full"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa nhà cung cấp"
          message={`Bạn có chắc muốn xóa "${deleting.name}"? Dữ liệu giao dịch liên quan cũng sẽ bị xóa.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {paying && (
        <Modal
          title={`Thanh toán cho ${paying.name}`}
          onClose={() => setPaying(null)}
          wide
          footer={
            <>
              <div className="muted" style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 13 }}>
                Đã chọn:{' '}
                <strong style={{ fontSize: 15 }}>
                  {fmtMoney(selectedTotal)}
                </strong>
                {' / '}
                <span className="money-debt">{fmtMoney(amount)}</span>
              </div>
              <button className="btn btn-ghost" onClick={() => setPaying(null)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePay}
                disabled={amount <= 0 || selectedTotal > amount || checkedIds.size === 0}
              >
                Ghi nhận
              </button>
            </>
          }
        >
          <div className="field">
            <FieldLabel tone="primary">Chọn phiếu nhập còn nợ để thanh toán</FieldLabel>
            <div className="sp-pay-toolbar">
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                title="Từ ngày"
              />
              <span className="muted">→</span>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                title="Đến ngày"
              />
              <button className="btn btn-ghost btn-sm" onClick={selectRange}>
                Chọn đơn trong khoảng
              </button>
              <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                {checkedIds.size === imports.length && imports.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={quickPay} style={{ marginLeft: 'auto' }}>
                ⚡ Thanh toán nhanh
              </button>
            </div>
          </div>

          {importsLoading ? (
            <div className="empty">Đang tải phiếu nhập...</div>
          ) : imports.length === 0 ? (
            <div className="empty">NCC này không còn phiếu nhập nợ nào.</div>
          ) : (
            <div className="sp-pay-list">
              {imports.map((imp) => {
                const rem = Number(imp.remainingAmount);
                const checked = checkedIds.has(imp.id);
                return (
                  <div
                    key={imp.id}
                    className={`sp-pay-row ${checked ? 'checked' : ''}`}
                    onClick={() => toggleImport(imp.id, rem)}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleImport(imp.id, rem)} onClick={(e) => e.stopPropagation()} />
                    <div className="sp-pay-info">
                      <div className="sp-pay-id">
                        {imp.id}
                        <span className={`badge ${imp.paymentStatus === 'partial' ? 'badge-yellow' : 'badge-red'}`}>
                          {imp.paymentStatus === 'partial' ? 'Trả một phần' : 'Chưa trả'}
                        </span>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {fmtDateTime(imp.createdAt)} • Tổng {fmtMoney(imp.totalAmount)}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Còn nợ: <span className="money-debt">{fmtMoney(rem)}</span>
                      </div>
                    </div>
                    <div className="sp-pay-alloc">
                      <input
                        type="number"
                        value={allocAmounts[imp.id] || 0}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(rem, Number(e.target.value) || 0));
                          setAllocAmounts((a) => ({ ...a, [imp.id]: v }));
                        }}
                        placeholder="0"
                        min={0}
                        max={rem}
                      />
                      <button
                        className="btn-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAllocAmounts((a) => ({ ...a, [imp.id]: rem }));
                        }}
                      >
                        Trả đủ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="form-stack form-stack-single" style={{ marginTop: 14 }}>
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">💳</span>
                Thông tin thanh toán
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="success">Số tiền thanh toán (VNĐ)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      amountManuallySet.current = true;
                      setAmount(Number(e.target.value));
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="muted">Ghi chú</FieldLabel>
                  <input
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="Ví dụ: trả đợt 1"
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {history && (
        <Modal
          title={`Giao dịch — ${history.name}`}
          onClose={() => setHistory(null)}
          wide
          footer={
            <button className="btn btn-ghost" onClick={() => setHistory(null)}>
              Đóng
            </button>
          }
        >
          <table className="data">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Loại</th>
                <th className="right">Số tiền</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {txs.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Chưa có giao dịch.
                  </td>
                </tr>
              )}
              {txs.map((t) => (
                <tr key={t.id}>
                  <td data-label="Ngày" className="nowrap muted">{fmtDateTime(t.createdAt)}</td>
                  <td data-label="Loại">
                    <span className={`badge ${t.type === 'payment' ? 'badge-red' : 'badge-blue'}`}>
                      {t.type === 'payment' ? 'Thanh toán' : t.type}
                    </span>
                  </td>
                  <td data-label="Số tiền" className="right nowrap" style={{ fontWeight: 600 }}>
                    <span className={t.type === 'payment' ? 'money-out' : 'money-in'}>
                      {fmtMoney(t.amount)}
                    </span>
                  </td>
                  <td data-label="Ghi chú">{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}