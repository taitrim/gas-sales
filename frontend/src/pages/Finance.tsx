import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { FinancialReport } from '../types';
import { fmtMoney, monthStart, today } from '../format';

export default function Finance() {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getFinancialReport(startDate, endDate)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(load, [load]);

  const cards = [
    { label: 'Doanh thu', value: report?.revenue, icon: '💵', tone: 'tone-blue' },
    { label: 'Giá vốn hàng bán', value: report?.costOfGoods, icon: '📦', tone: 'tone-violet' },
    { label: 'Lợi nhuận gộp', value: report?.grossProfit, icon: '📈', tone: 'tone-green' },
    { label: 'Chi phí vận chuyển', value: report?.totalShippingCost, icon: '🚚', tone: 'tone-amber' },
    { label: 'Chi phí vận hành', value: report?.totalExpenses, icon: '🧾', tone: 'tone-slate' },
    { label: 'Lợi nhuận ròng', value: report?.netProfit, icon: '🏆', tone: 'tone-rose' }
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Tài chính</h1>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span className="muted">→</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : (
        <>
          <div className="stats-grid">
            {cards.map((c) => (
              <div className={`stat-card ${c.tone}`} key={c.label}>
                <div className="stat-icon">{c.icon}</div>
                <div className="stat-body">
                  <div className="label">{c.label}</div>
                  <div className="value">{fmtMoney(c.value)}</div>
                </div>
              </div>
            ))}
            <div className="stat-card tone-sky">
              <div className="stat-icon">📤</div>
              <div className="stat-body">
                <div className="label">Đơn drop-ship hoàn thành</div>
                <div className="value">{report?.dropshipStats.totalOrders ?? 0}</div>
                <div className="sub">Lợi nhuận ghi có ở NCC: {fmtMoney(report?.dropshipStats.profitHeldBySupplier)}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Lợi nhuận drop-ship theo hình thức thanh toán</h2>
            <div className="stats-grid">
              {[
                { label: 'NCC thu tiền (cash)', value: report?.dropshipStats.profit?.cash, icon: '💵', tone: 'tone-green' },
                { label: 'NCC thu tiền (COD)', value: report?.dropshipStats.profit?.cod, icon: '📦', tone: 'tone-blue' },
                { label: 'Khách chuyển khoản', value: report?.dropshipStats.profit?.transfer, icon: '🏦', tone: 'tone-violet' },
                { label: 'Khách trả thẻ', value: report?.dropshipStats.profit?.card, icon: '💳', tone: 'tone-amber' }
              ].map((c) => (
                <div className={`stat-card ${c.tone}`} key={c.label}>
                  <div className="stat-icon">{c.icon}</div>
                  <div className="stat-body">
                    <div className="label">{c.label}</div>
                    <div className="value">{fmtMoney(c.value)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hint">
              Dropship trả tiền mặt/COD: NCC giao và thu tiền, shop ghi có lợi nhuận ở NCC (trừ khi thanh toán/đối soát).
              Dropship chuyển khoản/thẻ: khách trả đủ cho shop, shop tự lập phiếu nhập, lợi nhuận tính như đơn thường.
            </div>
          </div>

          <div className="card">
            <div className="page-head" style={{ padding: '16px 20px 0', marginBottom: 0 }}>
              <h1 style={{ fontSize: 17 }}>Đối soát nhà cung cấp</h1>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Nhà cung cấp</th>
                    <th className="right">Tổng nợ nhập hàng</th>
                    <th className="right">Đã trả</th>
                    <th className="right">Lợi nhuận giữ ở NCC</th>
                    <th className="right">Số phải trả còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.supplierDetails ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty">
                        Chưa có dữ liệu nhà cung cấp.
                      </td>
                    </tr>
                  )}
                  {(report?.supplierDetails ?? []).map((s) => (
                    <tr key={s.supplierId}>
                      <td data-label="Nhà cung cấp" style={{ fontWeight: 600 }}>{s.supplierName}</td>
                      <td data-label="Tổng nợ nhập hàng" className="right nowrap"><span className="money-debt">{fmtMoney(s.totalImportDebt)}</span></td>
                      <td data-label="Đã trả" className="right nowrap"><span className="money-in">{fmtMoney(s.totalPaid)}</span></td>
                      <td data-label="Lợi nhuận giữ ở NCC" className="right nowrap"><span className="money-primary">{fmtMoney(s.profitHeldBySupplier)}</span></td>
                      <td data-label="Số phải trả còn lại" className="right nowrap" style={{ fontWeight: 600 }}>
                        <span className="money-out">{fmtMoney(s.finalSettlement)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}