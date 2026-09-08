import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { api } from '../api';
import type { Product, Supplier, StoreInfo } from '../types';
import OrderFormModal, { type OrderForm, emptyOrderForm } from './OrderFormModal';
import ImportFormModal, { type ImportForm } from './ImportFormModal';
import { useToast } from './Toast';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  perm?: string;
  group?: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Tổng quan', icon: '📊', group: 'main' },
  { to: '/pos', label: 'POS bán hàng', icon: '🛍️', perm: 'pos', group: 'main' },
  { to: '/orders', label: 'Đơn hàng', icon: '🛒', perm: 'orders', group: 'main' },
  { to: '/products', label: 'Sản phẩm', icon: '📦', perm: 'products', group: 'inventory' },
  { to: '/imports', label: 'Nhập hàng', icon: '📥', perm: 'imports', group: 'inventory' },
  { to: '/suppliers', label: 'Nhà cung cấp', icon: '🏭', perm: 'suppliers', group: 'inventory' },
  { to: '/customers', label: 'Khách hàng', icon: '👥', perm: 'customers', group: 'customers' },
  { to: '/debts', label: 'Công nợ', icon: '🧮', perm: 'debts', group: 'customers' },
  { to: '/returns', label: 'Trả hàng', icon: '🔄', perm: 'returns', group: 'customers' },
  { to: '/reports', label: 'Báo cáo', icon: '📈', perm: 'reports', group: 'finance' },
  { to: '/finance', label: 'Tài chính', icon: '💰', perm: 'finance', group: 'finance' },
  { to: '/cash', label: 'Quỹ tiền mặt', icon: '🏦', perm: 'cash', group: 'finance' },
  { to: '/expenses', label: 'Phiếu chi', icon: '🧾', perm: 'expenses', group: 'finance' },
  { to: '/promotions', label: 'Khuyến mãi', icon: '🏷️', adminOnly: true, perm: 'promotions', group: 'admin' },
  { to: '/stock-adjustments', label: 'Kiểm kê', icon: '⚖️', adminOnly: true, perm: 'stock', group: 'admin' },
  { to: '/stock-transfers', label: 'Chuyển kho', icon: '🚚', adminOnly: true, perm: 'stock', group: 'admin' },
  { to: '/audit', label: 'Nhật ký', icon: '📜', adminOnly: true, group: 'admin' },
  { to: '/backup', label: 'Sao lưu', icon: '💾', adminOnly: true, group: 'admin' },
  { to: '/stores', label: 'Cửa hàng', icon: '🏬', adminOnly: true, perm: 'stores', group: 'admin' },
  { to: '/users', label: 'Người dùng', icon: '🔐', adminOnly: true, group: 'admin' },
  { to: '/import-data', label: 'Import dữ liệu', icon: '📤', adminOnly: true, group: 'admin' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️', adminOnly: true, group: 'settings' }
];

const PRIMARY = ['/', '/pos', '/orders', '/products', '/customers'];

const GROUP_LABELS: Record<string, string> = {
  main: 'Bán hàng',
  inventory: 'Kho & nhập',
  customers: 'Khách hàng',
  finance: 'Tài chính',
  admin: 'Quản trị',
  settings: 'Hệ thống'
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickImportOpen, setQuickImportOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string; address: string; points?: number }[]>([]);
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrderForm());
  const [importForm, setImportForm] = useState<ImportForm>({ supplierId: '', supplierName: '', carrier: '', shippingFee: 0, paidAmount: 0, items: [] });
  const [_savingOrder, setSavingOrder] = useState(false);
  const [_savingImport, setSavingImport] = useState(false);

  const loadFormData = useCallback(() => {
    Promise.all([api.getProducts(), api.getSuppliers(), api.getCustomers()])
      .then(([p, s, c]) => {
        setProducts(p);
        setSuppliers(s);
        setCustomers(c);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.getStoreInfo().then(setStoreInfo).catch(() => {});
  }, []);

  useEffect(() => {
    const name = storeInfo['storeName'];
    if (name) document.title = name;
  }, [storeInfo]);

  useEffect(() => {
    if (quickOrderOpen || quickImportOpen) loadFormData();
  }, [quickOrderOpen, quickImportOpen, loadFormData]);

  async function handleOrderSave() {
    if (orderForm.items.length === 0) {
      toast('Đơn hàng phải có ít nhất 1 sản phẩm.', 'err');
      return;
    }
    setSavingOrder(true);
    try {
      const pv = Number(storeInfo.pointValue) || 1000;
      const subtotal = orderForm.items.reduce((s, it) => s + it.quantity * it.price, 0);
      const pointsValue = (Number(orderForm.pointsUsed) || 0) * pv;
      const taxAmount = Math.max(0, Math.round((subtotal - orderForm.discount - pointsValue) * ((Number(orderForm.taxRate) || 0) / 100)));
      const totalAmount = Math.max(0, subtotal - orderForm.discount - pointsValue + taxAmount + orderForm.shippingFee + orderForm.surcharge);
      await api.createOrder({ ...orderForm, subtotal, totalAmount });
      toast('Đã tạo đơn hàng!');
      setQuickOrderOpen(false);
      setOrderForm(emptyOrderForm());
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleImportSave() {
    if (importForm.items.length === 0) {
      toast('Phiếu nhập phải có ít nhất 1 sản phẩm.', 'err');
      return;
    }
    setSavingImport(true);
    try {
      await api.createImport(importForm);
      toast('Đã tạo phiếu nhập!');
      setQuickImportOpen(false);
      setImportForm({ supplierId: '', supplierName: '', carrier: '', shippingFee: 0, paidAmount: 0, items: [] });
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSavingImport(false);
    }
  }

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) setInstalled(true);
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleInstall() {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }

  const navItems = NAV.filter(
    (n) => !n.adminOnly || user?.role === 'admin'
  ).filter((n) => {
    if (user?.role === 'admin') return true;
    if (!n.perm) return true;
    return Array.isArray(user?.permissions) && user!.permissions.includes(n.perm);
  });
  const primaryItems = navItems.filter((n) => PRIMARY.includes(n.to));
  const showInstall = !installed && installEvt;

  const storeLogo = storeInfo['logo'];
  const BrandLogo = ({ size = 34 }: { size?: number }) =>
    storeLogo ? (
      <img
        className="logo-img"
        src={storeLogo}
        alt="logo"
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 9 }}
      />
    ) : (
      <div
        className="logo"
        style={{ width: size, height: size, borderRadius: 11, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}
      >
        G
      </div>
    );

  const sidebarGroups = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group || 'main';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  /* Bottom nav: [Tổng quan] [POS] [  ＋ FAB  ] [Đơn hàng] [Thêm] */
  const leftItems = primaryItems.filter((n) => ['/', '/pos'].includes(n.to));
  const rightItems = primaryItems.filter((n) => ['/orders'].includes(n.to));

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}>
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
        <div className="brand">
          <BrandLogo size={36} />
          <div>
            {storeInfo['storeName'] || 'GAS Sales Pro'}
            <small>Quản lý bán hàng</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {Object.entries(sidebarGroups).map(([group, items]) => (
            <div key={group} className="nav-group">
              {group !== 'main' && <div className="nav-group-label">{GROUP_LABELS[group] || group}</div>}
              {items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="nav-ico">{n.icon}</span>
                  <span>{n.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {showInstall && (
          <div className="install-btn-wrap">
            <button className="install-btn" onClick={handleInstall}>
              📲 Cài đặt ứng dụng
            </button>
          </div>
        )}
        <div className="user-box">
          <div className="row">
            <div className="avatar">{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div className="name">{user?.fullName || user?.username}</div>
              <div className="role">{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="btn-ghost btn-sm" onClick={toggle} style={{ flex: 1, fontSize: 12 }}>
              {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
            </button>
            <button className="btn-ghost btn-sm" onClick={handleLogout} style={{ flex: 1, fontSize: 12 }}>
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Topbar (mobile) ---------- */}
      <header className="topbar">
        <BrandLogo size={32} />
        <div className="brand-name">{storeInfo['storeName'] || 'GAS Sales Pro'}</div>
        {showInstall && (
          <button className="install-btn top" onClick={handleInstall} aria-label="Cài đặt ứng dụng">
            📲
          </button>
        )}
        <button className="theme-toggle" onClick={toggle} aria-label="Đổi giao diện sáng/tối">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {/* ---------- Drawer (desktop + mobile left) ---------- */}
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="backdrop" onClick={() => setDrawerOpen(false)} />
        <div className="panel">
          <div className="drawer-brand">
            <BrandLogo size={34} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{storeInfo['storeName'] || 'GAS Sales Pro'}</div>
              <div style={{ color: '#8b90a8', fontSize: 12 }}>Quản lý bán hàng</div>
            </div>
          </div>
          <div className="drawer-nav">
            {Object.entries(sidebarGroups).map(([group, items]) => (
              <div key={group} className="nav-group">
                {group !== 'main' && <div className="nav-group-label">{GROUP_LABELS[group] || group}</div>}
                {items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setDrawerOpen(false)}>
                    <span className="nav-ico">{n.icon}</span>
                    <span>{n.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
          <div className="user-box">
            <div className="row">
              <div className="avatar">{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div className="name">{user?.fullName || user?.username}</div>
                <div className="role">{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div>
              </div>
            </div>
            <div className="drawer-actions">
              <button className="btn-ghost btn-sm" onClick={toggle}>
                {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
              </button>
              <button className="btn-ghost btn-sm" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Quick Order Modal (same form as Orders page) ---------- */}
      {quickOrderOpen && (
        <OrderFormModal
          form={orderForm}
          setForm={setOrderForm}
          products={products}
          suppliers={suppliers}
          customers={customers}
          editing={false}
          onClose={() => { setQuickOrderOpen(false); setOrderForm(emptyOrderForm()); }}
          onSave={handleOrderSave}
          onCustomerAdded={(c) => setCustomers((prev) => [...prev, c])}
          pointValue={Number(storeInfo.pointValue)}
          pointsRate={Number(storeInfo.pointsRate)}
        />
      )}

      {/* ---------- Quick Import Modal (same form as Imports page) ---------- */}
      {quickImportOpen && (
        <ImportFormModal
          form={importForm}
          setForm={setImportForm}
          products={products}
          suppliers={suppliers}
          selectSupplier={(id) => {
            const s = suppliers.find((x) => x.id === id);
            setImportForm({ ...importForm, supplierId: id, supplierName: s?.name || '' });
          }}
          editing={false}
          onClose={() => { setQuickImportOpen(false); setImportForm({ supplierId: '', supplierName: '', carrier: '', shippingFee: 0, paidAmount: 0, items: [] }); }}
          onSave={handleImportSave}
        />
      )}

      {/* ---------- Bottom sheet (mobile "Thêm" menu) ---------- */}
      <div className={`more-sheet ${sheetOpen ? 'open' : ''}`}>
        <div className="more-sheet-backdrop" onClick={() => setSheetOpen(false)} />
        <div className="more-sheet-panel">
          <div className="more-sheet-handle" />
          <div className="more-sheet-header">
            <BrandLogo size={30} />
            <span className="more-sheet-title">Danh mục</span>
          </div>
          <div className="more-sheet-nav">
            {Object.entries(sidebarGroups).map(([group, items]) => (
              <div key={group} className="nav-group">
                <div className="nav-group-label">{GROUP_LABELS[group] || group}</div>
                {items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSheetOpen(false)}>
                    <span className="nav-ico">{n.icon}</span>
                    <span>{n.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
          <div className="more-sheet-footer">
            <div className="more-sheet-user">
              <div className="more-sheet-avatar">{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div className="more-sheet-name">{user?.fullName || user?.username}</div>
                <div className="more-sheet-role">{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div>
              </div>
            </div>
            <div className="more-sheet-actions">
              <button className="btn btn-ghost btn-sm" onClick={toggle}>
                {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- FAB popup (mobile) ---------- */}
      <div className={`fab-popup ${fabMenuOpen ? 'open' : ''}`}>
        <div className="fab-popup-backdrop" onClick={() => setFabMenuOpen(false)} />
        <div className="fab-popup-menu">
          <button className="fab-popup-item" onClick={() => { setFabMenuOpen(false); setQuickOrderOpen(true); }}>
            <span className="fpi-icon">🛒</span>
            <div className="fpi-text">
              <div className="fpi-title">Tạo đơn hàng</div>
              <div className="fpi-desc">Bán hàng mới</div>
            </div>
          </button>
          <button className="fab-popup-item" onClick={() => { setFabMenuOpen(false); setQuickImportOpen(true); }}>
            <span className="fpi-icon">📥</span>
            <div className="fpi-text">
              <div className="fpi-title">Nhập hàng</div>
              <div className="fpi-desc">Tạo phiếu nhập</div>
            </div>
          </button>
        </div>
      </div>

      {/* ---------- Bottom nav (mobile) ---------- */}
      <nav className="bottom-nav">
        {leftItems.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-ico">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="bottom-nav-center">
          <button className="fab-btn" onClick={() => setFabMenuOpen(!fabMenuOpen)}>
            <span className={`fab-plus ${fabMenuOpen ? 'open' : ''}`}>＋</span>
          </button>
        </div>
        {rightItems.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-ico">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button className="bottom-nav-more" onClick={() => setSheetOpen(true)}>
          <span className="nav-ico">☰</span>
          <span>Thêm</span>
        </button>
      </nav>

      {/* ---------- Content ---------- */}
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
