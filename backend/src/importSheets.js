import fs from 'fs';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';

// ============================================================
// Cấu hình cột: tên cột Google Sheet -> tên cột MySQL
// (dùng chung cho CLI scripts/import-from-sheets.mjs và action runImport)
// ============================================================
export const TABLES = [
  {
    sheet: 'Stores', table: 'stores', pk: 'ID',
    columns: { ID: 'id', Name: 'name', Address: 'address', Phone: 'phone', ManagerId: 'manager_id', IsActive: 'is_active' },
    types: { IsActive: 'bool' },
    countFilter: "id <> 'ST-DEFAULT'"
  },
  {
    sheet: 'Suppliers', table: 'suppliers', pk: 'ID',
    columns: { ID: 'id', Name: 'name', Phone: 'phone', Email: 'email', Address: 'address', TaxCode: 'tax_code', BankInfo: 'bank_info', Note: 'note' }
  },
  {
    sheet: 'Customers', table: 'customers', pk: 'ID',
    columns: { ID: 'id', Name: 'name', Phone: 'phone', Address: 'address', TotalSpent: 'total_spent', LastPurchaseDate: 'last_purchase_date', Notes: 'notes' },
    types: { TotalSpent: 'number0', LastPurchaseDate: 'datetime' }
  },
  {
    sheet: 'Users', table: 'users', pk: 'ID',
    columns: { ID: 'id', Username: 'username', Password: 'password', FullName: 'full_name', Role: 'role', StoreId: 'store_id', Active: 'active', CreatedAt: 'created_at', Approve: 'approve' },
    types: { Active: 'bool', Approve: 'bool', Password: 'password', CreatedAt: 'datetime' },
    notNull: { created_at: 'CURRENT' }
  },
  {
    sheet: 'Products', table: 'products', pk: 'ID',
    columns: { ID: 'id', SKU: 'sku', Name: 'name', Image: 'image', Category: 'category', SupplierId: 'supplier_id', ImportPrice: 'import_price', RetailPrice: 'retail_price', WholesalePrice: 'wholesale_price', Stock: 'stock', Unit: 'unit', PricingTiersJSON: 'pricing_tiers_json' },
    types: { ImportPrice: 'number0', RetailPrice: 'number0', Stock: 'number0', PricingTiersJSON: 'json' }
  },
  {
    sheet: 'Imports', table: 'imports', pk: 'ID',
    columns: { ID: 'id', SupplierID: 'supplier_id', SupplierName: 'supplier_name', TotalAmount: 'total_amount', CreatedBy: 'created_by', CreatedAt: 'created_at', ShippingFee: 'shipping_fee', Carrier: 'carrier', PaymentStatus: 'payment_status', PaidAmount: 'paid_amount', RemainingAmount: 'remaining_amount', StoreId: 'store_id' },
    types: { TotalAmount: 'number0', CreatedAt: 'datetime', ShippingFee: 'number0', PaidAmount: 'number0', RemainingAmount: 'number0' },
    notNull: { created_at: 'CURRENT' }
  },
  {
    sheet: 'ImportDetails', table: 'import_details', pk: null, parentKey: 'import_id',
    columns: { ImportID: 'import_id', ProductID: 'product_id', SKU: 'sku', ProductName: 'product_name', Quantity: 'quantity', ImportPrice: 'import_price', Subtotal: 'subtotal' },
    types: { Quantity: 'number0', ImportPrice: 'number0', Subtotal: 'number0' }
  },
  {
    sheet: 'Orders', table: 'orders', pk: 'ID',
    columns: { ID: 'id', CustomerID: 'customer_id', CustomerName: 'customer_name', Phone: 'phone', Address: 'address', OrderType: 'order_type', Subtotal: 'subtotal', Discount: 'discount', ShippingFee: 'shipping_fee', Surcharge: 'surcharge', TotalAmount: 'total_amount', PaymentMethod: 'payment_method', Status: 'status', PaymentStatus: 'payment_status', ShippingMethod: 'shipping_method', Carrier: 'carrier', DropshipSupplierId: 'dropship_supplier_id', CreatedBy: 'created_by', CreatedAt: 'created_at', StoreId: 'store_id', Note: 'note', DeliveryDate: 'delivery_date' },
    types: { Subtotal: 'number0', Discount: 'number0', ShippingFee: 'number0', Surcharge: 'number0', TotalAmount: 'number0', CreatedAt: 'datetime', DeliveryDate: 'datetime' },
    notNull: { created_at: 'CURRENT' }
  },
  {
    sheet: 'OrderDetails', table: 'order_details', pk: null, parentKey: 'order_id',
    columns: { OrderID: 'order_id', ProductID: 'product_id', SKU: 'sku', ProductName: 'product_name', Quantity: 'quantity', Price: 'price', Subtotal: 'subtotal', CostPrice: 'cost_price' },
    types: { Quantity: 'number0', Price: 'number0', Subtotal: 'number0', CostPrice: 'number0' }
  },
  {
    sheet: 'SupplierTransactions', table: 'supplier_transactions', pk: 'ID',
    columns: { ID: 'id', SupplierID: 'supplier_id', Type: 'type', Amount: 'amount', Note: 'note', CreatedBy: 'created_by', CreatedAt: 'created_at' },
    types: { Amount: 'number0', CreatedAt: 'datetime' },
    notNull: { created_at: 'CURRENT' }
  },
  {
    sheet: 'StoreInfo', table: 'store_info', pk: 'Key',
    columns: { Key: 'k', Value: 'v' },
    countFilter: "k NOT LIKE 'import_%'"
  }
];

// ============================================================
// Hàm chuyển đổi giá trị
// ============================================================
function pad(n) { return String(n).padStart(2, '0'); }

function toSqlDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseDate(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : toSqlDate(v);
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : toSqlDate(d);
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}([T ]\d{1,2}:\d{1,2}(:\d{1,2})?)?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return toSqlDate(d);
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])} 00:00:00`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toSqlDate(d);
}

function toBool(v) {
  return v === true || v === 1 || ['TRUE', 'true', '1', 'Yes', 'yes'].includes(String(v).trim());
}

function toNumber(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function toNumber0(v) {
  const n = toNumber(v);
  return n === null ? 0 : n;
}

function toString(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toJson(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v).trim();
  try { JSON.parse(s); return s; } catch { return '[]'; }
}

async function toPassword(v) {
  const s = toString(v);
  if (!s) return null;
  if (s.startsWith('$2')) return s;
  return bcrypt.hash(s, 10);
}

async function transformValue(type, v) {
  switch (type) {
    case 'bool': return toBool(v) ? 1 : 0;
    case 'number': return toNumber(v);
    case 'number0': return toNumber0(v);
    case 'datetime': return parseDate(v);
    case 'json': return toJson(v);
    case 'password': return toPassword(v);
    default: return toString(v);
  }
}

// ============================================================
// Nguồn dữ liệu: Google Sheets (Service Account / API Key) hoặc
// sheet công khai (tải XLSX trực tiếp, KHÔNG cần Google Cloud)
// ============================================================
export function makeSheetsClient({ credsPath, apiKey }) {
  if (credsPath && fs.existsSync(credsPath)) {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    return { client: google.sheets({ version: 'v4', auth }), authName: 'Service Account' };
  }
  if (apiKey) {
    return { client: google.sheets({ version: 'v4', auth: apiKey }), authName: 'API Key' };
  }
  throw new Error('Thiếu thông tin xác thực Google (GOOGLE_CREDENTIALS_JSON hoặc GOOGLE_API_KEY).');
}

function rowsFromWorksheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  return rows.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      if (k !== undefined && k !== null && String(k).trim() !== '') out[k] = v;
    }
    return out;
  });
}

export function makePublicSource({ spreadsheetId }) {
  let workbook = null;
  let loadError = null;

  async function ensureWorkbook() {
    if (workbook) return workbook;
    if (loadError) throw loadError;
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?format=xlsx`;
    let res;
    try {
      res = await fetch(url, { redirect: 'follow' });
    } catch (err) {
      loadError = new Error('Không kết nối được Google (kiểm tra internet).');
      throw loadError;
    }
    if (!res.ok) {
      loadError = new Error(
        `Không tải được Google Sheets (HTTP ${res.status}). Hãy chắc chắn sheet đã chia sẻ: nút "Chia sẻ" → "Bất kỳ ai có liên kết" → "Người xem".`
      );
      throw loadError;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const head = buf.slice(0, 512).toString('utf8').trimStart();
    const ctype = res.headers.get('content-type') || '';
    if (buf.length === 0 || head.startsWith('<!DOCTYPE') || head.startsWith('<html') || ctype.includes('text/html')) {
      loadError = new Error(
        'Không tìm thấy Google Sheet hoặc sheet chưa được chia sẻ công khai. Kiểm tra lại Spreadsheet ID và bật "Bất kỳ ai có liên kết → Người xem".'
      );
      throw loadError;
    }
    let wb;
    try {
      wb = XLSX.read(buf, { type: 'buffer' });
    } catch {
      loadError = new Error('Nội dung tải về không phải file bảng tính hợp lệ.');
      throw loadError;
    }
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      loadError = new Error('Workbook không có tab nào.');
      throw loadError;
    }
    workbook = wb;
    return workbook;
  }

  return {
    authName: 'Sheet công khai (tải trực tiếp)',
    load: async () => {
      await ensureWorkbook();
    },
    readSheet: async (name) => {
      const wb = await ensureWorkbook();
      const names = wb.SheetNames.map((n) => String(n).toLowerCase());
      const idx = names.indexOf(String(name).toLowerCase());
      if (idx === -1) throw new Error(`Sheet không tồn tại: ${name}`);
      return rowsFromWorksheet(wb.Sheets[wb.SheetNames[idx]]);
    }
  };
}

export function makeSource({ spreadsheetId, mode, credsPath, apiKey }) {
  if (!spreadsheetId) throw new Error('Thiếu Spreadsheet ID.');
  if (mode === 'public') return makePublicSource({ spreadsheetId });
  return makeSheetsClient({
    credsPath: mode === 'service' ? credsPath : null,
    apiKey: mode === 'apikey' ? apiKey : null
  });
}

export async function readSheet(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
  const values = res.data.values;
  if (!values || values.length === 0) return [];
  const headers = values[0];
  return values
    .slice(1)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    })
    .filter((r) => Object.values(r).some((v) => v !== undefined && v !== null && String(v).trim() !== ''));
}

// ============================================================
// Import 1 bảng
// ============================================================
async function importTable(db, source, conf, dryRun) {
  let rows;
  try {
    rows = await source.readSheet(conf.sheet);
  } catch (err) {
    return { sheet: conf.sheet, rows: 0, skipped: 0, missingIds: 0, error: err.message };
  }
  if (rows.length === 0) return { sheet: conf.sheet, rows: 0, skipped: 0, missingIds: 0 };

  const dbColumns = Object.values(conf.columns);
  const pkDb = conf.pk ? conf.columns[conf.pk] : null;
  let imported = 0;
  let missingIds = 0;

  // Bảng chi tiết (không có ID gốc): xóa dòng cũ của các phiếu cha rồi chèn lại
  // để chạy lại nhiều lần không bị trùng (upsert thường không nhận diện được).
  if (conf.parentKey && !dryRun) {
    const parentSheetCol = Object.keys(conf.columns).find((k) => conf.columns[k] === conf.parentKey);
    const parentIds = [...new Set(rows.map((r) => toString(r[parentSheetCol])).filter(Boolean))];
    if (parentIds.length > 0) {
      await db.query(`DELETE FROM \`${conf.table}\` WHERE \`${conf.parentKey}\` IN (?)`, [parentIds]);
    }
  }

  for (const row of rows) {
    const values = {};
    let hasKey = false;
    for (const [sheetCol, dbCol] of Object.entries(conf.columns)) {
      const type = conf.types?.[sheetCol] || 'string';
      let val = await transformValue(type, row[sheetCol]);
      if (val === null && conf.notNull?.[dbCol]) {
        val = conf.notNull[dbCol] === 'CURRENT' ? toSqlDate(new Date()) : conf.notNull[dbCol];
      }
      if (dbCol === pkDb && val !== null) hasKey = true;
      if (val !== null) values[dbCol] = val;
    }

    if (!hasKey && pkDb) {
      missingIds += 1;
      continue;
    }

    const cols = dbColumns.filter((c) => values[c] !== undefined);
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');

    if (!dryRun) {
      const sql = conf.parentKey
        ? `INSERT INTO \`${conf.table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${placeholders})`
        : `INSERT INTO \`${conf.table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${placeholders})
           ON DUPLICATE KEY UPDATE ${updates}`;
      await db.query(sql, cols.map((c) => values[c]));
    }
    imported += 1;
  }
  return { sheet: conf.sheet, rows: imported, skipped: 0, missingIds };
}

// ============================================================
// Import tất cả các bảng (theo thứ tự phụ thuộc khóa ngoại)
// ============================================================
export async function importAll({ db, source, only, dryRun }) {
  if (source.load) await source.load();
  const results = [];
  let total = 0;
  for (const conf of TABLES) {
    if (only && !only.some((o) => o.toLowerCase() === conf.sheet.toLowerCase())) continue;
    const r = await importTable(db, source, conf, dryRun);
    results.push(r);
    total += r.rows;
  }
  return { total, results };
}

// ============================================================
// Kiểm tra tính đầy đủ: so sánh sheet vs DB + kiểm tra tham chiếu
// ============================================================
export async function checkCompleteness({ db, source }) {
  if (source.load) await source.load();
  const tables = [];
  for (const conf of TABLES) {
    let sheetRows = 0;
    let sheetOk = false;
    try {
      const rows = await source.readSheet(conf.sheet);
      sheetRows = rows.length;
      sheetOk = true;
    } catch {
      sheetRows = -1; // sheet không tồn tại
    }
    const countSql = conf.countFilter
      ? `SELECT COUNT(*) AS cnt FROM \`${conf.table}\` WHERE ${conf.countFilter}`
      : `SELECT COUNT(*) AS cnt FROM \`${conf.table}\``;
    const [[{ cnt }]] = await db.query(countSql);
    tables.push({
      sheet: conf.sheet,
      table: conf.table,
      sheetRows,
      dbRows: Number(cnt),
      sheetFound: sheetOk,
      ok: sheetOk && Number(cnt) === sheetRows
    });
  }

  const integrity = [];
  const checks = [
    ['Chi tiết đơn không có đơn cha', 'SELECT COUNT(*) c FROM order_details d LEFT JOIN orders o ON d.order_id = o.id WHERE o.id IS NULL'],
    ['Chi tiết nhập không có phiếu cha', 'SELECT COUNT(*) c FROM import_details d LEFT JOIN imports i ON d.import_id = i.id WHERE i.id IS NULL'],
    ['Sản phẩm không có NCC (nếu có SupplierId)', 'SELECT COUNT(*) c FROM products p WHERE p.supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = p.supplier_id)'],
    ['Đơn không có khách hàng (nếu có CustomerID)', 'SELECT COUNT(*) c FROM orders o WHERE o.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id)'],
    ['Giao dịch NCC không có NCC', 'SELECT COUNT(*) c FROM supplier_transactions t WHERE t.supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = t.supplier_id)']
  ];
  for (const [label, sql] of checks) {
    const [[{ c }]] = await db.query(sql);
    integrity.push({ label, count: Number(c), ok: Number(c) === 0 });
  }

  return { tables, integrity };
}