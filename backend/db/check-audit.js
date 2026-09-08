import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gas_sales',
});
const [tables] = await conn.execute("SHOW TABLES LIKE 'audit_logs'");
console.log('Table exists:', tables.length > 0);
if (tables.length > 0) {
  const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM audit_logs');
  console.log('Row count:', rows[0].cnt);
}
await conn.end();
