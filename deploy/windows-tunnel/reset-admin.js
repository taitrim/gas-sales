import { hashPassword } from '../../backend/src/auth.js';
import pool from '../../backend/src/db.js';

const username = process.env.ADMIN_RESET_USER || 'admin';
const password = process.env.ADMIN_PW;
if (!password) {
  console.error('Thieu ADMIN_PW.');
  process.exit(1);
}
const hashed = await hashPassword(password);
const [r] = await pool.query(
  "UPDATE users SET password = ? WHERE username = ? AND role = 'admin'",
  [hashed, username]
);
await pool.end();
if (r.affectedRows === 0) {
  console.error(`Khong tim thay admin username="${username}".`);
  process.exit(1);
}
console.log(`OK: mat khau admin "${username}" da duoc doi.`);