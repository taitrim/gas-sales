import { pool, query } from '../db.js';
import { ApiError, genId, nowLocal, num, parseJSON, toBool } from '../utils.js';
import { mapProductRow } from '../mappers.js';

export async function getProducts() {
  const rows = await query('SELECT * FROM products ORDER BY name');
  const variants = await query('SELECT * FROM product_variants ORDER BY name');
  const combos = await query('SELECT * FROM product_combos ORDER BY id');
  const variantMap = {};
  variants.forEach((v) => {
    if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
    variantMap[v.product_id].push(mapVariantRow(v));
  });
  const comboMap = {};
  combos.forEach((c) => {
    if (!comboMap[c.combo_id]) comboMap[c.combo_id] = [];
    comboMap[c.combo_id].push({ productId: c.product_id, quantity: Number(c.quantity) });
  });
  return rows.map((r) => ({
    ...mapProductRow(r),
    variants: variantMap[r.id] || [],
    comboComponents: comboMap[r.id] || []
  }));
}

function mapVariantRow(v) {
  return {
    id: v.id,
    productId: v.product_id,
    name: v.name,
    sku: v.sku,
    price: Number(v.price),
    stock: Number(v.stock),
    isActive: toBool(v.is_active)
  };
}

// Ghi lịch sử thay đổi giá khi giá trị thay đổi
async function logPriceChange(conn, productId, field, oldValue, newValue, changedBy) {
  const oldV = num(oldValue);
  const newV = num(newValue);
  if (Math.abs(oldV - newV) < 0.0001) return;
  await conn.query(
    'INSERT INTO product_price_history (product_id, field, old_value, new_value, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [productId, field, oldV, newV, changedBy || null, nowLocal()]
  );
}

export async function getProductsSimple() {
  const rows = await query('SELECT * FROM products ORDER BY name');
  return rows.map(mapProductRow);
}

export async function addProduct(payload) {
  const p = payload.productData || {};
  if (!p.name) throw new ApiError(400, 'Thiếu tên sản phẩm.', 'BAD_REQUEST');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = 'PRD' + Date.now();
    await conn.query(
      `INSERT INTO products (id, sku, name, image, category, supplier_id, import_price, retail_price, wholesale_price, stock, unit, pricing_tiers_json, is_combo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        p.sku || null,
        p.name,
        p.image || '',
        p.category || null,
        p.supplierId || null,
        Number(p.importPrice) || 0,
        Number(p.retailPrice) || 0,
        Number(p.wholesalePrice) || 0,
        Number(p.stock) || 0,
        p.unit || null,
        JSON.stringify(p.pricingTiers || []),
        p.isCombo ? 1 : 0
      ]
    );
    // Ghi lịch sử giá ban đầu (nếu giá > 0)
    await logPriceChange(conn, id, 'import_price', 0, p.importPrice, payload.user?.id);
    await logPriceChange(conn, id, 'retail_price', 0, p.retailPrice, payload.user?.id);
    await logPriceChange(conn, id, 'wholesale_price', 0, p.wholesalePrice, payload.user?.id);
    if (p.isCombo && Array.isArray(p.comboComponents)) {
      for (const c of p.comboComponents) {
        if (!c.productId || num(c.quantity) <= 0) continue;
        await conn.query(
          'INSERT INTO product_combos (combo_id, product_id, quantity) VALUES (?, ?, ?)',
          [id, c.productId, num(c.quantity, 1)]
        );
      }
    }
    await conn.commit();
    return { id };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateProduct(payload) {
  const p = payload.productData || {};
  if (!p.id) throw new ApiError(400, 'Thiếu ID sản phẩm.', 'BAD_REQUEST');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM products WHERE id = ?', [p.id]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy sản phẩm.', 'NOT_FOUND');

    await conn.query(
      `UPDATE products SET sku = ?, name = ?, image = ?, category = ?, supplier_id = ?, import_price = ?, retail_price = ?, wholesale_price = ?, stock = ?, unit = ?, pricing_tiers_json = ?, is_combo = ?
       WHERE id = ?`,
      [
        p.sku || null,
        p.name,
        p.image || '',
        p.category || null,
        p.supplierId || null,
        Number(p.importPrice) || 0,
        Number(p.retailPrice) || 0,
        Number(p.wholesalePrice) || 0,
        Number(p.stock) || 0,
        p.unit || null,
        JSON.stringify(p.pricingTiers || []),
        p.isCombo ? 1 : 0,
        p.id
      ]
    );
    // Lịch sử giá
    await logPriceChange(conn, p.id, 'import_price', old.import_price, p.importPrice, payload.user?.id);
    await logPriceChange(conn, p.id, 'retail_price', old.retail_price, p.retailPrice, payload.user?.id);
    await logPriceChange(conn, p.id, 'wholesale_price', old.wholesale_price, p.wholesalePrice, payload.user?.id);

    // Đồng bộ combo components
    if (Array.isArray(p.comboComponents)) {
      await conn.query('DELETE FROM product_combos WHERE combo_id = ?', [p.id]);
      for (const c of p.comboComponents) {
        if (!c.productId || num(c.quantity) <= 0) continue;
        await conn.query(
          'INSERT INTO product_combos (combo_id, product_id, quantity) VALUES (?, ?, ?)',
          [p.id, c.productId, num(c.quantity, 1)]
        );
      }
    }
    await conn.commit();
    return 'OK';
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteProduct(payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM product_combos WHERE combo_id = ? OR product_id = ?', [payload.productId, payload.productId]);
    await conn.query('DELETE FROM product_variants WHERE product_id = ?', [payload.productId]);
    await conn.query('DELETE FROM product_price_history WHERE product_id = ?', [payload.productId]);
    await conn.query('DELETE FROM store_stock WHERE product_id = ?', [payload.productId]);
    await conn.query('DELETE FROM products WHERE id = ?', [payload.productId]);
    await conn.commit();
    return 'OK';
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ============================================================
// Biến thể sản phẩm
// ============================================================
export async function getProductVariants(payload) {
  const rows = await query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY name', [payload.productId]);
  return rows.map(mapVariantRow);
}

export async function addVariant(payload) {
  const d = payload.variantData || {};
  if (!d.productId || !d.name) throw new ApiError(400, 'Thiếu productId hoặc tên biến thể.', 'BAD_REQUEST');
  const id = genId('VAR');
  await query(
    'INSERT INTO product_variants (id, product_id, name, sku, price, stock, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, d.productId, d.name, d.sku || null, num(d.price), num(d.stock), d.isActive === false ? 0 : 1, nowLocal()]
  );
  return { id };
}

export async function updateVariant(payload) {
  const d = payload.variantData || {};
  if (!d.id) throw new ApiError(400, 'Thiếu ID biến thể.', 'BAD_REQUEST');
  await query(
    'UPDATE product_variants SET name = ?, sku = ?, price = ?, stock = ?, is_active = ? WHERE id = ?',
    [d.name, d.sku || null, num(d.price), num(d.stock), d.isActive === false ? 0 : 1, d.id]
  );
  return 'OK';
}

export async function deleteVariant(payload) {
  await query('DELETE FROM product_variants WHERE id = ?', [payload.variantId]);
  return 'OK';
}

// ============================================================
// Lịch sử giá
// ============================================================
export async function getProductPriceHistory(payload) {
  const rows = await query(
    `SELECT h.id, h.field, h.old_value, h.new_value, h.created_at, u.full_name AS changed_by_name
       FROM product_price_history h
       LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.product_id = ?
      ORDER BY h.created_at DESC, h.id DESC`,
    [payload.productId]
  );
  return rows.map((r) => ({
    id: r.id,
    field: r.field,
    oldValue: Number(r.old_value),
    newValue: Number(r.new_value),
    changedBy: r.changed_by_name || r.changed_by || null,
    createdAt: r.created_at
  }));
}

// ============================================================
// Combo components (đọc)
// ============================================================
export async function getProductCombos(payload) {
  const rows = await query(
    `SELECT pc.product_id, pc.quantity, p.name, p.sku
       FROM product_combos pc
       LEFT JOIN products p ON p.id = pc.product_id
      WHERE pc.combo_id = ?`,
    [payload.productId]
  );
  return rows.map((r) => ({
    productId: r.product_id,
    quantity: Number(r.quantity),
    productName: r.name || '',
    sku: r.sku || null
  }));
}