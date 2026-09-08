import type {
  ApiResponse,
  User,
  Product,
  Category,
  MenuItem,
  Supplier,
  Customer,
  Order,
  ImportRecord,
  Store,
  StoreInfo,
  SupplierTransaction,
  FinancialReport,
  ImportConfig,
  ImportCheckReport,
  ImportResult,
  Paginated,
  SalesStats,
  Alerts,
  Expense,
  CashFund,
  CustomerDebtInfo,
  CustomerPointsInfo,
  ReturnRecord,
  Promotion,
  StockAdjustment,
  AuditLogPage,
  DashboardData,
  StaffSales,
  CategorySales,
  ProfitRow,
  PeriodComparison,
  PermissionDef,
  ProductVariant,
  PriceHistoryEntry,
  ComboComponent,
  CustomerWithDebt,
  DebtOverview,
  BackupFile,
  BackupConfig,
  StockTransfer,
  InventoryReport
} from './types';

const TOKEN_KEY = 'gas_sales_token';

declare global {
  interface Window {
    __gasAuthRedirecting?: boolean;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  success = false;
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(action: string, payload: object = {}): Promise<T> {
  if (!action) throw new ApiError('Lỗi: thiếu tên action khi gọi API.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, action })
  });

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!body) throw new ApiError('Không thể kết nối tới máy chủ.');
  if (!body.success) {
    if (res.status === 401) {
      // Chặn redirect lặp lại khi nhiều request cùng lỗi 401 (đồng bộ trong 1 lần)
      setToken(null);
      if (!window.__gasAuthRedirecting && window.location.pathname !== '/login') {
        window.__gasAuthRedirecting = true;
        window.location.replace('/login');
      }
    }
    throw new ApiError(body.error || 'Đã có lỗi xảy ra.');
  }
  return body.data;
}

export const api = {
  checkSystemStatus: () => request<{ hasAdmin: boolean }>('checkSystemStatus'),
  login: (username: string, password: string) =>
    request<User>('loginUser', { username, password }),
  register: (userData: object) =>
    request<{ id: string }>('registerUser', { userData }),

  getUsers: () => request<User[]>('getUsers'),
  listUsers: (p: { page: number; pageSize: number; search?: string }) =>
    request<Paginated<User>>('listUsers', p),
  approveUser: (userId: string, approve: boolean) =>
    request<string>('approveUser', { userId, approve }),
  updateUser: (userData: object) =>
    request<string>('updateUser', { userData }),
  deleteUser: (userId: string) => request<string>('deleteUser', { userId }),
  resetPassword: (userId: string, newPassword: string) =>
    request<string>('resetPassword', { userId, newPassword }),

  // Phân quyền chi tiết
  getPermissionsList: () => request<PermissionDef[]>('getPermissionsList'),
  getUserPermissions: (userId: string) => request<string[]>('getUserPermissions', { userId }),
  saveUserPermissions: (userId: string, permissions: string[]) =>
    request<string>('saveUserPermissions', { userId, permissions }),

  getProducts: () => request<Product[]>('getProducts'),
  listProducts: (p: { page: number; pageSize: number; search?: string; stock?: string; category?: string }) =>
    request<Paginated<Product>>('listProducts', p),
  addProduct: (productData: object) =>
    request<{ id: string }>('addProduct', { productData }),
  updateProduct: (productData: object) =>
    request<string>('updateProduct', { productData }),
  deleteProduct: (productId: string) => request<string>('deleteProduct', { productId }),

  // Danh mục sản phẩm
  listCategories: () => request<{ items: Category[] }>('listCategories'),
  addCategory: (categoryData: object) =>
    request<{ id: string }>('addCategory', { categoryData }),
  updateCategory: (categoryData: object) =>
    request<string>('updateCategory', { categoryData }),
  deleteCategory: (categoryId: string) =>
    request<string>('deleteCategory', { categoryId }),

  // Nhận diện thực đơn từ ảnh (Gemini)
  recognizeMenuItems: (base64: string, mimeType: string) =>
    request<{ items: MenuItem[] }>('recognizeMenuItems', { base64, mimeType }),

  // Biến thể sản phẩm
  getProductVariants: (productId: string) =>
    request<ProductVariant[]>('getProductVariants', { productId }),
  addVariant: (variantData: object) =>
    request<{ id: string }>('addVariant', { variantData }),
  updateVariant: (variantData: object) => request<string>('updateVariant', { variantData }),
  deleteVariant: (variantId: string) => request<string>('deleteVariant', { variantId }),

  // Combo sản phẩm
  getProductCombos: (productId: string) =>
    request<ComboComponent[]>('getProductCombos', { productId }),

  // Lịch sử giá
  getProductPriceHistory: (productId: string) =>
    request<PriceHistoryEntry[]>('getProductPriceHistory', { productId }),

  getSuppliers: () => request<Supplier[]>('getSuppliers'),
  listSuppliers: (p: { page: number; pageSize: number; search?: string }) =>
    request<Paginated<Supplier>>('listSuppliers', p),
  addSupplier: (supplierData: object) =>
    request<{ id: string }>('addSupplier', { supplierData }),
  updateSupplier: (supplierData: object) =>
    request<string>('updateSupplier', { supplierData }),
  deleteSupplier: (supplierId: string) => request<string>('deleteSupplier', { supplierId }),
  getSupplierTransactions: (supplierId: string) =>
    request<SupplierTransaction[]>('getSupplierTransactions', { supplierId }),
  createSupplierPayment: (paymentData: object) =>
    request<{ id: string }>('createSupplierPayment', { paymentData }),

  getCustomers: () => request<Customer[]>('getCustomers'),
  listCustomers: (p: { page: number; pageSize: number; search?: string; source?: string }) =>
    request<Paginated<Customer>>('listCustomers', p),
  addCustomer: (customerData: object) =>
    request<{ id: string }>('addCustomer', { customerData }),
  updateCustomer: (customerData: object) =>
    request<string>('updateCustomer', { customerData }),
  deleteCustomer: (customerId: string) => request<string>('deleteCustomer', { customerId }),

  getOrders: () => request<Order[]>('getOrders'),
  listOrders: (p: { page: number; pageSize: number; search?: string; status?: string; paymentStatus?: string; orderType?: string; preorder?: string }) =>
    request<Paginated<Order>>('listOrders', p),
  getCustomerUnpaidOrders: (customerId: string) =>
    request<Order[]>('getCustomerUnpaidOrders', { customerId }),
  createOrder: (orderData: object) =>
    request<{ orderId: string; createdAt: string }>('createOrder', { orderData }),
  updateOrder: (orderData: object) => request<string>('updateOrder', { orderData }),
  updateOrderStatus: (orderId: string, status: string, paymentStatus?: string) =>
    request<string>('updateOrderStatus', { orderId, status, paymentStatus }),
  deleteOrder: (orderId: string) => request<string>('deleteOrder', { orderId }),

  getImports: () => request<ImportRecord[]>('getImports'),
  listImports: (p: { page: number; pageSize: number; search?: string; supplierId?: string; paymentStatus?: string; fromDate?: string; toDate?: string }) =>
    request<Paginated<ImportRecord>>('listImports', p),
  createImport: (importData: object) =>
    request<{ id: string }>('createImport', { importData }),
  updateImport: (importData: object) => request<string>('updateImport', { importData }),
  deleteImport: (importId: string) => request<string>('deleteImport', { importId }),

  getStores: () => request<Store[]>('getStores'),
  addStore: (storeData: object) => request<{ id: string }>('addStore', { storeData }),
  updateStore: (storeData: object) => request<string>('updateStore', { storeData }),
  deleteStore: (storeId: string) => request<string>('deleteStore', { storeId }),

  getStoreInfo: () => request<StoreInfo>('getStoreInfo'),
  saveStoreInfo: (storeInfo: Record<string, string>) =>
    request<string>('saveStoreInfo', { storeInfo }),

  getFinancialReport: (startDate: string, endDate: string) =>
    request<FinancialReport>('getFinancialReport', { startDate, endDate }),
  getSalesStats: (startDate: string, endDate: string) =>
    request<SalesStats>('getSalesStats', { startDate, endDate }),
  getAlerts: () => request<Alerts>('getAlerts'),

  getCashFund: () => request<CashFund>('getCashFund'),
  recordCashAdjust: (type: 'receive' | 'spend', amount: number, note: string) =>
    request<string>('recordCashAdjust', { type, amount, note }),
  listExpenses: (p: { page: number; pageSize: number; search?: string }) =>
    request<Paginated<Expense>>('listExpenses', p),
  addExpense: (expenseData: object) => request<{ id: string }>('addExpense', { expenseData }),
  updateExpense: (expenseData: object) => request<string>('updateExpense', { expenseData }),
  deleteExpense: (expenseId: string) => request<string>('deleteExpense', { expenseId }),

  uploadImage: (base64: string, mimeType: string, fileName: string) =>
    request<string>('uploadImage', { base64, mimeType, fileName }),

  getImportConfig: () => request<ImportConfig>('getImportConfig'),
  saveImportConfig: (config: object) => request<string>('saveImportConfig', config),
  checkImportData: () => request<ImportCheckReport>('checkImportData'),
  runImport: (opts: object) => request<ImportResult>('runImport', opts),

  // Công nợ khách hàng
  getCustomerDebts: (customerId?: string) =>
    request<CustomerDebtInfo | CustomerWithDebt[]>('getCustomerDebts', customerId ? { customerId } : {}),
  createDebtPayment: (paymentData: object) =>
    request<{ balance: number }>('createDebtPayment', paymentData),
  getDebtOverview: () => request<DebtOverview>('getDebtOverview'),

  // Sổ điểm khách hàng
  getCustomerPointsLedger: (customerId: string) =>
    request<CustomerPointsInfo>('getCustomerPointsLedger', { customerId }),

  // Trả hàng / hoàn tiền
  getReturns: () => request<ReturnRecord[]>('getReturns'),
  createReturn: (returnData: object) =>
    request<{ returnId: string; subtotal: number; refundAmount: number }>('createReturn', { returnData }),

  // Khuyến mãi
  getPromotions: () => request<Promotion[]>('getPromotions'),
  addPromotion: (promotionData: object) =>
    request<{ id: string }>('addPromotion', { promotionData }),
  updatePromotion: (promotionData: object) =>
    request<string>('updatePromotion', { promotionData }),
  deletePromotion: (promotionId: string) => request<string>('deletePromotion', { promotionId }),

  // Kiểm kê / điều chỉnh kho
  getStockAdjustments: () => request<StockAdjustment[]>('getStockAdjustments'),
  createStockAdjustment: (adjustmentData: object) =>
    request<{ oldStock: number; newStock: number; changeQty: number }>('createStockAdjustment', { adjustmentData }),

  // Nhật ký hoạt động
  getAuditLogs: (p: { page: number; pageSize: number; action?: string; userId?: string }) =>
    request<AuditLogPage>('getAuditLogs', p),

  // Dashboard & báo cáo nâng cao
  getDashboard: () => request<DashboardData>('getDashboard'),
  getSalesByStaff: (from: string, to: string) =>
    request<StaffSales[]>('getSalesByStaff', { from, to }),
  getSalesByCategory: (from: string, to: string) =>
    request<CategorySales[]>('getSalesByCategory', { from, to }),
  getProfitReport: (from: string, to: string, groupBy: string) =>
    request<ProfitRow[]>('getProfitReport', { from, to, groupBy }),
  getPeriodComparison: (from: string, to: string) =>
    request<PeriodComparison>('getPeriodComparison', { from, to }),

  // Báo cáo tồn kho
  getInventoryReport: () => request<InventoryReport>('getInventoryReport'),

  // Sao lưu & khôi phục
  backupDatabase: () => request<BackupFile>('backupDatabase'),
  listBackups: () => request<BackupFile[]>('listBackups'),
  deleteBackup: (fileName: string) => request<string>('deleteBackup', { fileName }),
  restoreDatabase: (fileName: string) => request<string>('restoreDatabase', { fileName }),
  getBackupConfig: () => request<BackupConfig>('getBackupConfig'),

  // Chuyển kho giữa chi nhánh
  getStockTransfers: () => request<StockTransfer[]>('getStockTransfers'),
  createStockTransfer: (transferData: object) =>
    request<{ id: string }>('createStockTransfer', { transferData })
};