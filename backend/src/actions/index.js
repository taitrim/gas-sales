import * as users from './users.actions.js';
import * as products from './products.actions.js';
import * as suppliers from './suppliers.actions.js';
import * as customers from './customers.actions.js';
import * as orders from './orders.actions.js';
import * as imports from './imports.actions.js';
import * as stores from './stores.actions.js';
import * as reports from './reports.actions.js';
import * as upload from './upload.actions.js';
import * as importTool from './import.actions.js';
import * as list from './list.actions.js';
import * as categories from './categories.actions.js';
import * as menu from './menu.actions.js';
import * as cash from './cash.actions.js';
import * as debt from './debt.actions.js';
import * as returns from './returns.actions.js';
import * as promotions from './promotions.actions.js';
import * as stock from './stock.actions.js';
import * as audit from './audit.actions.js';
import * as backup from './backup.actions.js';

// Registry giữ nguyên tên action của Google Apps Script để dễ port frontend cũ
export const PUBLIC_ACTIONS = ['checkSystemStatus', 'loginUser', 'registerUser', 'getStoreInfo'];

// Các action chỉ admin được dùng
export const ADMIN_ACTIONS = [
  'getImportConfig',
  'saveImportConfig',
  'runImport',
  'checkImportData',
  'addPromotion',
  'updatePromotion',
  'deletePromotion',
  'createStockAdjustment',
  'createStockTransfer',
  'getAuditLogs',
  'backupDatabase',
  'listBackups',
  'deleteBackup',
  'restoreDatabase',
  'getBackupConfig',
  'saveUserPermissions',
  'getUsers',
  'approveUser',
  'updateUser',
  'deleteUser',
  'resetPassword',
  'deleteOrder',
  'deleteImport',
  'deleteExpense',
  'deleteSupplier',
  'deleteCustomer',
  'deleteProduct',
  'saveStoreInfo',
  'addStore',
  'updateStore',
  'deleteStore'
];

export const registry = {
  // Auth / users
  checkSystemStatus: users.checkSystemStatus,
  loginUser: users.loginUser,
  registerUser: users.registerUser,
  getUsers: users.getUsers,
  approveUser: users.approveUser,
  updateUser: users.updateUser,
  deleteUser: users.deleteUser,
  resetPassword: users.resetPassword,

  // Products
  getProducts: products.getProducts,
  addProduct: products.addProduct,
  updateProduct: products.updateProduct,
  deleteProduct: products.deleteProduct,
  getProductVariants: products.getProductVariants,
  addVariant: products.addVariant,
  updateVariant: products.updateVariant,
  deleteVariant: products.deleteVariant,
  getProductPriceHistory: products.getProductPriceHistory,
  getProductCombos: products.getProductCombos,

  // Suppliers
  getSuppliers: suppliers.getSuppliers,
  addSupplier: suppliers.addSupplier,
  updateSupplier: suppliers.updateSupplier,
  deleteSupplier: suppliers.deleteSupplier,
  getSupplierTransactions: suppliers.getSupplierTransactions,
  createSupplierPayment: suppliers.createSupplierPayment,

  // Customers
  getCustomers: customers.getCustomers,
  addCustomer: customers.addCustomer,
  updateCustomer: customers.updateCustomer,
  deleteCustomer: customers.deleteCustomer,
  getCustomerPointsLedger: customers.getCustomerPointsLedger,

  // Orders
  getOrders: orders.getOrders,
  createOrder: orders.createOrder,
  updateOrder: orders.updateOrder,
  updateOrderStatus: orders.updateOrderStatus,
  deleteOrder: orders.deleteOrder,

  // Imports
  getImports: imports.getImports,
  createImport: imports.createImport,
  updateImport: imports.updateImport,
  deleteImport: imports.deleteImport,

  // Danh sách có phân trang + tìm kiếm
  listProducts: list.listProducts,
  listCustomers: list.listCustomers,
  listSuppliers: list.listSuppliers,
  listUsers: list.listUsers,
  listOrders: list.listOrders,
  listImports: list.listImports,
  getCustomerUnpaidOrders: list.getCustomerUnpaidOrders,

  // Phiếu chi & quỹ tiền mặt
  getCashFund: cash.getCashFund,
  recordCashAdjust: cash.recordCashAdjust,
  listExpenses: cash.listExpenses,
  addExpense: cash.addExpense,
  updateExpense: cash.updateExpense,
  deleteExpense: cash.deleteExpense,

  // Công nợ khách hàng
  getCustomerDebts: debt.getCustomerDebts,
  createDebtPayment: debt.createDebtPayment,
  getDebtOverview: debt.getDebtOverview,

  // Trả hàng / hoàn tiền
  getReturns: returns.getReturns,
  createReturn: returns.createReturn,

  // Khuyến mãi
  getPromotions: promotions.getPromotions,
  addPromotion: promotions.addPromotion,
  updatePromotion: promotions.updatePromotion,
  deletePromotion: promotions.deletePromotion,

  // Kiểm kê / điều chỉnh kho
  getStockAdjustments: stock.getStockAdjustments,
  createStockAdjustment: stock.createStockAdjustment,

  // Chuyển kho giữa chi nhánh
  getStockTransfers: stock.getStockTransfers,
  createStockTransfer: stock.createStockTransfer,

  // Nhật ký hoạt động
  getAuditLogs: audit.getAuditLogs,

  // Sao lưu & khôi phục dữ liệu
  backupDatabase: backup.backupDatabase,
  listBackups: backup.listBackups,
  deleteBackup: backup.deleteBackup,
  restoreDatabase: backup.restoreDatabase,
  getBackupConfig: backup.getBackupConfig,

  // Users & quyền
  getPermissionsList: users.getPermissionsList,
  getUserPermissions: users.getUserPermissions,
  saveUserPermissions: users.saveUserPermissions,

  // Stores & store info
  getStores: stores.getStores,
  addStore: stores.addStore,
  updateStore: stores.updateStore,
  deleteStore: stores.deleteStore,
  getStoreInfo: stores.getStoreInfo,
  saveStoreInfo: stores.saveStoreInfo,

  // Reports
  getFinancialReport: reports.getFinancialReport,
  getSalesStats: reports.getSalesStats,
  getAlerts: reports.getAlerts,
  getSalesByStaff: reports.getSalesByStaff,
  getSalesByCategory: reports.getSalesByCategory,
  getProfitReport: reports.getProfitReport,
  getPeriodComparison: reports.getPeriodComparison,
  getDashboard: reports.getDashboard,
  getInventoryReport: reports.getInventoryReport,

  // Import dữ liệu từ Google Sheets (admin)
  getImportConfig: importTool.getImportConfig,
  saveImportConfig: importTool.saveImportConfig,
  runImport: importTool.runImport,
  checkImportData: importTool.checkImportData,

  // Upload
  uploadImage: upload.uploadImage,

  // Categories
  listCategories: categories.listCategories,
  addCategory: categories.addCategory,
  updateCategory: categories.updateCategory,
  deleteCategory: categories.deleteCategory,

  // Menu OCR (nhận diện thực đơn từ ảnh)
  recognizeMenuItems: menu.recognizeMenuItems
};