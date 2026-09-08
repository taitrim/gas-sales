import { pool, query } from '../db.js';
import { ApiError, nowLocal, num } from '../utils.js';
import { mapCustomerRow } from '../mappers.js';
import { logCash } from '../ledger.js';

export async function recomputeCustomerDebt(conn, customerId) {
  const [rows] = await conn.query(
    'SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_debt_ledger WHERE customer_id = ?',
    [customerId]
  );
  const balance = Number(rows[0].balance) || 0;
  await conn.query('UPDATE customers SET total_debt = ? WHERE id = ?', [balance, customerId]);
  return balance;
}

export async function addDebtEntry(conn, { customerId, type, refType = null, refId = null, amount, note = null, createdBy = null }) {
  await conn.query(
    `INSERT INTO customer_debt_ledger (customer_id, type, ref_type, ref_id, amount, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customerId, type, refType, refId, Number(amount) || 0, note, createdBy, nowLocal()]
  );
  await recomputeCustomerDebt(conn, customerId);
}

// Danh sách khách còn nợ + chi tiết sổ nợ của 1 khách
export async function getCustomerDebts(payload) {
  if (payload.customerId) {
    const [cust] = await query('SELECT * FROM customers WHERE id = ?', [payload.customerId]);
    if (!cust) throw new ApiError(404, 'Không tìm thấy khách hàng.', 'NOT_FOUND');
    const rows = await query(
      'SELECT * FROM customer_debt_ledger WHERE customer_id = ? ORDER BY created_at DESC, id DESC',
      [payload.customerId]
    );
    return {
      customer: mapCustomerRow(cust),
      balance: Number(cust.total_debt) || 0,
      ledger: rows.map((r) => ({
        id: r.id,
        type: r.type,
        refType: r.ref_type,
        refId: r.ref_id,
        amount: Number(r.amount),
        note: r.note,
        createdBy: r.created_by,
        createdAt: r.created_at
      }))
    };
  }
  const rows = await query(
    `SELECT * FROM customers WHERE total_debt > 0 ORDER BY total_debt DESC`
  );
  const overdueMap = await getOverdueInfo();
  return rows.map((r) => ({
    ...mapCustomerRow(r),
    debt: Number(r.total_debt),
    overdue: overdueMap[r.id] || { days: 0, amount: 0 }
  }));
}

// Tính nợ quá hạn theo hạn thanh toán của từng khách (payment_terms_days)
export async function getOverdueInfo() {
  const rows = await query(
    `SELECT o.customer_id,
            SUM(CASE WHEN o.payment_status IN ('unpaid','partial') AND o.status <> 'cancelled'
                     AND o.created_at < DATE_SUB(NOW(), INTERVAL COALESCE(c.payment_terms_days, 0) DAY)
                     THEN o.total_amount ELSE 0 END) AS overdue_amount,
            MAX(CASE WHEN o.payment_status IN ('unpaid','partial') AND o.status <> 'cancelled'
                     AND o.created_at < DATE_SUB(NOW(), INTERVAL COALESCE(c.payment_terms_days, 0) DAY)
                     THEN DATEDIFF(NOW(), DATE_ADD(o.created_at, INTERVAL COALESCE(c.payment_terms_days, 0) DAY)) ELSE 0 END) AS max_days
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.customer_id IS NOT NULL AND o.customer_id <> ''
      GROUP BY o.customer_id`
  );
  const map = {};
  rows.forEach((r) => {
    map[r.customer_id] = { days: Number(r.max_days) || 0, amount: Number(r.overdue_amount) || 0 };
  });
  return map;
}

// Thống kê nợ quá hạn tổng hợp
export async function getDebtOverview() {
  const rows = await query(
    `SELECT
       SUM(CASE WHEN o.payment_status IN ('unpaid','partial') AND o.status <> 'cancelled' THEN o.total_amount ELSE 0 END) AS total_debt,
       SUM(CASE WHEN o.payment_status IN ('unpaid','partial') AND o.status <> 'cancelled'
                AND o.created_at < DATE_SUB(NOW(), INTERVAL COALESCE(c.payment_terms_days, 0) DAY)
                THEN o.total_amount ELSE 0 END) AS overdue_amount
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.customer_id IS NOT NULL AND o.customer_id <> ''`
  );
  const r = rows[0] || {};
  return { totalDebt: Number(r.total_debt) || 0, overdueAmount: Number(r.overdue_amount) || 0 };
}

// Thu nợ từ khách. Nếu truyền orderId thì khoản thu sẽ được gắn vào đơn nợ tương ứng.
export async function createDebtPayment(payload) {
  const { customerId, amount, note, orderId } = payload;
  if (!customerId) throw new ApiError(400, 'Thiếu ID khách hàng.', 'BAD_REQUEST');
  const pay = num(amount);
  if (pay <= 0) throw new ApiError(400, 'Số tiền thu không hợp lệ.', 'BAD_REQUEST');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cust] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!cust[0]) throw new ApiError(404, 'Không tìm thấy khách hàng.', 'NOT_FOUND');
    const currentDebt = Number(cust[0].total_debt) || 0;
    if (pay > currentDebt) throw new ApiError(400, 'Số tiền thu vượt quá công nợ hiện tại.', 'BAD_REQUEST');

    let refType = 'manual';
    let refId = null;
    if (orderId) {
      const [ord] = await conn.query('SELECT * FROM orders WHERE id = ? AND customer_id = ?', [orderId, customerId]);
      if (!ord[0]) throw new ApiError(400, 'Đơn hàng không thuộc khách hàng này.', 'BAD_REQUEST');
      if (ord[0].payment_status !== 'unpaid' || ord[0].status === 'cancelled') {
        throw new ApiError(400, 'Đơn hàng này không còn công nợ.', 'BAD_REQUEST');
      }
      const [payRows] = await conn.query(
        "SELECT COALESCE(SUM(ABS(amount)),0) s FROM customer_debt_ledger WHERE ref_id = ? AND type = 'payment'",
        [orderId]
      );
      const alreadyPaid = Number(payRows[0].s) || 0;
      const orderRemaining = Math.max(0, Number(ord[0].total_amount) - alreadyPaid);
      if (pay > orderRemaining) {
        throw new ApiError(400, `Đơn ${orderId} chỉ còn nợ ${orderRemaining.toLocaleString('vi-VN')}đ.`, 'BAD_REQUEST');
      }
      refType = 'order';
      refId = orderId;
    }

    await addDebtEntry(conn, {
      customerId,
      type: 'payment',
      refType,
      refId,
      amount: -pay,
      note: refId ? `Thu nợ đơn ${refId}` : (note || 'Thu nợ khách hàng'),
      createdBy: payload.user?.id || null
    });
    await logCash(conn, {
      type: 'receive',
      category: 'debt',
      amount: pay,
      refId: refId || customerId,
      note: `Thu nợ ${cust[0].name}: ${pay.toLocaleString('vi-VN')}đ` + (refId ? ` (đơn ${refId})` : ''),
      createdBy: payload.user?.id || null
    });
    await conn.commit();
    return { balance: currentDebt - pay };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}