import { pool, query } from '../db.js';
import { ApiError } from '../utils.js';
import { mapStoreRow } from '../mappers.js';

export async function getStores() {
  const rows = await query('SELECT * FROM stores ORDER BY name');
  return rows.map(mapStoreRow);
}

export async function addStore(payload) {
  const s = payload.storeData || {};
  if (!s.name) throw new ApiError(400, 'Thiếu tên cửa hàng.', 'BAD_REQUEST');
  const id = 'ST' + Date.now();
  await query(
    'INSERT INTO stores (id, name, address, phone, manager_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [id, s.name, s.address || null, s.phone || null, s.managerId || null]
  );
  return { id };
}

export async function updateStore(payload) {
  const s = payload.storeData || {};
  if (!s.id) throw new ApiError(400, 'Thiếu ID cửa hàng.', 'BAD_REQUEST');
  await query(
    'UPDATE stores SET name = ?, address = ?, phone = ?, manager_id = ?, is_active = ? WHERE id = ?',
    [s.name, s.address || null, s.phone || null, s.managerId || null, s.isActive ? 1 : 0, s.id]
  );
  return 'OK';
}

export async function deleteStore(payload) {
  await query('DELETE FROM stores WHERE id = ?', [payload.storeId]);
  return 'OK';
}

export async function getStoreInfo() {
  const rows = await query('SELECT k, v FROM store_info');
  const info = {};
  rows.forEach((r) => {
    if (!r.k) return;
    // Không bao giờ trả về cấu hình import (chứa Google API key / creds path) cho client
    if (String(r.k).startsWith('import_')) return;
    info[r.k] = r.v;
  });
  return info;
}

export async function saveStoreInfo(payload) {
  const info = payload.storeInfo || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [k, v] of Object.entries(info)) {
      await conn.query(
        'INSERT INTO store_info (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
        [k, String(v ?? '')]
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