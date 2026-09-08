import { query } from './db.js';
import { num } from './utils.js';

// Cấu hình điểm: số điểm nhận được cho mỗi 1.000đ thanh toán
export async function getPointsRate(conn) {
  const [rows] = await conn.query('SELECT v FROM store_info WHERE k = ?', ['pointsRate']);
  const rate = rows[0] ? Number(rows[0].v) : 1;
  return rate > 0 ? rate : 1;
}

// Giá trị quy đổi 1 điểm khi dùng làm chiết khấu (mặc định 1.000đ)
export async function getPointValue(conn) {
  const [rows] = await conn.query('SELECT v FROM store_info WHERE k = ?', ['pointValue']);
  const value = rows[0] ? Number(rows[0].v) : 1000;
  return value > 0 ? value : 1000;
}

// Số điểm khách nhận khi thanh toán amount
export async function computePointsEarned(conn, amount) {
  const rate = await getPointsRate(conn);
  return Math.floor((Number(amount) || 0) / 1000) * rate;
}

// Đảm bảo bảng sổ điểm tồn tại (DB cũ chưa có) — gọi lúc khởi động server
export async function ensurePointsLedgerTable() {
  await query(`CREATE TABLE IF NOT EXISTS customer_points_ledger (
    id          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id VARCHAR(40)   NOT NULL,
    type        VARCHAR(20)   NOT NULL,                       -- earn | redeem | refund | adjust
    ref_type    VARCHAR(30)   NULL,                           -- order | manual
    ref_id      VARCHAR(40)   NULL,
    points      INT           NOT NULL DEFAULT 0,
    note        TEXT          NULL,
    created_by  VARCHAR(40)   NULL,
    created_at  DATETIME      NOT NULL,
    KEY idx_points_customer (customer_id),
    KEY idx_points_ref (ref_id),
    CONSTRAINT fk_points_customer FOREIGN KEY (customer_id)
      REFERENCES customers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
}

// Cộng/trừ điểm khách hàng + ghi biến động vào sổ điểm
// meta: { type: 'earn'|'redeem'|'refund'|'adjust', refType, refId, note, createdBy }
export async function adjustCustomerPoints(conn, customerId, delta, meta = {}) {
  const n = Math.round(num(delta));
  if (!customerId || n === 0) return;
  await conn.query(
    'UPDATE customers SET points = GREATEST(COALESCE(points, 0) + ?, 0) WHERE id = ?',
    [n, customerId]
  );
  const type = meta.type || (n > 0 ? 'earn' : 'redeem');
  await conn.query(
    `INSERT INTO customer_points_ledger (customer_id, type, ref_type, ref_id, points, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [customerId, type, meta.refType || null, meta.refId || null, n, meta.note || null, meta.createdBy || null]
  );
}
