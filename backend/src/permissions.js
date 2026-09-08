// Danh sách quyền cho từng màn hình. Admin luôn có toàn quyền.
export const PERMISSIONS = [
  { key: 'pos', label: 'POS bán hàng' },
  { key: 'orders', label: 'Đơn hàng' },
  { key: 'products', label: 'Sản phẩm' },
  { key: 'imports', label: 'Nhập hàng' },
  { key: 'suppliers', label: 'Nhà cung cấp' },
  { key: 'customers', label: 'Khách hàng' },
  { key: 'debts', label: 'Công nợ' },
  { key: 'returns', label: 'Trả hàng' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'finance', label: 'Tài chính' },
  { key: 'cash', label: 'Quỹ tiền mặt' },
  { key: 'expenses', label: 'Phiếu chi' },
  { key: 'promotions', label: 'Khuyến mãi' },
  { key: 'stock', label: 'Kiểm kê & chuyển kho' },
  { key: 'stores', label: 'Cửa hàng' },
  { key: 'settings', label: 'Cài đặt' }
];

export function hasPermission(user, perm) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const perms = user.permissions;
  if (!Array.isArray(perms)) return false;
  return perms.includes(perm);
}

// Ánh xạ action -> quyền màn hình (để chặn gọi API khi nhân viên không có quyền)
export const ACTION_PERMISSION = {
  createOrder: 'pos',
  updateOrder: 'orders',
  updateOrderStatus: 'orders',
  deleteOrder: 'orders',
  getOrders: 'orders',
  listOrders: 'orders',
  addProduct: 'products',
  updateProduct: 'products',
  deleteProduct: 'products',
  addCategory: 'products',
  updateCategory: 'products',
  deleteCategory: 'products',
  recognizeMenuItems: 'products',
  createImport: 'imports',
  updateImport: 'imports',
  deleteImport: 'imports',
  createSupplierPayment: 'suppliers',
  addCustomer: 'customers',
  updateCustomer: 'customers',
  createReturn: 'returns',
  createStockAdjustment: 'stock',
  createStockTransfer: 'stock',
  addExpense: 'expenses',
  updateExpense: 'expenses',
  deleteExpense: 'expenses',
  recordCashAdjust: 'cash',
  addPromotion: 'promotions',
  updatePromotion: 'promotions',
  deletePromotion: 'promotions',
  addStore: 'stores',
  updateStore: 'stores',
  deleteStore: 'stores',
  saveStoreInfo: 'settings',
  saveImportConfig: 'settings',
  runImport: 'imports'
};