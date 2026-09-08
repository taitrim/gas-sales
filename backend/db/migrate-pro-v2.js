import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Migration Pro v2.7:
// - thêm cột total_debt (customers), discount (order_details)
// - tạo các bảng: audit_logs, customer_debt_ledger, returns,
//   return_details, promotions, stock_adjustments
async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_sales',
    multipleStatements: true,
    charset: 'utf8mb4'
  });
  try {
    // 1. Cột mới
    const [cols] = await conn.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND ((table_name = 'customers' AND column_name = 'total_debt') OR (table_name = 'order_details' AND column_name = 'discount'))"
    );
    const existing = cols.map((c) => `${c.table_name}.${c.column_name}`);
    if (!existing.includes('customers.total_debt')) {
      await conn.query('ALTER TABLE customers ADD COLUMN total_debt DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER total_spent');
      console.log('✔ Đã thêm cột customers.total_debt.');
    } else {
      console.log('• customers.total_debt đã tồn tại, bỏ qua.');
    }
    if (!existing.includes('order_details.discount')) {
      await conn.query('ALTER TABLE order_details ADD COLUMN discount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER price');
      console.log('✔ Đã thêm cột order_details.discount.');
    } else {
      console.log('• order_details.discount đã tồn tại, bỏ qua.');
    }

    // 2. Bảng mới (tách từ schema.sql)
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const wanted = ['audit_logs', 'customer_debt_ledger', 'returns', 'return_details', 'promotions', 'stock_adjustments'];
    for (const t of wanted) {
      const [rows] = await conn.query(
        "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
        [t]
      );
      if (rows[0].n === 0) {
        // Tách từng CREATE TABLE ra khỏi schema.sql
        const re = new RegExp(`CREATE TABLE IF NOT EXISTS \\\`?${t}\\\`?[\\s\\S]*?ENGINE=InnoDB;`);
        const m = schema.match(re);
        if (m) {
          await conn.query(m[0]);
          console.log(`✔ Đã tạo bảng ${t}.`);
        } else {
          console.error(`✘ Không tìm thấy CREATE TABLE ${t} trong schema.sql.`);
        }
      } else {
        console.log(`• Bảng ${t} đã tồn tại, bỏ qua.`);
      }
    }
  } catch (err) {
    console.error('✘ Lỗi migration:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();