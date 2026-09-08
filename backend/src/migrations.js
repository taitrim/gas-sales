import { query } from './db.js';
import { ensurePointsLedgerTable } from './points.js';

// Thêm cột source (nguồn khách: facebook/tiktok/zalo/...) nếu DB cũ chưa có
async function ensureCustomerSourceColumn() {
  const rows = await query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'source'`
  );
  if (rows.length === 0) {
    await query('ALTER TABLE customers ADD COLUMN source VARCHAR(50) NULL AFTER address');
  }
}

// Chạy mọi migration nhẹ khi khởi động server (an toàn khi chạy lại)
export async function runMigrations() {
  await ensurePointsLedgerTable();
  await ensureCustomerSourceColumn();
}
