import { pool } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { genId } from '../src/utils.js';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const [storeRows] = await pool.query('SELECT id FROM stores LIMIT 1');
  if (storeRows.length === 0) {
    const storeId = 'ST-DEFAULT';
    await pool.query(
      'INSERT INTO stores (id, name, address, phone, is_active) VALUES (?, ?, ?, ?, 1)',
      [storeId, process.env.STORE_NAME || 'Cửa hàng chính', '—', '—']
    );
    console.log('✔ Đã tạo cửa hàng mặc định:', storeId);
  }

  const [userRows] = await pool.query('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
  if (userRows.length === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const id = genId('U');
    const hashed = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (id, username, password, full_name, role, store_id, active, created_at, approve)
       VALUES (?, ?, ?, ?, 'admin', 'ST-DEFAULT', 1, NOW(), 1)`,
      [id, username, hashed, 'Quản trị viên']
    );
    console.log('✔ Đã tạo tài khoản admin mặc định:', username, '/', password);
  } else {
    console.log('ℹ Đã có admin, bỏ qua seed admin.');
  }

  await pool.end();
}

seed().catch((err) => {
  console.error('✘ Seed thất bại:', err.message);
  process.exitCode = 1;
  process.exit();
});