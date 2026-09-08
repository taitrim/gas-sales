import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { CashFund, CashTransaction } from '../types';
import { fmtDateTime, fmtMoney } from '../format';
import Modal from '../components/Modal';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

const CATEGORY_LABELS: Record<string, string> = {
  order: 'Đơn hàng',
  import: 'Nhập hàng',
  supplier: 'Thanh toán NCC',
  expense: 'Phiếu chi',
  manual: 'Thủ công'
};

export default function Cash() {
  const { toast } = useToast();
  const [fund, setFund] = useState<CashFund | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState<'receive' | 'spend' | null>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setFund(await api.getCashFund());
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdjust() {
    if (!showAdjust) return;
    if (!Number(amount) || Number(amount) <= 0) {
      toast('Vui lòng nhập số tiền hợp lệ.', 'err');
      return;
    }
    try {
      await api.recordCashAdjust(showAdjust, Number(amount), note);
      toast(showAdjust === 'receive' ? 'Đã nạp tiền vào quỹ.' : 'Đã rút tiền khỏi quỹ.');
      setShowAdjust(null);
      setAmount(0);
      setNote('');
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function txLabel(t: CashTransaction) {
    return `${CATEGORY_LABELS[t.category] || t.category}${t.refId ? ` · ${t.refId}` : ''}`;
  }

  if (loading && !fund) return <div className="empty">Đang tải...</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Quỹ tiền mặt</h1>
        <div className="page-actions">
          <button className="btn btn-success" onClick={() => setShowAdjust('receive')}>
            + Nạp tiền vào quỹ
          </button>
          <button className="btn btn-ghost" onClick={() => setShowAdjust('spend')}>
            − Rút tiền
          </button>
        </div>
      </div>

      {fund && (
        <div className="cash-cards">
          <div className={`cash-card ${fund.balance >= 0 ? 'cash-positive' : 'cash-negative'}`}>
            <div className="cash-card-ic">{fund.balance >= 0 ? '💰' : '⚠️'}</div>
            <div className="cash-card-main">
              <div className="cash-card-label">Số dư quỹ hiện tại</div>
              <div className="cash-card-value">{fmtMoney(fund.balance)}</div>
            </div>
          </div>
          <div className="cash-card cash-in">
            <div className="cash-card-ic">📥</div>
            <div className="cash-card-main">
              <div className="cash-card-label">Tổng đã thu vào quỹ</div>
              <div className="cash-card-value">{fmtMoney(fund.received)}</div>
            </div>
          </div>
          <div className="cash-card cash-out">
            <div className="cash-card-ic">📤</div>
            <div className="cash-card-main">
              <div className="cash-card-label">Tổng đã chi khỏi quỹ</div>
              <div className="cash-card-value">{fmtMoney(fund.spent)}</div>
            </div>
          </div>
        </div>
      )}

      {fund && fund.transactions.length > 0 && (
        <div className="order-cards">
          {fund.transactions.map((t) => (
            <div className="order-card" key={t.id}>
              <div className="oc-top">
                <div className="oc-id">Giao dịch #{t.id}</div>
                <div className="oc-badges">
                  <span className={`badge ${t.type === 'receive' ? 'badge-green' : 'badge-red'}`}>
                    {t.type === 'receive' ? 'Thu' : 'Chi'}
                  </span>
                </div>
              </div>

              <div className="oc-body">
                <div className="oc-customer">
                  <div className="oc-avatar oc-avatar-flat">{t.type === 'receive' ? '💰' : '💸'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="oc-cust-name">{txLabel(t)}</div>
                    <div className="oc-cust-phone">{fmtDateTime(t.createdAt)}</div>
                  </div>
                </div>

                <div className="oc-meta">
                  <div className="oc-cell">
                    <span className="ic">📝</span>
                    <span>{t.note || '—'}</span>
                  </div>
                  <div className="oc-cell">
                    <span className="ic">👤</span>
                    <span>{t.createdBy || '—'}</span>
                  </div>
                </div>

                <div className="oc-total">
                  <span className="oc-total-label">{t.type === 'receive' ? 'Thu vào' : 'Chi ra'}</span>
                  <span className={`oc-total-val ${t.type === 'receive' ? 'money-in' : 'money-out'}`}>
                    {t.type === 'receive' ? '+' : '−'}{fmtMoney(t.amount)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {fund && fund.transactions.length === 0 && (
        <div className="empty">Chưa có giao dịch nào.</div>
      )}

      {showAdjust && (
        <Modal
          title={showAdjust === 'receive' ? 'Nạp tiền vào quỹ' : 'Rút tiền khỏi quỹ'}
          onClose={() => setShowAdjust(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowAdjust(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleAdjust}>
                Xác nhận
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">{showAdjust === 'receive' ? '💵' : '💸'}</span>
                {showAdjust === 'receive' ? 'Nạp tiền vào quỹ' : 'Rút tiền khỏi quỹ'}
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone={showAdjust === 'receive' ? 'success' : 'danger'} req>
                    Số tiền (VNĐ)
                  </FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="field-input"
                    value={amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="muted">Ghi chú</FieldLabel>
                  <textarea className="field-input" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}