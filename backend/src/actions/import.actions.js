import { pool } from '../db.js';
import { makeSource, importAll, checkCompleteness } from '../importSheets.js';
import { ApiError } from '../utils.js';

// ============================================================
// Cấu hình import được lưu trong bảng store_info (key = import_*)
// ============================================================

async function getStoreInfoRows() {
  const [rows] = await pool.query('SELECT k, v FROM store_info');
  const map = {};
  rows.forEach((r) => { if (r.k) map[r.k] = r.v; });
  return map;
}

function resolveConfig(storeInfo) {
  return {
    sheetId: storeInfo.import_sheet_id || process.env.GOOGLE_SHEET_ID || '',
    auth: storeInfo.import_auth || (process.env.GOOGLE_CREDENTIALS_JSON ? 'service' : process.env.GOOGLE_API_KEY ? 'apikey' : 'public'),
    apiKey: storeInfo.import_api_key || process.env.GOOGLE_API_KEY || '',
    credsPath: storeInfo.import_creds_path || process.env.GOOGLE_CREDENTIALS_JSON || ''
  };
}

function buildSource(config) {
  if (!config.sheetId) throw new ApiError(400, 'Thiếu Spreadsheet ID. Hãy lưu cấu hình trước.', 'BAD_REQUEST');
  return makeSource({
    spreadsheetId: config.sheetId,
    mode: config.auth,
    credsPath: config.credsPath,
    apiKey: config.apiKey
  });
}

// Placeholder khi frontend ko gửi lại key => giữ nguyên giá trị đã lưu trên server
const KEEP_SECRET = '••••••••••••';

function maskSecret(v) {
  return v ? KEEP_SECRET : '';
}

export async function getImportConfig() {
  const cfg = resolveConfig(await getStoreInfoRows());
  // Không trả apiKey về client dạng plaintext — chỉ báo "đã cấu hình"
  return { ...cfg, apiKey: maskSecret(cfg.apiKey) };
}

export async function saveImportConfig(payload) {
  const { sheetId = '', auth = 'public', apiKey = '', credsPath = '' } = payload || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // apiKey/credsPath gửi placeholder => giữ giá trị cũ trong DB
    let finalApiKey = apiKey;
    let finalCredsPath = credsPath;
    if (finalApiKey === KEEP_SECRET || finalCredsPath === KEEP_SECRET) {
      const [rows] = await conn.query('SELECT k, v FROM store_info WHERE k IN (?, ?)', [
        'import_api_key',
        'import_creds_path'
      ]);
      const prev = {};
      rows.forEach((r) => { prev[r.k] = r.v; });
      if (finalApiKey === KEEP_SECRET) finalApiKey = prev.import_api_key || '';
      if (finalCredsPath === KEEP_SECRET) finalCredsPath = prev.import_creds_path || '';
    }
    const entries = {
      import_sheet_id: sheetId,
      import_auth: auth,
      import_api_key: finalApiKey,
      import_creds_path: finalCredsPath
    };
    for (const [k, v] of Object.entries(entries)) {
      await conn.query(
        'INSERT INTO store_info (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
        [k, v]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return 'OK';
}

// ============================================================
// Kiểm tra tính đầy đủ (so sánh sheet vs DB + kiểm tra tham chiếu)
// ============================================================
export async function checkImportData() {
  const config = resolveConfig(await getStoreInfoRows());
  const source = buildSource(config);
  const conn = await pool.getConnection();
  try {
    const report = await checkCompleteness({ db: conn, source });
    return { ...report, authName: source.authName };
  } finally {
    conn.release();
  }
}

// ============================================================
// Chạy import (upsert, giữ nguyên ID gốc)
// ============================================================
export async function runImport(payload) {
  const config = resolveConfig(await getStoreInfoRows());
  const source = buildSource(config);
  const dryRun = payload?.dryRun === true;
  const only = Array.isArray(payload?.only) && payload.only.length > 0 ? payload.only : null;

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const result = await importAll({ db: conn, source, only, dryRun });
    return { ...result, dryRun, authName: source.authName };
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();
  }
}