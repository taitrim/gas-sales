// ============================================================
// Auto-backup hàng ngày (Linux/WSL) — chạy qua cron
//   crontab: 0 2 * * *  cd /srv/gas-sales-backend && node scripts/auto-backup.mjs
// Dùng MYSQL_PWD qua env (không lộ password trên command line)
// ============================================================
import 'dotenv/config';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS) || 14;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const db = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gas_sales'
};

const now = new Date();
const p = (n) => String(n).padStart(2, '0');
const fileName = `backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.sql`;
const filePath = path.join(BACKUP_DIR, fileName);

const args = [
  `--host=${db.host}`,
  `--port=${db.port}`,
  `--user=${db.user}`,
  '--default-character-set=utf8mb4',
  '--single-transaction',
  '--routines',
  db.database
];

await new Promise((resolve, reject) => {
  const out = fs.createWriteStream(filePath);
  const proc = spawn('mysqldump', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MYSQL_PWD: db.password }
  });
  proc.stdout.pipe(out);
  let errOut = '';
  proc.stderr.on('data', (d) => (errOut += d.toString()));
  proc.on('close', (code) => {
    out.close();
    if (code === 0) resolve();
    else reject(new Error(`mysqldump exit ${code}: ${errOut.slice(0, 300)}`));
  });
  proc.on('error', (e) => reject(new Error(`Không chạy được mysqldump: ${e.message}`)));
});

const stat = fs.statSync(filePath);
if (stat.size === 0) {
  fs.unlinkSync(filePath);
  throw new Error('Backup thất bại: file dump trống.');
}

// Dọn backup cũ hơn KEEP_DAYS
const cutoff = Date.now() - KEEP_DAYS * 864e5;
for (const f of fs.readdirSync(BACKUP_DIR)) {
  if (!f.endsWith('.sql')) continue;
  const fp = path.join(BACKUP_DIR, f);
  try {
    if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
  } catch {}
}

console.log(`✔ Backup thành công: ${fileName} (${stat.size} bytes)`);
