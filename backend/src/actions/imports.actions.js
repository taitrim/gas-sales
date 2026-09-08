import { pool, query } from '../db.js';
import { adjustStock, replaceImportDetails, importNeedsStock } from '../inventory.js';
import { ApiError, genId, nowLocal } from '../utils.js';
import { mapImportRow, mapImportDetailRow } from '../mappers.js';
import { logCash } from '../ledger.js';

function computeStatus(total, paid) {
  const rem = total - paid;
  return { paymentStatus: rem <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid', remainingAmount: rem };
}

export async function getImports() {
  // Giới hạn an toàn tránh memory exhaustion với dataset lớn
  const LIMIT = 1000;
  const [imports, details] = await Promise.all([
    query(`SELECT * FROM imports ORDER BY created_at DESC LIMIT ${LIMIT}`),
    query('SELECT * FROM import_details')
  ]);
  const importIds = new Set(imports.map((r) => r.id));
  const map = {};
  details.forEach((r) => {
    if (importIds.has(r.import_id)) {
      if (!map[r.import_id]) map[r.import_id] = [];
      map[r.import_id].push(mapImportDetailRow(r));
    }
  });
  return imports.map((r) => ({ ...mapImportRow(r), items: map[r.id] || [] }));
}

export async function createImport(payload) {
  const data = payload.importData || {};
  if (!data.items || data.items.length === 0) {
    throw new ApiError(400, 'Phiếu nhập phải có ít nhất 1 sản phẩm.', 'BAD_REQUEST');
  }
  const importId = data.id || genId('IMP');
  const now = nowLocal();

  let total = Number(data.shippingFee) || 0;
  for (const item of data.items) {
    total += (Number(item.quantity) || 0) * (Number(item.importPrice) || 0);
  }
  const paid = Number(data.paidAmount) || 0;
  const { paymentStatus, remainingAmount } = computeStatus(total, paid);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (importNeedsStock(data)) {
      for (const item of data.items) {
        await adjustStock(conn, item.productId, Number(item.quantity));
      }
    }
    await conn.query(
      `INSERT INTO imports (id, supplier_id, supplier_name, total_amount, created_by, created_at,
         shipping_fee, carrier, payment_status, paid_amount, remaining_amount, store_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        importId,
        data.supplierId || null,
        data.supplierName || '',
        total,
        data.createdBy || null,
        now,
        Number(data.shippingFee) || 0,
        data.carrier || null,
        paymentStatus,
        paid,
        remainingAmount,
        data.storeId || null
      ]
    );
    await replaceImportDetails(conn, importId, data.items);
    if (paid > 0) {
      await logCash(conn, {
        type: 'spend',
        category: 'import',
        amount: paid,
        refId: importId,
        note: `Trả NCC phiếu nhập ${importId}`,
        createdBy: data.createdBy || payload.user?.id || null
      });
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { id: importId };
}

export async function updateImport(payload) {
  const d = payload.importData || {};
  if (!d.id) throw new ApiError(400, 'Thiếu ID phiếu nhập.', 'BAD_REQUEST');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM imports WHERE id = ?', [d.id]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy phiếu nhập.', 'NOT_FOUND');

    const oldDetails = await conn.query(
      'SELECT product_id, quantity FROM import_details WHERE import_id = ?',
      [d.id]
    );
    for (const r of oldDetails[0]) {
      await adjustStock(conn, r.product_id, -Number(r.quantity));
    }

    let total = Number(d.shippingFee) || 0;
    for (const item of d.items || []) {
      total += (Number(item.quantity) || 0) * (Number(item.importPrice) || 0);
    }
    const paid = Number(d.paidAmount) || 0;
    const { paymentStatus, remainingAmount } = computeStatus(total, paid);

    await conn.query(
      `UPDATE imports SET supplier_id = ?, supplier_name = ?, total_amount = ?, shipping_fee = ?,
         carrier = ?, payment_status = ?, paid_amount = ?, remaining_amount = ?, store_id = ?
       WHERE id = ?`,
      [
        d.supplierId || null,
        d.supplierName || '',
        total,
        Number(d.shippingFee) || 0,
        d.carrier || null,
        paymentStatus,
        paid,
        remainingAmount,
        d.storeId || null,
        d.id
      ]
    );

    await replaceImportDetails(conn, d.id, d.items || []);

    const delta = paid - Number(old.paid_amount) || 0;
    if (delta !== 0) {
      await logCash(conn, {
        type: delta > 0 ? 'spend' : 'receive',
        category: 'import',
        amount: Math.abs(delta),
        refId: d.id,
        note: `Điều chỉnh trả NCC phiếu nhập ${d.id}`,
        createdBy: payload.user?.id || null
      });
    }

    if (importNeedsStock(d)) {
      for (const item of d.items || []) {
        await adjustStock(conn, item.productId, Number(item.quantity));
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return 'OK';
}

export async function deleteImport(payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM imports WHERE id = ?', [payload.importId]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy phiếu nhập.', 'NOT_FOUND');

    const details = await conn.query(
      'SELECT product_id, quantity FROM import_details WHERE import_id = ?',
      [old.id]
    );
    for (const r of details[0]) {
      await adjustStock(conn, r.product_id, -Number(r.quantity));
    }
    await conn.query('DELETE FROM import_details WHERE import_id = ?', [old.id]);
    await conn.query('DELETE FROM imports WHERE id = ?', [old.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return 'OK';
}