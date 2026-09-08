import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

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

const TABLES = [
  { table: 'users', columns: ['full_name'] },
  { table: 'customers', columns: ['name', 'address', 'notes'] },
  { table: 'products', columns: ['name', 'category'] },
  { table: 'suppliers', columns: ['name', 'address', 'notes'] },
  { table: 'orders', columns: ['customer_name', 'address', 'note', 'carrier'] },
  { table: 'order_details', columns: ['product_name'] },
  { table: 'imports', columns: ['carrier'] },
  { table: 'import_details', columns: ['product_name'] },
  { table: 'expenses', columns: ['category', 'note'] },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_sales',
  });

  let totalFixed = 0;

  for (const { table, columns } of TABLES) {
    try {
      const [rows] = await conn.execute(`SELECT id, ${columns.map((c) => `\`${c}\``).join(', ')} FROM \`${table}\``);
      let tableFixed = 0;

      for (const row of rows) {
        const updates = {};
        for (const col of columns) {
          const corrected = fixMojibake(row[col]);
          if (corrected !== row[col]) {
            updates[col] = corrected;
          }
        }
        if (Object.keys(updates).length > 0) {
          const sets = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
          const vals = Object.values(updates);
          await conn.execute(`UPDATE \`${table}\` SET ${sets} WHERE id = ?`, [...vals, row.id]);
          tableFixed++;
        }
      }

      if (tableFixed > 0) {
        console.log(`✔ ${table}: fixed ${tableFixed}/${rows.length} rows`);
        totalFixed += tableFixed;
      }
    } catch (e) {
      console.log(`⚠ ${table}: skip (${e.message})`);
    }
  }

  console.log(`\n✔ Tổng cộng đã fix ${totalFixed} rows.`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
