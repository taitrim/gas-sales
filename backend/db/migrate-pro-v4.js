// Migration v4: thêm variant_id vào order_details (hỗ trợ bán theo biến thể)
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function addColumnIfMissing(conn, table, column, ddl) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (cols.length > 0) {
    console.log(`  • ${table}.${column} đã tồn tại, bỏ qua.`);
    return;
  }
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`  ✔ Đã thêm ${table}.${column}`);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_sales'
  });
  console.log('Migration v4 — thêm variant_id vào order_details');
  await addColumnIfMissing(
    conn,
    'order_details',
    'variant_id',
    'variant_id VARCHAR(40) NULL AFTER product_id'
  );
  await conn.end();
  console.log('Hoàn tất.');
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});