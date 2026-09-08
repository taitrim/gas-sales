import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_sales',
    charset: 'utf8mb4'
  });
  try {
    const [cols] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'wholesale_price'"
    );
    if (cols[0].n === 0) {
      await conn.query('ALTER TABLE products ADD COLUMN wholesale_price DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER retail_price');
      console.log('✔ Đã thêm cột wholesale_price.');
    } else {
      console.log('• Cột wholesale_price đã tồn tại, bỏ qua.');
    }
  } catch (err) {
    console.error('✘ Lỗi migration:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
