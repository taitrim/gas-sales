import { pool, query } from '../db.js';
import { parsePage, buildSearch } from '../paginate.js';
import { ApiError, nowLocal } from '../utils.js';
import { logCash } from '../ledger.js';

function mapExpenseRow(r) {
  return {
    id: r.id,
    category: r.category,
    amount: Number(r.amount),
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    storeId: r.store_id
  };
}

export async function getCashFund() {
  const [bal] = await query(
    "SELECT COALESCE(SUM(CASE WHEN type = 'receive' THEN amount ELSE -amount END), 0) s FROM cash_ledger"
  );
  const [received] = await query("SELECT COALESCE(SUM(amount), 0) s FROM cash_ledger WHERE type = 'receive'");
  const [spent] = await query("SELECT COALESCE(SUM(amount), 0) s FROM cash_ledger WHERE type = 'spend'");
  const transactions = await query('SELECT * FROM cash_ledger ORDER BY created_at DESC, id DESC LIMIT 300');
  return {
    balance: Number(bal.s) || 0,
    received: Number(received.s) || 0,
    spent: Number(spent.s) || 0,
    transactions: transactions.map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      amount: Number(r.amount),
      refId: r.ref_id,
      note: r.note,
      createdBy: r.created_by,
      createdAt: r.created_at
    }))
  };
}

export async function recordCashAdjust(payload) {
  const { type, amount, note } = payload;
  if (!['receive', 'spend'].includes(type)) {
    throw new ApiError(400, 'Loại giao dịch không hợp lệ.', 'BAD_REQUEST');
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new ApiError(400, 'Số tiền không hợp lệ.', 'BAD_REQUEST');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await logCash(conn, {
      type,
      category: 'manual',
      amount: amt,
      note: note || (type === 'receive' ? 'Nạp tiền vào quỹ' : 'Rút tiền khỏi quỹ'),
      createdBy: payload.user?.id || null
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return 'OK';
}

export async function listExpenses(payload = {}) {
  const pageInfo = parsePage(payload);
  const s = buildSearch(['category', 'note'], payload.search);
  const conds = s.sql ? [s.sql] : [];
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const [{ c }] = await query(`SELECT COUNT(*) c FROM expenses ${where}`, s.params);
  const total = Number(c);
  const rows = await query(
    `SELECT * FROM expenses ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...s.params, pageInfo.pageSize, pageInfo.offset]
  );
  return {
    items: rows.map(mapExpenseRow),
    total,
    page: pageInfo.page,
    pageSize: pageInfo.pageSize
  };
}

export async function addExpense(payload) {
  const d = payload.expenseData || {};
  const amt = Number(d.amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new ApiError(400, 'Số tiền không hợp lệ.', 'BAD_REQUEST');
  }
  const id = 'EXP' + Date.now();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO expenses (id, category, amount, note, created_by, created_at, store_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, d.category || 'Khác', amt, d.note || null, d.createdBy || payload.user?.id || null, nowLocal(), d.storeId || null]
    );
    await logCash(conn, {
      type: 'spend',
      category: 'expense',
      amount: amt,
      refId: id,
      note: `Chi ${d.category || 'Khác'}${d.note ? `: ${d.note}` : ''}`,
      createdBy: payload.user?.id || null
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { id };
}

export async function updateExpense(payload) {
  const d = payload.expenseData || {};
  if (!d.id) throw new ApiError(400, 'Thiếu ID phiếu chi.', 'BAD_REQUEST');
  const amt = Number(d.amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new ApiError(400, 'Số tiền không hợp lệ.', 'BAD_REQUEST');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM expenses WHERE id = ?', [d.id]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy phiếu chi.', 'NOT_FOUND');
    await conn.query('UPDATE expenses SET category = ?, amount = ?, note = ? WHERE id = ?', [
      d.category || 'Khác',
      amt,
      d.note || null,
      d.id
    ]);
    const delta = amt - Number(old.amount);
    if (delta !== 0) {
      await logCash(conn, {
        type: delta > 0 ? 'spend' : 'receive',
        category: 'expense',
        amount: Math.abs(delta),
        refId: d.id,
        note: `Điều chỉnh phiếu chi ${d.id}`,
        createdBy: payload.user?.id || null
      });
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return 'OK';
}

export async function deleteExpense(payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM expenses WHERE id = ?', [payload.expenseId]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy phiếu chi.', 'NOT_FOUND');
    await conn.query('DELETE FROM expenses WHERE id = ?', [payload.expenseId]);
    await logCash(conn, {
      type: 'receive',
      category: 'expense',
      amount: Number(old.amount),
      refId: old.id,
      note: `Hoàn lại phiếu chi ${old.id}`,
      createdBy: payload.user?.id || null
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return 'OK';
}