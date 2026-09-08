import { pool, query } from '../db.js';
import { ApiError } from '../utils.js';
import { mapSupplierRow } from '../mappers.js';
import { logCash } from '../ledger.js';

export async function getSuppliers() {
  const rows = await query('SELECT * FROM suppliers ORDER BY name');
  return rows.map(mapSupplierRow);
}

export async function addSupplier(payload) {
  const s = payload.supplierData || {};
  if (!s.name) throw new ApiError(400, 'Thiếu tên nhà cung cấp.', 'BAD_REQUEST');
  const id = 'SUP' + Date.now();
  await query(
    `INSERT INTO suppliers (id, name, phone, email, address, tax_code, bank_info, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, s.name, s.phone || null, s.email || null, s.address || null, s.taxCode || null, s.bankInfo || null, s.note || null]
  );
  return { id };
}

export async function updateSupplier(payload) {
  const s = payload.supplierData || {};
  if (!s.id) throw new ApiError(400, 'Thiếu ID nhà cung cấp.', 'BAD_REQUEST');
  await query(
    `UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, tax_code = ?, bank_info = ?, note = ?
     WHERE id = ?`,
    [s.name, s.phone || null, s.email || null, s.address || null, s.taxCode || null, s.bankInfo || null, s.note || null, s.id]
  );
  return 'OK';
}

export async function deleteSupplier(payload) {
  await query('DELETE FROM suppliers WHERE id = ?', [payload.supplierId]);
  return 'OK';
}

export async function getSupplierTransactions(payload) {
  const rows = await query(
    'SELECT * FROM supplier_transactions WHERE supplier_id = ? ORDER BY created_at DESC',
    [payload.supplierId]
  );
  return rows.map((r) => ({
    id: r.id,
    supplierId: r.supplier_id,
    type: r.type,
    amount: Number(r.amount),
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at
  }));
}

export async function createSupplierPayment(payload) {
  const d = payload.paymentData || {};
  if (!d.supplierId) throw new ApiError(400, 'Thiếu ID nhà cung cấp.', 'BAD_REQUEST');
  const id = 'PAY' + Date.now();
  const amount = Number(d.amount) || 0;
  const allocations = Array.isArray(d.items) ? d.items : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Xử lý thanh toán theo từng phiếu nhập (nếu có chọn đơn nhập)
    if (allocations.length > 0) {
      let allocTotal = 0;
      for (const a of allocations) {
        const allocAmount = Number(a.amount) || 0;
        if (!a.importId || allocAmount <= 0) continue;
        allocTotal += allocAmount;
        const [rows] = await conn.query('SELECT * FROM imports WHERE id = ?', [a.importId]);
        const imp = rows[0];
        if (!imp) throw new ApiError(404, `Không tìm thấy phiếu nhập ${a.importId}.`, 'NOT_FOUND');
        const newPaid = Number(imp.paid_amount) + allocAmount;
        const newRemaining = Math.max(0, Number(imp.total_amount) - newPaid);
        const newStatus = newRemaining <= 0 ? 'paid' : 'partial';
        await conn.query(
          'UPDATE imports SET paid_amount = ?, remaining_amount = ?, payment_status = ? WHERE id = ?',
          [newPaid, newRemaining, newStatus, a.importId]
        );
      }
      if (allocTotal > amount) {
        throw new ApiError(
          400,
          `Tổng số tiền phân bổ (${allocTotal}) vượt quá số tiền thanh toán (${amount}).`,
          'BAD_REQUEST'
        );
      }
    }

    const impList = allocations.filter((a) => Number(a.amount) > 0 && a.importId).map((a) => a.importId);
    const noteParts = [d.note];
    if (impList.length > 0) {
      noteParts.push(`Trả cho phiếu: ${impList.join(', ')}`);
    }

    await conn.query(
      `INSERT INTO supplier_transactions (id, supplier_id, type, amount, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, d.supplierId, d.type || 'payment', amount, noteParts.filter(Boolean).join(' — ') || null, d.createdBy || payload.user?.id || null]
    );
    await logCash(conn, {
      type: 'spend',
      category: 'supplier',
      amount,
      refId: id,
      note: `Thanh toán NCC${d.note ? `: ${d.note}` : ''}${impList.length ? ` (${impList.join(', ')})` : ''}`,
      createdBy: payload.user?.id || null
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { id };
}