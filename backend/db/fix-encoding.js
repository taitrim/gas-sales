import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Fix mojibake trong full_name của users table.
 * Pattern: UTF-8 bytes → interpret as Latin-1 → encode lại thành UTF-8
 * Fix: Buffer.from(str, 'latin1').toString('utf8')
 */
function fixMojibake(str) {
  if (!str) return str;
  if (!/Ã|Ä|Â|Æ|€|™|¦|›|«|»|±|µ|¸|º|ª|¿/.test(str)) return str;
  try {
    const fixed = Buffer.from(str, 'latin1').toString('utf8');
    if (fixed !== str && /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(fixed)) {
      return fixed;
    }
  } catch {}
  return str;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_sales',
  });

  const [rows] = await conn.execute('SELECT id, username, full_name FROM users WHERE full_name IS NOT NULL');
  let fixed = 0;

  for (const row of rows) {
    const original = row.full_name;
    const corrected = fixMojibake(original);
    if (corrected !== original) {
      await conn.execute('UPDATE users SET full_name = ? WHERE id = ?', [corrected, row.id]);
      console.log(`Fixed: ${row.username} | "${original}" → "${corrected}"`);
      fixed++;
    }
  }

  console.log(`\n✔ Đã fix ${fixed}/${rows.length} user.`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
