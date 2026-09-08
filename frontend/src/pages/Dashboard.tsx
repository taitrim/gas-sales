import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Alerts, DashboardData, Product, StoreInfo } from '../types';
import { fmtDateTime, fmtMoney, fmtNumber, ORDER_STATUS, PAYMENT_STATUS } from '../format';
import StatCard from '../components/ui/StatCard';
import Money from '../components/ui/Money';
import LineChart from '../components/charts/LineChart';
import OrderDetailModal from '../components/OrderDetailModal';

interface Stats {
  todayRevenue: number;
  todayOrders: number;
  monthRevenue: number;
  monthProfit: number;
  productCount: number;
  lowStock: number;
  pendingOrders: number;
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [detail, setDetail] = useState<DashboardData['recentOrders'][number] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getProducts(), api.getStoreInfo(), api.getAlerts(), api.getDashboard()])
      .then(([p, info, a, d]) => {
        setProducts(p);
        setStoreInfo(info);
        setAlerts(a);
        setDash(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats: Stats = useMemo(() => {
    return {
      todayRevenue: dash?.today.revenue || 0,
      todayOrders: dash?.today.orders || 0,
      monthRevenue: dash?.thisMonth.revenue || 0,
      monthProfit: (dash?.thisMonth.revenue || 0) - (dash?.thisMonth.cost || 0),
      productCount: products.length,
      lowStock: products.filter((p) => Number(p.stock) <= 5).length,
      pendingOrders: dash?.pendingOrders || 0
    };
  }, [dash, products]);

  // Số đơn theo trạng thái cho tóm tắt gọn
  const statusCounts = dash?.statusCounts || {};

  // Thông tin kho cơ bản
  const stockInfo = useMemo(() => {
    const out = products.filter((p) => Number(p.stock) <= 0).length;
    const low = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 5).length;
    return { out, low };
  }, [products]);

  const recent = dash?.recentOrders || [];
  const storeName = storeInfo['storeName'] || 'Cửa hàng';

  // Doanh thu 7 ngày gần nhất cho LineChart (đã tính sẵn server-side)
  const trendData = dash?.trend || [];

  if (loading) return <div className="empty">Đang tải dữ liệu...</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{storeName}</h1>
          <div className="muted">Tổng quan hoạt động</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon="💵"
          label="Doanh thu hôm nay"
          value={<Money value={stats.todayRevenue} size="lg" color="in" />}
          sub={`${stats.todayOrders} đơn hoàn thành`}
          tone="blue"
        />
        <StatCard
          icon="📈"
          label="Doanh thu tháng"
          value={<Money value={stats.monthRevenue} size="lg" color="primary" />}
          sub={<>Lợi nhuận gộp <Money value={stats.monthProfit} color="in" /></>}
          tone="green"
        />
        <StatCard
          icon="⏳"
          label="Đơn chờ xử lý"
          value={fmtNumber(statusCounts['pending'] || 0)}
          sub={<Link to="/orders?status=pending">Xem đơn →</Link>}
          tone="amber"
        />
        <StatCard
          icon="🚚"
          label="Đơn chờ giao"
          value={fmtNumber((statusCounts['processing'] || 0) + (statusCounts['waiting_payment'] || 0))}
          sub={<Link to="/orders?status=processing,waiting_payment">Xem đơn →</Link>}
          tone="sky"
        />
      </div>

      {/* Tóm tắt gọn: đơn + kho */}
      <div className="mini-grid">
        <div className="card mini-card">
          <div className="mini-card-title">📦 Trạng thái đơn hàng</div>
          <div className="mini-rows">
            <Link to="/orders?status=pending" className="mini-row">
              <span>Chờ xử lý</span>
              <b className="badge badge-yellow">{fmtNumber(statusCounts['pending'] || 0)}</b>
            </Link>
            <Link to="/orders?status=processing" className="mini-row">
              <span>Đang xử lý</span>
              <b className="badge badge-blue">{fmtNumber(statusCounts['processing'] || 0)}</b>
            </Link>
            <Link to="/orders?status=waiting_payment" className="mini-row">
              <span>Chờ thanh toán</span>
              <b className="badge badge-amber">{fmtNumber(statusCounts['waiting_payment'] || 0)}</b>
            </Link>
            <Link to="/orders?status=completed" className="mini-row">
              <span>Hoàn thành</span>
              <b className="badge badge-green">{fmtNumber(statusCounts['completed'] || 0)}</b>
            </Link>
          </div>
        </div>

        <div className="card mini-card">
          <div className="mini-card-title">🏭 Kho cơ bản</div>
          <div className="mini-rows">
            <Link to="/products" className="mini-row">
              <span>Tổng sản phẩm</span>
              <b>{fmtNumber(stats.productCount)}</b>
            </Link>
            <Link to="/products?stock=low" className="mini-row">
              <span>Sắp hết hàng</span>
              <b className="badge badge-amber">{fmtNumber(stockInfo.low)}</b>
            </Link>
            <Link to="/products?stock=out" className="mini-row">
              <span>Hết hàng</span>
              <b className="badge badge-red">{fmtNumber(stockInfo.out)}</b>
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="page-head" style={{ padding: '16px 20px 0', marginBottom: 0 }}>
          <h1 style={{ fontSize: 17 }}>Đơn hàng gần đây</h1>
          <Link to="/orders" className="btn btn-ghost btn-sm">
            Xem tất cả
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty">Chưa có đơn hàng nào.</div>
        ) : (
          <div className="dash-list">
            {recent.map((o) => {
              const st = ORDER_STATUS[o.status] || { label: o.status, cls: 'badge-gray' };
              const ps = PAYMENT_STATUS[o.paymentStatus] || { label: o.paymentStatus, cls: 'badge-gray' };
              return (
                <div className="dash-row dash-click" key={o.id} onClick={() => setDetail(o)}>
                  <div className="dash-info">
                    <div className="dash-name">{o.id}</div>
                    <div className="dash-sub">
                      {o.customerName || '—'} · {fmtDateTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="dash-right">
                    <div className="dash-badges">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      <span className={`badge ${ps.cls}`}>{ps.label}</span>
                    </div>
                    <div className="dash-val money-primary" style={{ marginTop: 4 }}>
                      {fmtMoney(o.totalAmount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Các phần chi tiết — chỉ hiển thị trên desktop */}
      <div className="dash-detailed">
        <div className="card chart-card mb">
          <h2 className="chart-title">📉 Xu hướng doanh thu 7 ngày</h2>
          <LineChart data={trendData} formatValue={(n) => fmtMoney(n)} />
        </div>

        <div className="alerts-grid">
          <div className="card">
            <h2 className="chart-title">⚠️ Cảnh báo</h2>
            {alerts && alerts.pendingOrders > 0 && (
              <div className="alert-row warn">
                <span>
                  <Link to="/orders">{alerts.pendingOrders} đơn chờ xử lý</Link>
                </span>
              </div>
            )}
            {alerts && alerts.lowStock.length > 0 && (
              <div className="alert-block">
                <div className="alert-title">
                  <Link to="/products">Sắp hết hàng ({alerts.lowStock.length})</Link>
                </div>
                {alerts.lowStock.slice(0, 6).map((p) => (
                  <div className="alert-row" key={p.id}>
                    <span className="alert-name">{p.name}</span>
                    <span className={`badge ${Number(p.stock) <= 0 ? 'badge-red' : 'badge-yellow'}`}>
                      còn {fmtNumber(p.stock)}
                    </span>
                  </div>
                ))}
                {alerts.lowStock.length > 6 && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    và {alerts.lowStock.length - 6} sản phẩm khác...
                  </div>
                )}
              </div>
            )}
            {alerts && alerts.lowStock.length === 0 && alerts.pendingOrders === 0 && (
              <div className="empty">Không có cảnh báo nào. 🎉</div>
            )}
          </div>

          <div className="card">
            <h2 className="chart-title">💳 Công nợ</h2>
            <div className="alert-block">
              <div className="alert-title">
                <Link to="/customers">Khách hàng nợ ({alerts?.customerDebt.length || 0})</Link>
              </div>
              {(alerts?.customerDebt || []).slice(0, 5).map((c) => (
                <div className="alert-row" key={c.customerId}>
                  <span className="alert-name">
                    {c.customerName || c.customerId}
                    {c.phone ? ` (${c.phone})` : ''}
                  </span>
                  <span className="badge badge-red money-debt">{fmtMoney(c.debt)}</span>
                </div>
              ))}
            </div>
            {(alerts?.overdueDebt || []).length > 0 && (
              <div className="alert-block">
                <div className="alert-title">
                  <Link to="/debts">🚨 Nợ quá hạn ({alerts?.overdueDebt.length || 0})</Link>
                </div>
                {(alerts?.overdueDebt || []).slice(0, 5).map((c) => (
                  <div className="alert-row" key={c.customerId}>
                    <span className="alert-name">
                      {c.customerName || c.customerId}
                      {c.phone ? ` (${c.phone})` : ''}
                    </span>
                    <span className="badge badge-red money-debt">
                      {fmtMoney(c.debt)} · quá {c.days} ngày
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="alert-block">
              <div className="alert-title">
                <Link to="/imports">Nợ nhà cung cấp ({alerts?.supplierDebt.length || 0})</Link>
              </div>
              {(alerts?.supplierDebt || []).slice(0, 5).map((s) => (
                <div className="alert-row" key={s.id}>
                  <span className="alert-name">{s.supplierName}</span>
                  <span className="badge badge-yellow money-debt">{fmtMoney(s.remainingAmount)}</span>
                </div>
              ))}
            </div>
            {alerts && alerts.customerDebt.length === 0 && alerts.supplierDebt.length === 0 && (alerts.overdueDebt || []).length === 0 && (
              <div className="empty">Không có công nợ. 👍</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="page-head" style={{ padding: '16px 20px 0', marginBottom: 0 }}>
            <h1 style={{ fontSize: 17 }}>🏆 Top sản phẩm bán chạy (tháng này)</h1>
            <Link to="/reports" className="btn btn-ghost btn-sm">
              Xem báo cáo →
            </Link>
          </div>
          {(dash?.topProducts || []).length === 0 ? (
            <div className="empty">Chưa có dữ liệu.</div>
          ) : (
            <div className="dash-list">
              {(dash?.topProducts || []).map((t, i) => (
                <div className="dash-row" key={t.productId}>
                  <div className={`dash-rank ${i < 3 ? 'hot' : ''}`}>{i + 1}</div>
                  <div className="dash-info">
                    <div className="dash-name">{t.productName}</div>
                    <div className="dash-sub">Bán {fmtNumber(t.qty)} sản phẩm</div>
                  </div>
                  <div className="dash-right">
                    <div className="dash-val money-primary">{fmtMoney(t.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <OrderDetailModal
          order={detail}
          onClose={() => setDetail(null)}
          onStatusChange={(status) => {
            api
              .updateOrderStatus(detail.id, status)
              .then(() => {
                setDetail(null);
                setDash((prev) =>
                  prev
                    ? {
                        ...prev,
                        recentOrders: prev.recentOrders.map((x) =>
                          x.id === detail.id ? { ...x, status } : x
                        )
                      }
                    : prev
                );
              })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}