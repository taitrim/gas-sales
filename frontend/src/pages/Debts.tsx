import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Customer, CustomerDebtInfo, CustomerWithDebt, DebtOverview, Order } from '../types';
import { fmtDateTime, fmtMoney } from '../format';
import Modal from '../components/Modal';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { avatarTone } from '../utils/avatar';
import { useToast } from '../components/Toast';

const DEBT_TYPE: Record<string, string> = {
  order: 'Đơn hàng',
  payment: 'Thu nợ',
  refund: 'Trả hàng',
  adjust: 'Điều chỉnh'
};

export default function Debts() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerWithDebt[]>([]);
  const [overview, setOverview] = useState<DebtOverview>({ totalDebt: 0, overdueAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CustomerDebtInfo | null>(null);
  const [paying, setPaying] = useState<CustomerDebtInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [payingLoading, setPayingLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cust, ov] = await Promise.all([api.getCustomerDebts(), api.getDebtOverview()]);
      setCustomers(cust as CustomerWithDebt[]);
      setOverview(ov);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(c: Customer) {
    try {
      const d = await api.getCustomerDebts(c.id);
      setDetail(d as CustomerDebtInfo);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function openPay(d: CustomerDebtInfo) {
    setPaying(d);
    setAmount('');
    setOrderId('');
    try {
      const all = await api.getCustomerUnpaidOrders(d.customer.id);
      setOrders(all);
    } catch {
      setOrders([]);
    }
  }

  async function submitPay() {
    if (!paying) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast('Vui lòng nhập số tiền hợp lệ.', 'err');
      return;
    }
    if (amt > paying.balance) {
      toast('Số tiền thu vượt quá công nợ.', 'err');
      return;
    }
    setPayingLoading(true);
    try {
      await api.createDebtPayment({ customerId: paying.customer.id, amount: amt, orderId: orderId || undefined });
      toast('Đã thu nợ.');
      setPaying(null);
      await load();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setPayingLoading(false);
    }
  }

  const totalDebt = customers.reduce((s, c) => s + (Number(c.debt) || 0), 0);

  return (
    <div>
      <div className="page-head">
        <h1>Công nợ khách hàng</h1>
        <button className="btn btn-primary" onClick={load}>
          ⟳ Làm mới
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card tone-slate">
          <div className="stat-icon">🧮</div>
          <div className="stat-body">
            <div className="label">Khách đang nợ</div>
            <div className="value">{customers.length}</div>
          </div>
        </div>
        <div className="stat-card tone-rose">
          <div className="stat-icon">💳</div>
          <div className="stat-body">
            <div className="label">Tổng công nợ</div>
            <div className="value money-debt">{fmtMoney(totalDebt)}</div>
          </div>
        </div>
        <div className="stat-card tone-amber">
          <div className="stat-icon">⏰</div>
          <div className="stat-body">
            <div className="label">Nợ quá hạn</div>
            <div className="value money-debt">{fmtMoney(overview.overdueAmount)}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : customers.length === 0 ? (
        <div className="empty">Không có khách hàng nào đang nợ.</div>
      ) : (
        <div className="cust-cards">
          {customers.map((c) => {
            const overdue = c.overdue && Number(c.overdue.amount) > 0;
            const tone = avatarTone(c.name || '?');
            const initial = (c.name || '?').trim().charAt(0).toUpperCase();
            return (
              <div
                key={c.id}
                className="order-card has-debt is-clickable"
                role="button"
                tabIndex={0}
                aria-label={`Xem sổ nợ của ${c.name}`}
                onClick={() => openDetail(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(c);
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
                    <span className="badge badge-red money-debt" title={`Công nợ ${fmtMoney(c.debt)}`}>
                      Nợ {fmtMoney(c.debt)}
                    </span>
                  </div>
                </div>

                <div className="oc-body">
                  <div className="oc-meta">
                    <div className="oc-cell">
                      <span className="ic">💳</span>
                      <span>
                        Công nợ: <b className="money-debt">{fmtMoney(c.debt)}</b>
                      </span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">⏰</span>
                      <span>
                        Quá hạn:{' '}
                        {overdue ? (
                          <b className="money-debt" title={`${c.overdue!.days} ngày quá hạn`}>
                            {fmtMoney(c.overdue!.amount)} · {c.overdue!.days} ngày
                          </b>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-link" onClick={() => openDetail(c)}>
                      📒 Sổ nợ
                    </button>
                    <button
                      className="btn-link"
                      onClick={() => openPay({ customer: c, balance: Number(c.debt), ledger: [] })}
                    >
                      💰 Thu nợ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <Modal title={`Sổ nợ — ${detail.customer.name}`} onClose={() => setDetail(null)} wide>
          <div className="stats-grid" style={{ marginBottom: 14 }}>
            <div className="stat-card tone-slate">
              <div className="stat-icon">🛒</div>
              <div className="stat-body">
                <div className="label">Tổng chi tiêu</div>
                <div className="value">{fmtMoney(detail.customer.totalSpent)}</div>
              </div>
            </div>
            <div className="stat-card tone-rose">
              <div className="stat-icon">💳</div>
              <div className="stat-body">
                <div className="label">Còn nợ</div>
                <div className="value">{fmtMoney(detail.balance)}</div>
              </div>
            </div>
          </div>
          <div className="card table-wrap" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Loại</th>
                  <th>Tham chiếu</th>
                  <th>Ghi chú</th>
                  <th className="right">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {detail.ledger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      Chưa có giao dịch công nợ.
                    </td>
                  </tr>
                )}
                {detail.ledger.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Ngày" className="nowrap">{fmtDateTime(e.createdAt)}</td>
                    <td data-label="Loại">{DEBT_TYPE[e.type] || e.type}</td>
                    <td data-label="Tham chiếu">{e.refId || '—'}</td>
                    <td data-label="Ghi chú">{e.note || '—'}</td>
                    <td data-label="Số tiền" className="right nowrap">
                      <span className={e.amount > 0 ? 'money-out' : 'money-in'}>
                        {e.amount > 0 ? '+' : ''}{fmtMoney(e.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {paying && (
        <Modal
          title={`Thu nợ — ${paying.customer.name}`}
          onClose={() => setPaying(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setPaying(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={submitPay} disabled={payingLoading}>
                {payingLoading ? 'Đang lưu...' : 'Xác nhận thu'}
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">💰</span>
                Thu nợ khách hàng
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="danger">Đang nợ</FieldLabel>
                  <input readOnly value={fmtMoney(paying.balance)} />
                </div>
                <div className="field">
                  <FieldLabel tone="success" req>
                    Số tiền thu (VNĐ)
                  </FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
                {orders.length > 0 && (
                  <div className="field full">
                    <FieldLabel tone="info">Gắn vào đơn nợ (tùy chọn)</FieldLabel>
                    <Select
                      value={orderId}
                      placeholder="— Không gắn đơn —"
                      options={orders.map((o) => ({
                        value: o.id,
                        label: `${o.id} • ${fmtMoney(o.totalAmount)}`
                      }))}
                      onChange={(v) => setOrderId(v)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}