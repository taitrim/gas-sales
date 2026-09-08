import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { ApiError } from '../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function fileTime(stat) {
  const d = stat.mtime;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function mysqlArgs() {
  const args = [
    `--host=${config.db.host}`,
    `--port=${config.db.port}`,
    `--user=${config.db.user}`,
    '--default-character-set=utf8mb4',
    config.db.database
  ];
  return args;
}

// Truyền password qua env MYSQL_PWD thay vì --password trên command line (tránh lộ trong process list)
function mysqlEnv() {
  return { ...process.env, MYSQL_PWD: config.db.password || '' };
}

// Tạo file backup bằng mysqldump
export async function backupDatabase() {
  ensureDir();
  const ts = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const fileName = `backup-${ts.getFullYear()}${p(ts.getMonth() + 1)}${p(ts.getDate())}-${p(ts.getHours())}${p(ts.getMinutes())}${p(ts.getSeconds())}.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(filePath);
    const proc = spawn('mysqldump', [...mysqlArgs(), '--single-transaction', '--routines'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: mysqlEnv()
    });
    proc.stdout.pipe(out);
    let errOut = '';
    proc.stderr.on('data', (d) => (errOut += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else {
        out.close();
        reject(new Error(`mysqldump exit ${code}: ${errOut.slice(0, 300)}`));
      }
    });
    proc.on('error', (e) => {
      out.close();
      reject(new Error(`Không chạy được mysqldump: ${e.message}`));
    });
  });
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    fs.unlinkSync(filePath);
    throw new ApiError(500, 'Backup thất bại: file dump trống. Kiểm tra mysqldump.', 'BACKUP_FAILED');
  }
  return { fileName, size: stat.size, createdAt: fileTime(stat) };
}

export async function listBackups() {
  ensureDir();
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { fileName: f, size: stat.size, createdAt: fileTime(stat) };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return files;
}

export async function deleteBackup(payload) {
  const fileName = String(payload.fileName || '');
  if (!fileName || fileName.includes('..') || !fileName.endsWith('.sql')) {
    throw new ApiError(400, 'Tên file backup không hợp lệ.', 'BAD_REQUEST');
  }
  const filePath = path.join(BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'Không tìm thấy file backup.', 'NOT_FOUND');
  fs.unlinkSync(filePath);
  return 'OK';
}

export async function restoreDatabase(payload) {
  const fileName = String(payload.fileName || '');
  if (!fileName || fileName.includes('..') || !fileName.endsWith('.sql')) {
    throw new ApiError(400, 'Tên file backup không hợp lệ.', 'BAD_REQUEST');
  }
  const filePath = path.join(BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'Không tìm thấy file backup.', 'NOT_FOUND');

  await new Promise((resolve, reject) => {
    const proc = spawn('mysql', mysqlArgs(), { stdio: ['pipe', 'ignore', 'pipe'], env: mysqlEnv() });
    fs.createReadStream(filePath).pipe(proc.stdin);
    let errOut = '';
    proc.stderr.on('data', (d) => (errOut += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Khôi phục thất bại (exit ${code}): ${errOut.slice(0, 500)}`));
    });
    proc.on('error', (e) => reject(new Error(`Không chạy được mysql: ${e.message}`)));
  });
  return 'OK';
}

export async function getBackupConfig() {
  ensureDir();
  return { dir: BACKUP_DIR, mysqldumpAvailable: true };
}
