import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Migration Pro v2.8:
// - thêm cột: orders(tax_rate, tax_amount, points_earned, points_used, is_preorder),
//   customers(credit_limit, points, payment_terms_days), users(permissions), products(is_combo)
// - tạo các bảng: product_variants, product_combos, store_stock, stock_transfers,
//   stock_transfer_details, product_price_history
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
    // 1. Cột mới — thêm theo danh sách, bỏ qua nếu đã tồn tại (idempotent)
    const columnDefs = [
      ['orders', 'tax_rate', 'tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER delivery_date'],
      ['orders', 'tax_amount', 'tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER tax_rate'],
      ['orders', 'points_earned', 'points_earned INT NOT NULL DEFAULT 0 AFTER tax_amount'],
      ['orders', 'points_used', 'points_used INT NOT NULL DEFAULT 0 AFTER points_earned'],
      ['orders', 'points_value', 'points_value DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER points_used'],
      ['orders', 'is_preorder', 'is_preorder TINYINT(1) NOT NULL DEFAULT 0 AFTER points_value'],
      ['customers', 'credit_limit', 'credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER total_debt'],
      ['customers', 'points', 'points INT NOT NULL DEFAULT 0 AFTER credit_limit'],
      ['customers', 'payment_terms_days', 'payment_terms_days INT NOT NULL DEFAULT 0 AFTER points'],
      ['users', 'permissions', 'permissions JSON NULL AFTER store_id'],
      ['products', 'is_combo', 'is_combo TINYINT(1) NOT NULL DEFAULT 0 AFTER pricing_tiers_json']
    ];
    for (const [table, column, ddl] of columnDefs) {
      try {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
        console.log(`✔ Đã thêm cột ${table}.${column}.`);
      } catch (err) {
        if (String(err.message).toLowerCase().includes('duplicate column')) {
          console.log(`• ${table}.${column} đã tồn tại, bỏ qua.`);
        } else {
          throw err;
        }
      }
    }

    // 2. Bảng mới (tách từ schema.sql)
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const wanted = [
      'product_variants',
      'product_combos',
      'store_stock',
      'stock_transfers',
      'stock_transfer_details',
      'product_price_history'
    ];
    for (const t of wanted) {
      const [rows] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
        [t]
      );
      if (rows[0].n === 0) {
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