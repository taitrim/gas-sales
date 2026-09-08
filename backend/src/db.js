import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  queueLimit: 100,
  charset: 'utf8mb4',
  namedPlaceholders: false,
  dateStrings: true
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getConnection() {
  return pool.getConnection();
}

export async function closePool() {
  try {
    await pool.end();
  } catch (err) {
    console.error('Lỗi khi đóng pool:', err.message);
  }
}

export default pool;