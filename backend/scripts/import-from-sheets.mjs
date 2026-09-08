#!/usr/bin/env node
/**
 * Import dữ liệu từ Google Sheets vào MySQL (CLI)
 *
 * Dùng: node scripts/import-from-sheets.mjs --sheetId <SPREADSHEET_ID> [--dry-run] [--only Users,Products]
 * Cấu hình xác thực đặt trong backend/.env:
 *   GOOGLE_CREDENTIALS_JSON=<đường dẫn service account json>  hoặc  GOOGLE_API_KEY=<api key>
 * Có thể dùng giao diện web thay thế: menu "Import dữ liệu" trong ứng dụng.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { makeSource, importAll, checkCompleteness } from '../src/importSheets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.findIndex((a) => a.startsWith(`--${name}=`));
    return i >= 0 ? args[i].split('=')[1] : null;
  };
  const sheetId = getArg('sheetId') || process.env.GOOGLE_SHEET_ID;
  const dryRun = args.includes('--dry-run');
  const only = getArg('only') ? getArg('only').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const checkMode = args.includes('--check');
  const mode = getArg('mode') || process.env.IMPORT_MODE || (process.env.GOOGLE_CREDENTIALS_JSON ? 'service' : process.env.GOOGLE_API_KEY ? 'apikey' : 'public');

  if (!sheetId) {
    console.error('Thiếu Spreadsheet ID. Dùng --sheetId=<id> hoặc GOOGLE_SHEET_ID trong .env');
    process.exit(1);
  }

  const source = makeSource({
    spreadsheetId: sheetId,
    mode,
    credsPath: process.env.GOOGLE_CREDENTIALS_JSON,
    apiKey: process.env.GOOGLE_API_KEY
  });
  console.log(`Xác thực: ${source.authName}`);

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_sales',
    charset: 'utf8mb4'
  });

  console.log(`Sheet: ${sheetId}${dryRun ? '  [DRY RUN - không ghi DB]' : ''}`);
  try {
    if (checkMode) {
      const report = await checkCompleteness({ db, source });
      console.log('\n-- SỐ LƯỢNG THEO BẢNG --');
      for (const t of report.tables) {
        const status = !t.sheetFound ? 'sheet không có' : t.ok ? 'OK' : 'LỆCH';
        console.log(`  ${t.sheet.padEnd(22)} sheet=${t.sheetRows}  db=${t.dbRows}  [${status}]`);
      }
      console.log('\n-- KIỂM TRA THAM CHIẾU --');
      for (const c of report.integrity) {
        console.log(`  ${c.ok ? '✔' : '✘'} ${c.label}: ${c.count}`);
      }
      return;
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    const result = await importAll({ db, source, only, dryRun });
    for (const r of result.results) {
      if (r.error) {
        console.log(`  - ${r.sheet}: LỖI — ${r.error}`);
      } else {
        console.log(`  - ${r.sheet}: ${r.rows} dòng${r.missingIds ? ` (${r.missingIds} dòng thiếu ID, bỏ qua)` : ''}`);
      }
    }
    console.log(`\nTổng: ${result.total} dòng được xử lý.`);
    if (dryRun) console.log('Đây là dry-run, chưa ghi gì vào DB. Bỏ --dry-run để import thật.');
  } finally {
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    await db.end();
  }
}

main().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exitCode = 1;
});