import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { CategorySales, FinancialReport, InventoryReport, PeriodComparison, ProfitRow, SalesStats, StaffSales } from '../types';
import { fmtDate, fmtMoney, fmtNumber, PAYMENT_METHOD } from '../format';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import LineChart from '../components/charts/LineChart';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import StatCard from '../components/ui/StatCard';
import Money from '../components/ui/Money';
import { useToast } from '../components/Toast';

const pad = (x: number) => String(x).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

interface Range {
  start: string;
  end: string;
}

const PRESETS: Record<string, { label: string; range: () => Range }> = {
  today: {
    label: 'Hôm nay',
    range: () => {
      const t = new Date();
      return { start: iso(t), end: iso(t) };
    }
  },
  last7: {
    label: '7 ngày qua',
    range: () => {
      const end = new Date();
      return { start: iso(addDays(end, -6)), end: iso(end) };
    }
  },
  thisMonth: {
    label: 'Tháng này',
    range: () => {
      const n = new Date();
      return { start: iso(new Date(n.getFullYear(), n.getMonth(), 1)), end: iso(n) };
    }
  },
  prevMonth: {
    label: 'Tháng trước',
    range: () => {
      const n = new Date();
      return {
        start: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        end: iso(new Date(n.getFullYear(), n.getMonth(), 0))
      };
    }
  },
  last30: {
    label: '30 ngày qua',
    range: () => {
      const end = new Date();
      return { start: iso(addDays(end, -29)), end: iso(end) };
    }
  }
};

export default function Reports() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'overview' | 'profit' | 'staff' | 'category' | 'compare' | 'inventory'>('overview');
  const [preset, setPreset] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [financial, setFinancial] = useState<FinancialReport | null>(null);
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);
  const [staffRows, setStaffRows] = useState<StaffSales[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategorySales[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [profitGroup, setProfitGroup] = useState<'day' | 'week' | 'month'>('day');
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadInventory = useCallback(() => {
    setInvLoading(true);
    api
      .getInventoryReport()
      .then(setInventory)
      .catch((err) => toast((err as Error).message, 'err'))
      .finally(() => setInvLoading(false));
  }, [toast]);

  const load = useCallback(
    (start: string, end: string, group: 'day' | 'week' | 'month' = 'day') => {
      setLoading(true);
      Promise.all([
        api.getSalesStats(start, end),
        api.getFinancialReport(start, end),
        api.getProfitReport(start, end, group),
        api.getSalesByStaff(start, end),
        api.getSalesByCategory(start, end),
        api.getPeriodComparison(start, end)
      ])
        .then(([s, f, p, st, c, comp]) => {
          setStats(s);
          setFinancial(f);
          setProfitRows(p);
          setStaffRows(st);
          setCategoryRows(c);
          setComparison(comp);
        })
        .catch((err) => toast((err as Error).message, 'err'))
        .finally(() => setLoading(false));
    },
    [toast]
  );

  useEffect(() => {
    const r = PRESETS[preset].range();
    setStartDate(r.start);
    setEndDate(r.end);
    load(r.start, r.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(key: string) {
    setPreset(key);
    const r = PRESETS[key].range();
    setStartDate(r.start);
    setEndDate(r.end);
    load(r.start, r.end);
  }

  function applyCustom() {
    if (!startDate || !endDate) {
      toast('Vui lòng chọn ngày bắt đầu và kết thúc.', 'err');
      return;
    }
    setPreset('custom');
    load(startDate, endDate);
  }

  const totalOrders = stats?.daily.reduce((s, d) => s + d.orders, 0) || 0;
  const revenue = financial?.revenue || 0;
  const profit = financial?.grossProfit || 0;
  const cost = financial?.costOfGoods || 0;
  const shipping = financial?.totalShippingCost || 0;

  const TAB_LABEL: Record<string, string> = {
    overview: 'Tổng quan',
    profit: 'Lợi nhuận',
    staff: 'Theo nhân viên',
    category: 'Theo danh mục',
    compare: 'So sánh kỳ',
    inventory: 'Tồn kho'
  };

  function switchTab(t: typeof tab) {
    setTab(t);
    if (t === 'inventory' && !inventory && !invLoading) loadInventory();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Báo cáo & thống kê</h1>
      </div>

      <div className="orders-toolbar report-toolbar">
        <div className="ot-row">
          <select className="report-preset" value={preset} onChange={(e) => applyPreset(e.target.value)}>
            {Object.entries(PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
            <option value="custom">Tùy chỉnh</option>
          </select>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span className="range-sep muted">→</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button className="ot-reset" onClick={applyCustom}>
            Áp dụng
          </button>
        </div>
        {stats && (
          <div className="ot-row report-range-info">
            📅 {fmtDate(stats.start)} — {fmtDate(stats.end)}
          </div>
        )}
      </div>

      <SegmentedTabs
        value={tab}
        onChange={(k) => switchTab(k)}
        options={(['overview', 'profit', 'staff', 'category', 'compare', 'inventory'] as const).map((t) => ({
          value: t,
          label: TAB_LABEL[t]
        }))}
      />

      {loading ? (
        <div className="empty">Đang tải báo cáo...</div>
      ) : (
        <>
          {tab === 'overview' && (
            <>
          <div className="stats-grid">
            <StatCard
              icon="💵"
              label="Doanh thu"
              value={<Money value={revenue} size="lg" color="in" />}
              sub={`${fmtNumber(totalOrders)} đơn hoàn thành`}
              tone="blue"
            />
            <StatCard
              icon="📈"
              label="Lợi nhuận gộp"
              value={<Money value={profit} size="lg" color="primary" />}
              sub={`Biên lợi nhuận ${revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0'}%`}
              tone="green"
            />
            <StatCard
              icon="🧾"
              label="Giá vốn hàng bán"
              value={<Money value={cost} size="lg" color="out" />}
              sub={<>Phí ship <Money value={shipping} color="out" /></>}
              tone="violet"
            />
            <StatCard
              icon="🛍️"
              label="Trung bình / đơn"
              value={<Money value={totalOrders > 0 ? revenue / totalOrders : 0} size="lg" />}
              sub={`${fmtNumber(totalOrders)} đơn trong kỳ`}
              tone="amber"
            />
          </div>

          <div className="report-grid">
            <div className="card chart-card span2">
              <h2 className="chart-title">Doanh thu theo ngày</h2>
              <BarChart
                data={(stats?.daily || []).map((d) => ({
                  label: d.date.slice(5).replace('-', '/'),
                  value: d.revenue
                }))}
                height={240}
              />
            </div>

            <div className="card chart-card">
              <h2 className="chart-title">Phương thức thanh toán</h2>
              <DonutChart
                data={(stats?.paymentMethods || []).map((m) => ({
                  label: PAYMENT_METHOD[m.method] || m.method || 'Khác',
                  value: m.revenue
                }))}
                centerText={fmtMoney(revenue)}
                centerSub="Theo doanh thu"
              />
            </div>

            <div className="card chart-card">
              <h2 className="chart-title">Trạng thái đơn hàng</h2>
              <DonutChart
                data={(stats?.statuses || []).map((s) => ({
                  label: s.status || '—',
                  value: s.orders
                }))}
                centerText={fmtNumber(totalOrders)}
                centerSub="Đơn trong kỳ"
                formatValue={(n) => fmtNumber(n)}
              />
            </div>

            <div className="card chart-card span2">
              <h2 className="chart-title">Top sản phẩm bán chạy</h2>
              <table className="data">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="right">SL bán</th>
                    <th className="right">Doanh thu</th>
                    <th className="right">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.topProducts || []).map((p, i) => (
                    <tr key={p.productId}>
                      <td data-label="Sản phẩm" style={{ fontWeight: 600 }}>
                        <span className="top-rank">{i + 1}</span> {p.productName}
                      </td>
                      <td data-label="SL bán" className="right nowrap">{fmtNumber(p.qty)}</td>
                      <td data-label="Doanh thu" className="right nowrap">{fmtMoney(p.revenue)}</td>
                      <td data-label="Lợi nhuận" className="right nowrap" style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {fmtMoney(p.profit)}
                      </td>
                    </tr>
                  ))}
                  {(stats?.topProducts || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        Không có dữ liệu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card chart-card span2">
              <h2 className="chart-title">Công nợ nhà cung cấp</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Nhà cung cấp</th>
                      <th className="right">Tổng nhập</th>
                      <th className="right">Đã trả</th>
                      <th className="right">Lợi nhuận giữ (dropship)</th>
                      <th className="right">Thanh toán cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(financial?.supplierDetails || []).map((s) => (
                      <tr key={s.supplierId}>
                        <td data-label="NCC" style={{ fontWeight: 600 }}>{s.supplierName}</td>
                        <td data-label="Tổng nhập" className="right nowrap">{fmtMoney(s.totalImportDebt)}</td>
                        <td data-label="Đã trả" className="right nowrap">{fmtMoney(s.totalPaid)}</td>
                        <td data-label="Lợi nhuận giữ" className="right nowrap">{fmtMoney(s.profitHeldBySupplier)}</td>
                        <td data-label="Thanh toán cuối" className="right nowrap" style={{ fontWeight: 600 }}>
                          {fmtMoney(s.finalSettlement)}
                        </td>
                      </tr>
                    ))}
                    {(financial?.supplierDetails || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty">
                          Không có dữ liệu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
            </>
          )}

          {tab === 'profit' && (
            <>
              <div className="orders-toolbar" style={{ marginBottom: 14 }}>
                <div className="ot-row">
                  <select
                    className="report-preset"
                    value={profitGroup}
                    onChange={(e) => {
                      setProfitGroup(e.target.value as 'day' | 'week' | 'month');
                      load(startDate, endDate, e.target.value as 'day' | 'week' | 'month');
                    }}
                  >
                    <option value="day">Theo ngày</option>
                    <option value="week">Theo tuần</option>
                    <option value="month">Theo tháng</option>
                  </select>
                </div>
              </div>
              <div className="card chart-card span2">
                <h2 className="chart-title">Doanh thu & lợi nhuận theo kỳ</h2>
                <BarChart
                  data={profitRows.map((r) => ({ label: r.period, value: r.revenue }))}
                  height={220}
                />
              </div>
              <div className="card chart-card span2">
                <h2 className="chart-title">Lợi nhuận theo kỳ</h2>
                <LineChart
                  data={profitRows.map((r) => ({ label: r.period, value: r.profit }))}
                  formatValue={(n) => fmtMoney(n)}
                  height={200}
                />
              </div>
              <div className="card table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Kỳ</th>
                      <th className="right">Đơn</th>
                      <th className="right">Doanh thu</th>
                      <th className="right">Giá vốn</th>
                      <th className="right">Chiết khấu</th>
                      <th className="right">Lợi nhuận</th>
                      <th className="right">Biên lợi nhuận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty">Không có dữ liệu.</td>
                      </tr>
                    )}
                    {profitRows.map((r, i) => (
                      <tr key={i}>
                        <td data-label="Kỳ" className="nowrap">{r.period}</td>
                        <td data-label="Đơn" className="right">{fmtNumber(r.orders)}</td>
                        <td data-label="Doanh thu" className="right nowrap"><span className="money-in">{fmtMoney(r.revenue)}</span></td>
                        <td data-label="Giá vốn" className="right nowrap"><span className="money-out">{fmtMoney(r.cost)}</span></td>
                        <td data-label="Chiết khấu" className="right nowrap"><span className="money-debt">{fmtMoney(r.discount)}</span></td>
                        <td data-label="Lợi nhuận" className="right nowrap money-in" style={{ fontWeight: 600 }}>
                          {fmtMoney(r.profit)}
                        </td>
                        <td data-label="Biên LN" className="right nowrap">{r.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'staff' && (
            <>
              <div className="card table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th className="right">Đơn</th>
                      <th className="right">Doanh thu</th>
                      <th className="right">Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="empty">Không có dữ liệu.</td>
                      </tr>
                    )}
                    {staffRows.map((r) => (
                      <tr key={r.createdBy}>
                        <td data-label="Nhân viên" style={{ fontWeight: 600 }}>{r.staffName}</td>
                        <td data-label="Đơn" className="right">{fmtNumber(r.orders)}</td>
                        <td data-label="Doanh thu" className="right nowrap">{fmtMoney(r.revenue)}</td>
                        <td data-label="Tỷ trọng" className="right nowrap">
                          {revenue > 0 ? ((r.revenue / revenue) * 100).toFixed(1) : '0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'category' && (
            <>
              <div className="card table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Danh mục</th>
                      <th className="right">SL bán</th>
                      <th className="right">Doanh thu</th>
                      <th className="right">Giá vốn</th>
                      <th className="right">Lợi nhuận</th>
                      <th className="right">Biên lợi nhuận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty">Không có dữ liệu.</td>
                      </tr>
                    )}
                    {categoryRows.map((c) => (
                      <tr key={c.category}>
                        <td data-label="Danh mục" style={{ fontWeight: 600 }}>{c.category}</td>
                        <td data-label="SL bán" className="right">{fmtNumber(c.qty)}</td>
                        <td data-label="Doanh thu" className="right nowrap"><span className="money-in">{fmtMoney(c.revenue)}</span></td>
                        <td data-label="Giá vốn" className="right nowrap"><span className="money-out">{fmtMoney(c.cost)}</span></td>
                        <td data-label="Lợi nhuận" className="right nowrap money-in" style={{ fontWeight: 600 }}>
                          {fmtMoney(c.profit)}
                        </td>
                        <td data-label="Biên LN" className="right nowrap">{c.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'compare' && comparison && (
            <>
              <div className="stats-grid">
                <div className="stat-card tone-slate">
                  <div className="stat-icon">📅</div>
                  <div className="stat-body">
                    <div className="label">Kỳ này</div>
                    <div className="value">{fmtMoney(comparison.current.revenue)}</div>
                    <div className="sub">{comparison.current.orders} đơn</div>
                  </div>
                </div>
                <div className="stat-card tone-slate">
                  <div className="stat-icon">🕰️</div>
                  <div className="stat-body">
                    <div className="label">Kỳ trước</div>
                    <div className="value">{fmtMoney(comparison.previous.revenue)}</div>
                    <div className="sub">{comparison.previous.orders} đơn</div>
                  </div>
                </div>
                <div className="stat-card tone-green">
                  <div className="stat-icon">📈</div>
                  <div className="stat-body">
                    <div className="label">Doanh thu tăng/giảm</div>
                    <div className="value" style={{ color: comparison.revenueChangePct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {comparison.revenueChangePct >= 0 ? '+' : ''}{comparison.revenueChangePct.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="stat-card tone-amber">
                  <div className="stat-icon">🛒</div>
                  <div className="stat-body">
                    <div className="label">Số đơn tăng/giảm</div>
                    <div className="value" style={{ color: comparison.ordersChangePct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {comparison.ordersChangePct >= 0 ? '+' : ''}{comparison.ordersChangePct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
              <div className="card table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Chỉ tiêu</th>
                      <th className="right">Kỳ trước</th>
                      <th className="right">Kỳ này</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td data-label="Chỉ tiêu" style={{ fontWeight: 600 }}>Doanh thu</td>
                      <td data-label="Kỳ trước" className="right">{fmtMoney(comparison.previous.revenue)}</td>
                      <td data-label="Kỳ này" className="right">{fmtMoney(comparison.current.revenue)}</td>
                    </tr>
                    <tr>
                      <td data-label="Chỉ tiêu" style={{ fontWeight: 600 }}>Số đơn</td>
                      <td data-label="Kỳ trước" className="right">{fmtNumber(comparison.previous.orders)}</td>
                      <td data-label="Kỳ này" className="right">{fmtNumber(comparison.current.orders)}</td>
                    </tr>
                    <tr>
                      <td data-label="Chỉ tiêu" style={{ fontWeight: 600 }}>Chiết khấu</td>
                      <td data-label="Kỳ trước" className="right">{fmtMoney(comparison.previous.discount)}</td>
                      <td data-label="Kỳ này" className="right">{fmtMoney(comparison.current.discount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'inventory' &&
            (invLoading && !inventory ? (
              <div className="empty">Đang tải báo cáo tồn kho...</div>
            ) : !inventory ? (
              <div className="empty">Không có dữ liệu.</div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-card tone-slate">
                    <div className="stat-icon">📦</div>
                    <div className="stat-body">
                      <div className="label">Tổng tồn kho</div>
                      <div className="value">{fmtNumber(inventory.totalStock, 2)}</div>
                      <div className="sub">{inventory.totalProducts} sản phẩm</div>
                    </div>
                  </div>
                  <div className="stat-card tone-blue">
                    <div className="stat-icon">🏷️</div>
                    <div className="stat-body">
                      <div className="label">Giá trị theo giá nhập</div>
                      <div className="value">{fmtMoney(inventory.totalCostValue)}</div>
                    </div>
                  </div>
                  <div className="stat-card tone-green">
                    <div className="stat-icon">💰</div>
                    <div className="stat-body">
                      <div className="label">Giá trị theo giá bán</div>
                      <div className="value">{fmtMoney(inventory.totalRetailValue)}</div>
                    </div>
                  </div>
                  <div className="stat-card tone-amber">
                    <div className="stat-icon">⚠️</div>
                    <div className="stat-body">
                      <div className="label">Hàng sắp hết</div>
                      <div className="value">{inventory.lowStock.length}</div>
                    </div>
                  </div>
                  <div className="stat-card tone-rose">
                    <div className="stat-icon">🐌</div>
                    <div className="stat-body">
                      <div className="label">Tồn chậm bán</div>
                      <div className="value">{inventory.slowMoving.length}</div>
                    </div>
                  </div>
                  <div className="stat-card tone-rose">
                    <div className="stat-icon">🧊</div>
                    <div className="stat-body">
                      <div className="label">Tồn chết</div>
                      <div className="value">{inventory.deadStock.length}</div>
                    </div>
                  </div>
                </div>

                <div className="card table-wrap">
                  <h3 className="section-title">Tồn theo danh mục</h3>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Danh mục</th>
                        <th className="right">SL sản phẩm</th>
                        <th className="right">Tồn</th>
                        <th className="right">Giá trị nhập</th>
                        <th className="right">Giá trị bán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.byCategory.map((c) => (
                        <tr key={c.category}>
                          <td data-label="Danh mục" style={{ fontWeight: 600 }}>{c.category}</td>
                          <td data-label="SL sp" className="right">{fmtNumber(c.count)}</td>
                          <td data-label="Tồn" className="right">{fmtNumber(c.stock, 2)}</td>
                          <td data-label="GT nhập" className="right nowrap">{fmtMoney(c.costValue)}</td>
                          <td data-label="GT bán" className="right nowrap">{fmtMoney(c.retailValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card table-wrap">
                  <h3 className="section-title">Hàng sắp hết (≤ 5)</h3>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Tên sản phẩm</th>
                        <th>Danh mục</th>
                        <th className="right">Tồn</th>
                        <th className="right">Giá trị</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.lowStock.length === 0 && (
                        <tr><td colSpan={5} className="empty">Không có.</td></tr>
                      )}
                      {inventory.lowStock.map((p) => (
                        <tr key={p.id}>
                          <td data-label="SKU" className="nowrap">{p.sku || '—'}</td>
                          <td data-label="Tên" style={{ fontWeight: 600 }}>{p.name}</td>
                          <td data-label="Danh mục">{p.category}</td>
                          <td data-label="Tồn" className="right" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmtNumber(p.stock, 2)}</td>
                          <td data-label="Giá trị" className="right nowrap">{fmtMoney(p.costValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card table-wrap">
                  <h3 className="section-title">Tồn chậm bán (60-119 ngày không bán)</h3>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Tên sản phẩm</th>
                        <th className="right">Tồn</th>
                        <th className="right">Đã bán</th>
                        <th className="right">Ngày cuối bán</th>
                        <th className="right">Giá trị nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.slowMoving.length === 0 && (
                        <tr><td colSpan={6} className="empty">Không có.</td></tr>
                      )}
                      {inventory.slowMoving.map((p) => (
                        <tr key={p.id}>
                          <td data-label="SKU" className="nowrap">{p.sku || '—'}</td>
                          <td data-label="Tên" style={{ fontWeight: 600 }}>{p.name}</td>
                          <td data-label="Tồn" className="right">{fmtNumber(p.stock, 2)}</td>
                          <td data-label="Đã bán" className="right">{fmtNumber(p.soldQty)}</td>
                          <td data-label="Ngày cuối" className="right nowrap">{p.lastSaleDays === null ? '—' : `${p.lastSaleDays} ngày`}</td>
                          <td data-label="GT nhập" className="right nowrap">{fmtMoney(p.costValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card table-wrap">
                  <h3 className="section-title">Tồn chết (≥ 120 ngày không bán)</h3>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Tên sản phẩm</th>
                        <th className="right">Tồn</th>
                        <th className="right">Ngày cuối bán</th>
                        <th className="right">Giá trị nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.deadStock.length === 0 && (
                        <tr><td colSpan={5} className="empty">Không có.</td></tr>
                      )}
                      {inventory.deadStock.map((p) => (
                        <tr key={p.id}>
                          <td data-label="SKU" className="nowrap">{p.sku || '—'}</td>
                          <td data-label="Tên" style={{ fontWeight: 600 }}>{p.name}</td>
                          <td data-label="Tồn" className="right">{fmtNumber(p.stock, 2)}</td>
                          <td data-label="Ngày cuối" className="right nowrap">{p.lastSaleDays === null ? 'Chưa bán' : `${p.lastSaleDays} ngày`}</td>
                          <td data-label="GT nhập" className="right nowrap">{fmtMoney(p.costValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ))}
        </>
      )}
    </div>
  );
}