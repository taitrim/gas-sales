import { query } from '../db.js';
import { parsePage, buildSearch } from '../paginate.js';
import { ApiError } from '../utils.js';
import {
  mapCustomerRow,
  mapImportDetailRow,
  mapImportRow,
  mapOrderDetailRow,
  mapOrderRow,
  mapProductRow,
  mapSupplierRow,
  mapUserRow
} from '../mappers.js';

async function countAndPage(table, conds, params, orderBy, pageInfo) {
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const [{ c }] = await query(`SELECT COUNT(*) c FROM ${table} ${where}`, params);
  const total = Number(c);
  const rows = await query(
    `SELECT * FROM ${table} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, pageInfo.pageSize, pageInfo.offset]
  );
  return { rows, total };
}

export async function listProducts(payload = {}) {
  const pageInfo = parsePage(payload);
  const s = buildSearch(['name', 'sku', 'category'], payload.search);
  const conds = s.sql ? [s.sql] : [];
  const params = s.sql ? [...s.params] : [];
  if (payload.stock === 'low') {
    conds.push('stock > 0 AND stock <= 5');
  } else if (payload.stock === 'out') {
    conds.push('stock <= 0');
  }
  if (payload.category) {
    conds.push('category = ?');
    params.push(payload.category);
  }
  const { rows, total } = await countAndPage('products', conds, params, 'name', pageInfo);
  return {
    items: rows.map(mapProductRow),
    total,
    page: pageInfo.page,
    pageSize: pageInfo.pageSize
  };
}

export async function listCustomers(payload = {}) {
  const pageInfo = parsePage(payload);
  const s = buildSearch(['c.name', 'c.phone', 'c.address'], payload.search);
  const conds = s.sql ? [s.sql] : [];
  if (payload.source) {
    conds.push('c.source = ?');
    s.params.push(payload.source);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const [{ c }] = await query(`SELECT COUNT(*) c FROM customers c ${where}`, s.params);
  const total = Number(c);
  const rows = await query(
    `SELECT c.*, COALESCE((
       SELECT SUM(o.total_amount) FROM orders o
       WHERE o.customer_id = c.id AND o.status = 'completed'
         AND o.payment_status IN ('unpaid','partial')
     ), 0) debt
     FROM customers c ${where}
     ORDER BY c.name LIMIT ? OFFSET ?`,
    [...s.params, pageInfo.pageSize, pageInfo.offset]
  );
  return {
    items: rows.map((r) => ({ ...mapCustomerRow(r), debt: Number(r.debt) || 0 })),
    total,
    page: pageInfo.page,
    pageSize: pageInfo.pageSize
  };
}

export async function listSuppliers(payload = {}) {
  const pageInfo = parsePage(payload);
  const s = buildSearch(['name', 'phone', 'tax_code'], payload.search);
  const conds = s.sql ? [s.sql] : [];
  const { rows, total } = await countAndPage('suppliers', conds, s.params, 'name', pageInfo);
  return {
    items: rows.map(mapSupplierRow),
    total,
    page: pageInfo.page,
    pageSize: pageInfo.pageSize
  };
}

export async function listUsers(payload = {}) {
  const pageInfo = parsePage(payload);
  const s = buildSearch(['username', 'full_name'], payload.search);
  const conds = s.sql ? [s.sql] : [];
  const { rows, total } = await countAndPage('users', conds, s.params, 'created_at DESC', pageInfo);
  return {
    items: rows.map(mapUserRow),
    total,
    page: pageInfo.page,
    pageSize: pageInfo.pageSize
  };
}

// Đơn còn nợ của 1 khách (for màn hình thu nợ) — bounded để không tải toàn bộ orders
const UNPAID_ORDER_LIMIT = 50;
export async function getCustomerUnpaidOrders(payload = {}) {
  const customerId = payload.customerId;
  if (!customerId) throw new ApiError(400, 'Thiếu customerId.', 'BAD_REQUEST');
  const rows = await query(
    `SELECT * FROM orders
     WHERE customer_id = ? AND payment_status = 'unpaid' AND status != 'cancelled'
     ORDER BY created_at DESC LIMIT ${UNPAID_ORDER_LIMIT}`,
    [customerId]
  );
  return rows.map(mapOrderRow);
}

export async function listOrders(payload = {}) {
  const pageInfo = parsePage(payload);
  const conds = [];
  const params = [];
  const s = buildSearch(['id', 'customer_name', 'phone'], payload.search);
  if (s.sql) {
    conds.push(s.sql);
    params.push(...s.params);
  }
  if (payload.status) {
    const statuses = String(payload.status).split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      conds.push('status = ?');
      params.push(statuses[0]);
    } else if (statuses.length > 1) {
      conds.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }
  if (payload.paymentStatus) {
    conds.push('payment_status = ?');
    params.push(payload.paymentStatus);
  }
  if (payload.orderType) {
    conds.push('order_type = ?');
    params.push(payload.orderType);
  }
  if (payload.preorder !== undefined && payload.preorder !== null && payload.preorder !== '') {
    conds.push('is_preorder = ?');
    params.push(payload.preorder ? 1 : 0);
  }
  const { rows, total } = await countAndPage('orders', conds, params, 'created_at DESC', pageInfo);

  let details = [];
  if (rows.length) {
    details = await query('SELECT * FROM order_details WHERE order_id IN (?)', [rows.map((r) => r.id)]);
  }
  const map = {};
  details.forEach((r) => {
    if (!map[r.order_id]) map[r.order_id] = [];
    map[r.order_id].push(mapOrderDetailRow(r));
  });
  const items = rows.map((r) => ({ ...mapOrderRow(r), items: map[r.id] || [] }));
  return { items, total, page: pageInfo.page, pageSize: pageInfo.pageSize };
}

export async function listImports(payload = {}) {
  const pageInfo = parsePage(payload);
  const s = buildSearch(['id', 'supplier_name'], payload.search);
  const conds = s.sql ? [s.sql] : [];
  const params = [...s.params];
  if (payload.supplierId) {
    conds.push('supplier_id = ?');
    params.push(payload.supplierId);
  }
  if (payload.paymentStatus) {
    conds.push('payment_status = ?');
    params.push(payload.paymentStatus);
  }
  if (payload.fromDate) {
    conds.push('created_at >= ?');
    params.push(payload.fromDate);
  }
  if (payload.toDate) {
    conds.push('created_at <= ?');
    params.push(payload.toDate);
  }
  const { rows, total } = await countAndPage('imports', conds, params, 'created_at DESC', pageInfo);

  let details = [];
  if (rows.length) {
    details = await query('SELECT * FROM import_details WHERE import_id IN (?)', [rows.map((r) => r.id)]);
  }
  const map = {};
  details.forEach((r) => {
    if (!map[r.import_id]) map[r.import_id] = [];
    map[r.import_id].push(mapImportDetailRow(r));
  });
  const items = rows.map((r) => ({ ...mapImportRow(r), items: map[r.id] || [] }));
  return { items, total, page: pageInfo.page, pageSize: pageInfo.pageSize };
}