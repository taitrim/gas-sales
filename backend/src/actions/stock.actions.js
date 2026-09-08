import { pool, query } from '../db.js';
import { ApiError, genId, nowLocal, num } from '../utils.js';
import { getStockAt } from '../inventory.js';

export async function getStockAdjustments(payload) {
  const rows = await query('SELECT * FROM stock_adjustments ORDER BY created_at DESC, id DESC');
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    sku: r.sku,
    productName: r.product_name,
    oldStock: Number(r.old_stock),
    newStock: Number(r.new_stock),
    changeQty: Number(r.change_qty),
    reason: r.reason,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    storeId: r.store_id
  }));
}

export async function createStockAdjustment(payload) {
  const d = payload.adjustmentData || {};
  if (!d.productId) throw new ApiError(400, 'Thiếu ID sản phẩm.', 'BAD_REQUEST');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM products WHERE id = ?', [d.productId]);
    const product = rows[0];
    if (!product) throw new ApiError(404, 'Không tìm thấy sản phẩm.', 'NOT_FOUND');

    const oldStock = Number(product.stock) || 0;
    // Hỗ trợ 2 cách: newStock (tồn mới tuyệt đối) hoặc quantity (chênh lệch ±)
    const newStock =
      d.newStock !== undefined && d.newStock !== null && d.newStock !== ''
        ? Math.max(0, num(d.newStock, oldStock))
        : Math.max(0, oldStock + num(d.quantity, 0));
    const changeQty = newStock - oldStock;
    const reason = d.reason || d.note || 'Điều chỉnh kho';

    await conn.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, d.productId]);
    await conn.query(
      `INSERT INTO stock_adjustments (id, product_id, sku, product_name, old_stock, new_stock, change_qty, reason, note, created_by, created_at, store_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        genId('ADJ'),
        d.productId,
        product.sku || null,
        product.name,
        oldStock,
        newStock,
        changeQty,
        reason,
        d.note || null,
        payload.user?.id || null,
        nowLocal(),
        payload.user?.storeId || null
      ]
    );
    await conn.commit();
    return { oldStock, newStock, changeQty };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ============================================================
// Chuyển kho giữa các chi nhánh
// ============================================================
export async function getStockTransfers(payload) {
  const [transfers, details] = await Promise.all([
    query('SELECT * FROM stock_transfers ORDER BY created_at DESC, id DESC'),
    query('SELECT * FROM stock_transfer_details ORDER BY id')
  ]);
  const map = {};
  details.forEach((r) => {
    if (!map[r.transfer_id]) map[r.transfer_id] = [];
    map[r.transfer_id].push({ productId: r.product_id, quantity: Number(r.quantity) });
  });
  const storeIds = new Set();
  transfers.forEach((t) => {
    if (t.from_store_id) storeIds.add(t.from_store_id);
    if (t.to_store_id) storeIds.add(t.to_store_id);
  });
  let storeMap = {};
  if (storeIds.size > 0) {
    const rows = await query('SELECT id, name FROM stores WHERE id IN (?)', [[...storeIds]]);
    storeMap = Object.fromEntries(rows.map((r) => [r.id, r.name]));
  }
  return transfers.map((t) => ({
    id: t.id,
    fromStoreId: t.from_store_id,
    fromStoreName: t.from_store_id ? storeMap[t.from_store_id] || 'Cửa hàng đã xóa' : 'Kho tổng',
    toStoreId: t.to_store_id,
    toStoreName: t.to_store_id ? storeMap[t.to_store_id] || 'Cửa hàng đã xóa' : 'Kho tổng',
    note: t.note,
    createdBy: t.created_by,
    createdAt: t.created_at,
    items: map[t.id] || []
  }));
}

export async function createStockTransfer(payload) {
  const d = payload.transferData || {};
  if (!d.items || d.items.length === 0) throw new ApiError(400, 'Phiếu chuyển kho phải có ít nhất 1 sản phẩm.', 'BAD_REQUEST');
  if (d.fromStoreId === d.toStoreId) throw new ApiError(400, 'Kho nguồn và kho đích không được trùng.', 'BAD_REQUEST');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = genId('TRF');
    const items = d.items.filter((it) => it.productId && num(it.quantity) > 0);
    if (items.length === 0) throw new ApiError(400, 'Danh sách sản phẩm không hợp lệ.', 'BAD_REQUEST');

    // Kiểm tra tồn đủ ở kho nguồn
    for (const it of items) {
      const current = await getStockAt(conn, it.productId, d.fromStoreId || null);
      if (current < num(it.quantity)) {
        const [p] = await conn.query('SELECT name FROM products WHERE id = ?', [it.productId]);
        throw new ApiError(
          400,
          `Kho nguồn không đủ hàng "${p[0]?.name || it.productId}" (còn ${current}).`,
          'INSUFFICIENT_STOCK'
        );
      }
    }

    // Trừ kho nguồn, cộng kho đích
    for (const it of items) {
      const qty = num(it.quantity);
      await moveStock(conn, it.productId, d.fromStoreId || null, d.toStoreId || null, qty);
    }

    await conn.query(
      'INSERT INTO stock_transfers (id, from_store_id, to_store_id, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, d.fromStoreId || null, d.toStoreId || null, d.note || null, payload.user?.id || null, nowLocal()]
    );
    const values = items.map((it) => [id, it.productId, num(it.quantity)]);
    await conn.query('INSERT INTO stock_transfer_details (transfer_id, product_id, quantity) VALUES ?', [values]);

    await conn.commit();
    return { id };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Di chuyển tồn giữa 2 vị trí: nguồn trừ, đích cộng (cùng transaction)
async function moveStock(conn, productId, fromStoreId, toStoreId, qty) {
  if (fromStoreId) {
    await conn.query(
      'UPDATE store_stock SET stock = GREATEST(stock - ?, 0) WHERE product_id = ? AND store_id = ?',
      [qty, productId, fromStoreId]
    );
  } else {
    await conn.query('UPDATE products SET stock = GREATEST(COALESCE(stock,0) - ?, 0) WHERE id = ?', [qty, productId]);
  }
  if (toStoreId) {
    await conn.query(
      `INSERT INTO store_stock (product_id, store_id, stock) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stock = stock + ?`,
      [productId, toStoreId, qty, qty]
    );
  } else {
    await conn.query('UPDATE products SET stock = COALESCE(stock,0) + ? WHERE id = ?', [qty, productId]);
  }
}