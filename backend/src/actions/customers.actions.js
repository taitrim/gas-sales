import { query } from '../db.js';
import { ApiError, dateOrNull } from '../utils.js';
import { mapCustomerRow } from '../mappers.js';

export async function getCustomers() {
  const rows = await query('SELECT * FROM customers ORDER BY name');
  return rows.map(mapCustomerRow);
}

export async function addCustomer(payload) {
  const d = payload.customerData || {};
  if (!d.name) throw new ApiError(400, 'Thiếu tên khách hàng.', 'BAD_REQUEST');
  const id = 'CUS' + Date.now();
  await query(
    `INSERT INTO customers (id, name, phone, address, source, total_spent, last_purchase_date, notes, credit_limit, points, payment_terms_days)
     VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)`,
    [
      id,
      d.name,
      d.phone || null,
      d.address || '',
      d.source || null,
      d.notes || null,
      Number(d.creditLimit) || 0,
      Number(d.points) || 0,
      Number(d.paymentTermsDays) || 0
    ]
  );
  return { id };
}

export async function updateCustomer(payload) {
  const d = payload.customerData || {};
  if (!d.id) throw new ApiError(400, 'Thiếu ID khách hàng.', 'BAD_REQUEST');
  await query(
    `UPDATE customers SET name = ?, phone = ?, address = ?, source = ?, total_spent = ?, last_purchase_date = ?, notes = ?,
       credit_limit = ?, points = ?, payment_terms_days = ?
     WHERE id = ?`,
    [
      d.name,
      d.phone || null,
      d.address || '',
      d.source || null,
      Number(d.totalSpent) || 0,
      dateOrNull(d.lastPurchaseDate),
      d.notes || null,
      Number(d.creditLimit) || 0,
      Number(d.points) || 0,
      Number(d.paymentTermsDays) || 0,
      d.id
    ]
  );
  return 'OK';
}

export async function deleteCustomer(payload) {
  await query('DELETE FROM customers WHERE id = ?', [payload.customerId]);
  return 'OK';
}

// Sổ điểm của 1 khách hàng: số dư hiện tại + lịch sử biến động
export async function getCustomerPointsLedger(payload) {
  const [cust] = await query('SELECT * FROM customers WHERE id = ?', [payload.customerId]);
  if (!cust) throw new ApiError(404, 'Không tìm thấy khách hàng.', 'NOT_FOUND');
  const rows = await query(
    'SELECT * FROM customer_points_ledger WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 300',
    [payload.customerId]
  );
  return {
    customer: mapCustomerRow(cust),
    balance: Number(cust.points) || 0,
    ledger: rows.map((r) => ({
      id: r.id,
      type: r.type,
      refType: r.ref_type,
      refId: r.ref_id,
      points: Number(r.points),
      note: r.note,
      createdBy: r.created_by,
      createdAt: r.created_at
    }))
  };
}