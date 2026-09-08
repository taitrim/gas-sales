import { pool } from './db.js';

// Điều chỉnh tồn kho trong cùng 1 transaction (conn) để đảm bảo nhất quán
export async function adjustStock(conn, productId, delta) {
  const n = Number(delta);
  if (!productId || n === 0) return;
  await conn.query(
    'UPDATE products SET stock = GREATEST(COALESCE(stock, 0) + ?, 0) WHERE id = ?',
    [n, productId]
  );
}

// Điều chỉnh tồn kho theo cửa hàng (store_stock). storeId null => kho tổng (products.stock)
export async function adjustStoreStock(conn, productId, storeId, delta) {
  const n = Number(delta);
  if (!productId || n === 0) return;
  if (!storeId) return adjustStock(conn, productId, delta);
  await conn.query(
    `INSERT INTO store_stock (product_id, store_id, stock) VALUES (?, ?, GREATEST(?, 0))
     ON DUPLICATE KEY UPDATE stock = GREATEST(stock + ?, 0)`,
    [productId, storeId, n, n]
  );
}

// Lấy tồn kho hiện tại theo cửa hàng (hoặc kho tổng)
export async function getStockAt(conn, productId, storeId) {
  if (!storeId) {
    const [rows] = await conn.query('SELECT stock FROM products WHERE id = ?', [productId]);
    return rows[0] ? Number(rows[0].stock) || 0 : 0;
  }
  const [rows] = await conn.query(
    'SELECT stock FROM store_stock WHERE product_id = ? AND store_id = ?',
    [productId, storeId]
  );
  if (rows[0]) return Number(rows[0].stock) || 0;
  const [main] = await conn.query('SELECT stock FROM products WHERE id = ?', [productId]);
  return main[0] ? Number(main[0].stock) || 0 : 0;
}

// Sản phẩm combo: bán combo => trừ kho các thành phần, không trừ combo
export async function adjustComboStock(conn, productId, delta) {
  const [rows] = await conn.query(
    'SELECT product_id, quantity FROM product_combos WHERE combo_id = ?',
    [productId]
  );
  if (rows.length === 0) return false;
  for (const r of rows) {
    await adjustStock(conn, r.product_id, Number(delta) * Number(r.quantity));
  }
  return true;
}

export async function adjustStockSingle(productId, delta) {
  const conn = await pool.getConnection();
  try {
    await adjustStock(conn, productId, delta);
  } finally {
    conn.release();
  }
}

// Thay thế toàn bộ detail của 1 đơn/phiếu (dùng cho update)
export async function replaceDetails(conn, table, parentKey, parentId, rows) {
  await conn.query(`DELETE FROM ${table} WHERE ${parentKey} = ?`, [parentId]);
  if (rows.length > 0) {
    const cols = Object.keys(rows[0]);
    const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
    const values = rows.flatMap((r) => cols.map((c) => r[c]));
    await conn.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`, values);
  }
}

export async function replaceOrderDetails(conn, orderId, items) {
  const rows = items.map((it) => ({
    order_id: orderId,
    product_id: it.productId ?? null,
    variant_id: it.variantId ?? null,
    sku: it.sku ?? null,
    product_name: it.productName ?? '',
    quantity: Number(it.quantity) || 0,
    price: Number(it.price) || 0,
    discount: Number(it.discount) || 0,
    subtotal: (Number(it.quantity) || 0) * (Number(it.price) || 0) - (Number(it.discount) || 0),
    cost_price: Number(it.costPrice) || 0
  }));
  await replaceDetails(conn, 'order_details', 'order_id', orderId, rows);
}

export async function replaceImportDetails(conn, importId, items) {
  const rows = items.map((it) => ({
    import_id: importId,
    product_id: it.productId ?? null,
    sku: it.sku ?? null,
    product_name: it.productName ?? '',
    quantity: Number(it.quantity) || 0,
    import_price: Number(it.importPrice) || 0,
    subtotal: (Number(it.quantity) || 0) * (Number(it.importPrice) || 0)
  }));
  await replaceDetails(conn, 'import_details', 'import_id', importId, rows);
}

export function orderNeedsStock(order) {
  return order?.status === 'completed' && order?.shippingMethod !== 'dropship';
}

// Điều chỉnh tồn kho biến thể (product_variants.stock)
export async function adjustVariantStock(conn, variantId, delta) {
  const n = Number(delta);
  if (!variantId || n === 0) return;
  await conn.query(
    'UPDATE product_variants SET stock = GREATEST(COALESCE(stock, 0) + ?, 0) WHERE id = ?',
    [n, variantId]
  );
}

// Trừ/hoàn tồn cho 1 đơn: combo trừ kho thành phần, biến thể trừ kho variant,
// còn lại trừ kho sản phẩm (theo store nếu có)
export async function adjustOrderStock(conn, items, storeId, delta) {
  for (const item of items) {
    if (!item.productId || !Number(item.quantity)) continue;
    // Bán theo biến thể: chỉ trừ/hoàn tồn variant, không đụng kho sản phẩm gốc
    if (item.variantId) {
      await adjustVariantStock(conn, item.variantId, Number(delta) * Number(item.quantity));
      continue;
    }
    const comboApplied = await adjustComboStock(conn, item.productId, delta);
    if (!comboApplied) {
      await adjustStoreStock(conn, item.productId, storeId || null, Number(delta) * Number(item.quantity));
    }
  }
}

export function importNeedsStock(importData) {
  return importData?.skipStockUpdate !== true;
}