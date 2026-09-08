export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'staff';
  storeId: string | null;
  approve: boolean;
  active?: boolean;
  createdAt?: string;
  token?: string;
  permissions?: string[] | null;
}

export interface PermissionDef {
  key: string;
  label: string;
}

export interface Category {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  productCount: number;
}

export interface MenuItem {
  name: string;
  price: number;
  unit: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  image: string;
  category: string;
  supplierId: string | null;
  importPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  unit: string;
  pricingTiers: { minQty: number; comboPrice: number }[] | { minQty: number; comboPrice: number };
  isCombo?: boolean;
  variants?: ProductVariant[];
  comboComponents?: ComboComponent[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
}

export interface ComboComponent {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
}

export interface PriceHistoryEntry {
  id: number;
  productId: string;
  field: string;
  oldValue: string;
  newValue: string;
  createdBy: string | null;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  bankInfo: string;
  note: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  source?: string;
  totalSpent: number;
  totalDebt?: number;
  lastPurchaseDate: string | null;
  notes: string;
  debt?: number;
  creditLimit?: number;
  points?: number;
  paymentTermsDays?: number;
}

export interface OverdueInfo {
  days: number;
  amount: number;
}

export interface CustomerWithDebt extends Customer {
  debt: number;
  overdue: OverdueInfo;
}

export interface DebtOverview {
  totalDebt: number;
  overdueAmount: number;
}

export interface Alerts {
  lowStock: { id: string; sku: string; name: string; stock: number }[];
  pendingOrders: number;
  supplierDebt: { id: string; supplierName: string; remainingAmount: number; paymentStatus: string }[];
  customerDebt: { customerId: string; customerName: string; phone: string; debt: number }[];
  overdueDebt: { customerId: string; customerName: string; phone: string; debt: number; days: number }[];
}

export interface OrderItem {
  productId: string;
  variantId?: string | null;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  discount?: number;
  subtotal?: number;
  costPrice: number;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string;
  phone: string;
  address: string;
  orderType: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  surcharge: number;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  paymentStatus: string;
  shippingMethod: string;
  carrier: string;
  dropshipSupplierId: string | null;
  createdBy: string;
  createdAt: string;
  storeId: string;
  note: string;
  deliveryDate: string | null;
  items: OrderItem[];
  taxRate?: number;
  taxAmount?: number;
  pointsEarned?: number;
  pointsUsed?: number;
  pointsValue?: number;
  isPreorder?: boolean;
}

export interface ImportItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  importPrice: number;
}

export interface ImportRecord {
  id: string;
  supplierId: string | null;
  supplierName: string;
  totalAmount: number;
  createdBy: string;
  createdAt: string;
  shippingFee: number;
  carrier: string;
  paymentStatus: string;
  paidAmount: number;
  remainingAmount: number;
  storeId: string;
  items: ImportItem[];
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  managerId: string;
  isActive: boolean;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: string;
  amount: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface SupplierSettlement {
  supplierId: string;
  supplierName: string;
  totalImportDebt: number;
  totalPaid: number;
  profitHeldBySupplier: number;
  finalSettlement: number;
}

export interface FinancialReport {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  netProfit: number;
  totalExpenses: number;
  totalShippingCost: number;
  totalSurcharge: number;
  dropshipStats: {
    totalOrders: number;
    profit: Record<string, number>;
    profitHeldBySupplier: number;
    transferFulfilledOrders: number;
  };
  supplierDetails: SupplierSettlement[];
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  note: string;
  createdBy: string;
  createdAt: string;
  storeId: string;
}

export interface CashTransaction {
  id: number;
  type: 'receive' | 'spend';
  category: string;
  amount: number;
  refId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface CashFund {
  balance: number;
  received: number;
  spent: number;
  transactions: CashTransaction[];
}

export interface DailySales {
  date: string;
  orders: number;
  revenue: number;
  shipping: number;
  discount: number;
  surcharge: number;
  cost: number;
  profit: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface PaymentMethodStat {
  method: string;
  orders: number;
  revenue: number;
}

export interface OrderStatusStat {
  status: string;
  orders: number;
  revenue: number;
}

export interface SalesStats {
  start: string;
  end: string;
  daily: DailySales[];
  topProducts: TopProduct[];
  paymentMethods: PaymentMethodStat[];
  statuses: OrderStatusStat[];
}

export interface StoreInfo {
  [key: string]: string;
}

export interface ImportConfig {
  sheetId: string;
  auth: 'public' | 'apikey' | 'service';
  apiKey: string;
  credsPath: string;
}

export interface ImportTableCheck {
  sheet: string;
  table: string;
  sheetRows: number;
  dbRows: number;
  sheetFound: boolean;
  ok: boolean;
}

export interface ImportIntegrityCheck {
  label: string;
  count: number;
  ok: boolean;
}

export interface ImportCheckReport {
  authName: string;
  tables: ImportTableCheck[];
  integrity: ImportIntegrityCheck[];
}

export interface ImportTableResult {
  sheet: string;
  rows: number;
  skipped: number;
  missingIds: number;
  error?: string;
}

export interface ImportResult {
  total: number;
  dryRun: boolean;
  authName: string;
  results: ImportTableResult[];
}

// ============================================================
// Công nợ khách hàng
// ============================================================
export interface DebtLedgerEntry {
  id: number;
  type: string;
  refType: string | null;
  refId: string | null;
  amount: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CustomerDebtInfo {
  customer: Customer;
  balance: number;
  ledger: DebtLedgerEntry[];
}

// Sổ điểm tích lũy khách hàng
export interface PointsLedgerEntry {
  id: number;
  type: string;
  refType: string | null;
  refId: string | null;
  points: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CustomerPointsInfo {
  customer: Customer;
  balance: number;
  ledger: PointsLedgerEntry[];
}

// ============================================================
// Trả hàng / hoàn tiền
// ============================================================
export interface ReturnItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  costPrice: number;
}

export interface ReturnRecord {
  id: string;
  orderId: string;
  customerId: string | null;
  customerName: string;
  subtotal: number;
  refundAmount: number;
  reason: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  storeId: string | null;
  items: ReturnItem[];
}

// ============================================================
// Khuyến mãi
// ============================================================
export interface Promotion {
  id: string;
  code: string;
  name: string;
  discountType: 'percent' | 'amount';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  usageLimit: number;
  usedCount: number;
  createdAt: string;
}

// ============================================================
// Kiểm kê / điều chỉnh kho
// ============================================================
export interface StockAdjustment {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  oldStock: number;
  newStock: number;
  changeQty: number;
  reason: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  storeId: string | null;
}

// ============================================================
// Nhật ký hoạt động
// ============================================================
export interface AuditLog {
  id: number;
  userId: string | null;
  username: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  page: number;
  pageSize: number;
  total: number;
  rows: AuditLog[];
}

// ============================================================
// Dashboard KPI & báo cáo nâng cao
// ============================================================
export interface DashboardData {
  today: { orders: number; revenue: number };
  thisWeek: { orders: number; revenue: number };
  thisMonth: { orders: number; revenue: number; cost: number };
  lowStockCount: number;
  pendingOrders: number;
  activeCustomersMonth: number;
  statusCounts: Record<string, number>;
  trend: { label: string; value: number }[];
  recentOrders: Order[];
  topProducts: { productId: string; productName: string; qty: number; revenue: number }[];
}

export interface StaffSales {
  createdBy: string;
  staffName: string;
  orders: number;
  revenue: number;
}

export interface CategorySales {
  category: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface ProfitRow {
  period: string;
  orders: number;
  revenue: number;
  cost: number;
  discount: number;
  profit: number;
  margin: number;
}

export interface PeriodComparison {
  current: { from: string; to: string; orders: number; revenue: number; discount: number };
  previous: { from: string; to: string; orders: number; revenue: number; discount: number };
  revenueChangePct: number;
  ordersChangePct: number;
}

// ============================================================
// Sao lưu & khôi phục dữ liệu
// ============================================================
export interface BackupFile {
  fileName: string;
  size: number;
  createdAt: string;
  label?: string;
}

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  keepCount: number;
  backupDir: string;
}

// ============================================================
// Chuyển kho giữa chi nhánh
// ============================================================
export interface StockTransferItem {
  productId: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  fromStoreId: string | null;
  fromStoreName: string;
  toStoreId: string | null;
  toStoreName: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  items: StockTransferItem[];
}

// ============================================================
// Báo cáo tồn kho
// ============================================================
export interface InventoryProductRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  importPrice: number;
  retailPrice: number;
  costValue: number;
  retailValue: number;
  soldQty: number;
  lastSaleDays: number | null;
}

export interface CategoryStock {
  category: string;
  count: number;
  stock: number;
  costValue: number;
  retailValue: number;
}

export interface InventoryReport {
  totalProducts: number;
  totalStock: number;
  totalCostValue: number;
  totalRetailValue: number;
  byCategory: CategoryStock[];
  lowStock: InventoryProductRow[];
  slowMoving: InventoryProductRow[];
  deadStock: InventoryProductRow[];
  topProducts: InventoryProductRow[];
}