import { useState } from 'react';
import { api } from '../api';
import type { Customer, CustomerPointsInfo, PointsLedgerEntry } from '../types';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from '../format';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { avatarTone } from '../utils/avatar';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { exportCSV } from '../export';
import { useToast } from '../components/Toast';

const emptyForm = {
  name: '',
  phone: '',
  address: '',
  source: '',
  notes: '',
  creditLimit: 0,
  points: 0,
  paymentTermsDays: 0
};

// Nguồn khách (kênh biết đến cửa hàng)
const SOURCES: { value: string; label: string; color: string }[] = [
  { value: 'facebook', label: 'Facebook', color: '#1877f2' },
  { value: 'tiktok', label: 'TikTok', color: '#fe2c55' },
  { value: 'zalo', label: 'Zalo', color: '#0068ff' },
  { value: 'instagram', label: 'Instagram', color: '#d62976' },
  { value: 'youtube', label: 'YouTube', color: '#ff0000' },
  { value: 'shopee', label: 'Shopee', color: '#ee4d2d' },
  { value: 'website', label: 'Website', color: '#0ea5e9' },
  { value: 'referral', label: 'Giới thiệu', color: 'var(--success)' },
  { value: 'offline', label: 'Offline', color: 'var(--violet)' },
  { value: 'other', label: 'Khác', color: 'var(--text-muted)' }
];

const SRC_ICONS: Record<string, string> = {
  facebook: '📘',
  tiktok: '🎵',
  zalo: '💬',
  instagram: '📸',
  youtube: '▶️',
  shopee: '🛍️',
  website: '🌐',
  referral: '🤝',
  offline: '🚶',
  other: '❓'
};

function sourceMeta(value?: string) {
  if (!value) return null;
  const s = SOURCES.find((x) => x.value === value);
  return s ? { ...s, icon: SRC_ICONS[s.value] || '🏷️' } : { value, label: value, color: 'var(--text-muted)', icon: '🏷️' };
}

const POINTS_TYPE: Record<string, { label: string; badge: string }> = {
  earn: { label: 'Tích điểm', badge: 'badge-green' },
  redeem: { label: 'Dùng điểm', badge: 'badge-blue' },
  refund: { label: 'Hoàn điểm', badge: 'badge-amber' },
  adjust: { label: 'Điều chỉnh', badge: 'badge-purple' }
};

export default function Customers() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [pointsDetail, setPointsDetail] = useState<CustomerPointsInfo | null>(null);
  const [sourceFilter, setSourceFilter] = useState('');

  const {
    items: customers,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    loading,
    reload
  } = usePaginatedList<Customer>({
    fetcher: (p) =>
      api.listCustomers({ page: p.page, pageSize: p.pageSize, search: p.search, source: (p.source as string) || undefined }),
    pageSize: 12,
    extra: { source: sourceFilter || undefined }
  });

  function openCreate() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setForm({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      source: c.source || '',
      notes: c.notes || '',
      creditLimit: Number(c.creditLimit) || 0,
      points: Number(c.points) || 0,
      paymentTermsDays: Number(c.paymentTermsDays) || 0
    });
    setEditing(c);
    setShowForm(true);
  }

  async function openPoints(c: Customer) {
    try {
      const d = await api.getCustomerPointsLedger(c.id);
      setPointsDetail(d);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên khách hàng.', 'err');
      return;
    }
    try {
      if (editing) {
        await api.updateCustomer({ ...form, id: editing.id });
        toast('Đã cập nhật khách hàng.');
      } else {
        await api.addCustomer(form);
        toast('Đã thêm khách hàng.');
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
      await api.deleteCustomer(deleting.id);
      toast('Đã xóa khách hàng.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function exportCustomers() {
    try {
      const all = await api.getCustomers();
      exportCSV(
        ['Tên', 'SĐT', 'Địa chỉ', 'Nguồn', 'Tổng chi tiêu', 'Mua gần nhất', 'Ghi chú'],
        all.map((c) => [c.name, c.phone, c.address, sourceMeta(c.source)?.label || '', c.totalSpent, c.lastPurchaseDate, c.notes]),
        'khach-hang.csv'
      );
      toast('Đã xuất CSV.');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Khách hàng</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Thêm khách hàng
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-search">
          <input
            type="search"
            placeholder="Tìm tên, SĐT, địa chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted nowrap toolbar-count">{total} khách</span>
          <button className="btn btn-ghost btn-sm" onClick={exportCustomers} title="Xuất CSV toàn bộ khách hàng">
            ⬇ CSV
          </button>
        </div>
        <div className="ot-row ot-filters">
          <Select
            value={sourceFilter}
            onChange={(v) => {
              setSourceFilter(v);
              setPage(1);
            }}
            placeholder="Tất cả nguồn"
            options={[
              { value: '', label: '🌐 Tất cả nguồn' },
              ...SOURCES.map((s) => ({ value: s.value, label: `${SRC_ICONS[s.value]} ${s.label}` }))
            ]}
          />
          {sourceFilter && (
            <button
              type="button"
              className="ot-reset"
              onClick={() => {
                setSourceFilter('');
                setPage(1);
              }}
            >
              ✕ Bỏ lọc
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : (
        <>
          <div className="cust-cards">
            {customers.length === 0 && <div className="empty">Không có khách hàng nào.</div>}
            {customers.map((c) => {
              const debt = Number(c.debt) || 0;
              const pts = Number(c.points) || 0;
              const initial = (c.name || '?').trim().charAt(0).toUpperCase();
              const tone = avatarTone(c.name || '?');
              const src = sourceMeta(c.source);
              return (
                <div
                  key={c.id}
                  className={`order-card is-clickable${debt > 0 ? ' has-debt' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Xem chi tiết khách ${c.name}`}
                  onClick={() => openEdit(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(c);
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
                        <div className="oc-cust-name" title={c.name}>{c.name}</div>
                        <div className="oc-cust-phone">{c.phone || 'Chưa có SĐT'}</div>
                      </div>
                    </div>
                    <div className="oc-badges">
                      {debt > 0 && (
                        <span className="badge badge-red money-debt" title={`Còn nợ ${fmtMoney(debt)}`}>
                          Nợ {fmtMoney(debt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="oc-body">
                    {c.address && <div className="oc-addr" title={c.address}>📍 {c.address}</div>}

                    <div className="oc-meta">
                      <div className="oc-cell">
                        <span className="ic">🛒</span>
                        <span>
                          Chi tiêu: <b className="money-primary">{fmtMoney(c.totalSpent)}</b>
                        </span>
                      </div>
                      <button type="button" className={`oc-cell as-btn${pts > 0 ? ' has-points' : ''}`} onClick={() => openPoints(c)} title="Mở sổ điểm">
                        <span className="ic">⭐</span>
                        <span>
                          Điểm: <b>{pts > 0 ? fmtNumber(pts) : '—'}</b>
                        </span>
                      </button>
                      <div className="oc-cell">
                        <span className="ic">🕒</span>
                        <span>
                          Mua gần nhất: <b>{fmtDate(c.lastPurchaseDate)}</b>
                        </span>
                      </div>
                      <div className="oc-cell">
                        <span className="ic">{src ? src.icon : '🏷️'}</span>
                        <span>
                          Nguồn: <b style={src ? { color: src.color } : undefined}>{src ? src.label : 'Chưa phân loại'}</b>
                        </span>
                      </div>
                    </div>

                    <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-link" onClick={() => openPoints(c)}>
                        ⭐ Lịch sử điểm
                      </button>
                      <button className="btn-link" onClick={() => openEdit(c)}>
                        Sửa
                      </button>
                      <button className="btn-link danger" onClick={() => setDeleting(c)}>
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {total > 0 && (
            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
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
                <span className="form-section-ic">👤</span>
                Thông tin khách hàng
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="primary" req>
                    Tên khách hàng
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
                  <FieldLabel tone="violet">Nguồn khách</FieldLabel>
                  <Select
                    value={form.source}
                    placeholder="Chưa phân loại"
                    options={[
                      { value: '', label: '❔ Chưa phân loại' },
                      ...SOURCES.map((s) => ({ value: s.value, label: `${SRC_ICONS[s.value]} ${s.label}` }))
                    ]}
                    onChange={(v) => setForm({ ...form, source: v })}
                  />
                  <div className="hint">Khách biết đến cửa hàng qua kênh nào (FB, TikTok, Zalo...).</div>
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
                <span className="form-section-ic">💰</span>
                Công nợ &amp; điểm thưởng
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="danger">Hạn mức công nợ (VNĐ)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.creditLimit}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="success">Điểm tích lũy</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.points}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="amber">Hạn thanh toán (ngày)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.paymentTermsDays}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, paymentTermsDays: Number(e.target.value) })}
                  />
                  <div className="hint">Quá số ngày này → tính nợ quá hạn.</div>
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
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </Modal>
      )}

      {pointsDetail && (
        <Modal title={`Sổ điểm — ${pointsDetail.customer.name}`} onClose={() => setPointsDetail(null)} wide>
          <div className="stats-grid" style={{ marginBottom: 14 }}>
            <div className="stat-card tone-green">
              <div className="stat-icon">⭐</div>
              <div className="stat-body">
                <div className="label">Điểm hiện có</div>
                <div className="value">{fmtNumber(pointsDetail.balance)}</div>
              </div>
            </div>
            <div className="stat-card tone-slate">
              <div className="stat-icon">🧾</div>
              <div className="stat-body">
                <div className="label">Số biến động</div>
                <div className="value">{fmtNumber(pointsDetail.ledger.length)}</div>
              </div>
            </div>
          </div>
          <div className="card table-wrap" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Loại</th>
                  <th>Tham chiếu</th>
                  <th>Ghi chú</th>
                  <th className="right">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {pointsDetail.ledger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      Chưa có biến động điểm nào.
                    </td>
                  </tr>
                )}
                {pointsDetail.ledger.map((e: PointsLedgerEntry) => {
                  const t = POINTS_TYPE[e.type];
                  return (
                    <tr key={e.id}>
                      <td data-label="Thời điểm" className="nowrap">{fmtDateTime(e.createdAt)}</td>
                      <td data-label="Loại">
                        <span className={`badge ${t?.badge || 'badge-blue'}`}>{t?.label || e.type}</span>
                      </td>
                      <td data-label="Tham chiếu">{e.refId || '—'}</td>
                      <td data-label="Ghi chú">{e.note || '—'}</td>
                      <td data-label="Điểm" className="right nowrap">
                        <span className={e.points > 0 ? 'money-in' : 'money-out'} style={{ fontWeight: 700 }}>
                          {e.points > 0 ? '+' : ''}{fmtNumber(e.points)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa khách hàng"
          message={`Bạn có chắc muốn xóa khách hàng "${deleting.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}