import { query } from '../db.js';
import { hashPassword, signToken, verifyPassword } from '../auth.js';
import { ApiError, genId, nowLocal, toBool, parseJSON } from '../utils.js';
import { mapUserRow } from '../mappers.js';
import { PERMISSIONS } from '../permissions.js';

export async function checkSystemStatus() {
  const rows = await query(
    `SELECT id FROM users WHERE role = 'admin' AND approve = 1 AND active = 1 LIMIT 1`
  );
  return { hasAdmin: rows.length > 0 };
}

export async function loginUser(payload) {
  const { username, password } = payload;
  const rows = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password))) {
    throw new ApiError(401, 'Sai tài khoản hoặc mật khẩu', 'INVALID_CREDENTIALS');
  }
  if (!toBool(user.approve)) {
    throw new ApiError(403, 'Tài khoản chưa được duyệt.', 'NOT_APPROVED');
  }
  if (!toBool(user.active)) {
    throw new ApiError(403, 'Tài khoản đã bị khóa.', 'ACCOUNT_DISABLED');
  }
  // Nếu password là plaintext (không bắt đầu bằng $2 bcrypt) → tự động hash lại
  // Bảo mật: tránh để password plain text tồn tại lâu trong DB
  const BCRYPT_PREFIX = '$2';
  if (!String(user.password).startsWith(BCRYPT_PREFIX)) {
    const rehashed = await hashPassword(String(password));
    await query('UPDATE users SET password = ? WHERE id = ?', [rehashed, user.id]);
  }
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    storeId: user.store_id,
    permissions: parseJSON(user.permissions, null),
    approve: toBool(user.approve),
    token: signToken(user)
  };
}

export async function registerUser(payload) {
  const d = payload.userData || {};
  if (!d.username || !d.password || !d.fullName) {
    throw new ApiError(400, 'Thiếu thông tin đăng ký (username, password, fullName).', 'BAD_REQUEST');
  }
  const exists = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [d.username]);
  if (exists.length > 0) {
    throw new ApiError(409, 'Tên đăng nhập đã tồn tại.', 'DUPLICATE_USERNAME');
  }
  // Chỉ được dùng isAdminSetup khi hệ thống CHƯA có admin nào → ngăn kẻ lạ tự phong admin
  const adminExists = await query(
    `SELECT id FROM users WHERE role = 'admin' AND approve = 1 AND active = 1 LIMIT 1`
  );
  const isAdminSetup = d.isAdminSetup === true && adminExists.length === 0;
  const hashed = await hashPassword(String(d.password));
  const id = genId('U');
  await query(
    `INSERT INTO users (id, username, password, full_name, role, store_id, active, created_at, approve)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      d.username,
      hashed,
      d.fullName,
      isAdminSetup ? 'admin' : 'staff',
      d.storeId || null,
      nowLocal(),
      isAdminSetup ? 1 : 0
    ]
  );
  return { id };
}

export async function getUsers() {
  const rows = await query('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map(mapUserRow);
}

export async function approveUser(payload) {
  const userId = payload.userId;
  await query('UPDATE users SET approve = ? WHERE id = ?', [payload.approve ? 1 : 0, userId]);
  return 'OK';
}

export async function updateUser(payload) {
  const u = payload.userData || {};
  await query(
    'UPDATE users SET full_name = ?, role = ?, store_id = ?, permissions = ? WHERE id = ?',
    [u.fullName, u.role, u.storeId || null, u.permissions ? JSON.stringify(u.permissions) : null, u.id]
  );
  return 'OK';
}

export async function deleteUser(payload) {
  await query('DELETE FROM users WHERE id = ?', [payload.userId]);
  return 'OK';
}

export async function resetPassword(payload) {
  const hashed = await hashPassword(String(payload.newPassword));
  await query('UPDATE users SET password = ? WHERE id = ?', [hashed, payload.userId]);
  return 'OK';
}

export async function getPermissionsList() {
  return PERMISSIONS;
}

export async function getUserPermissions(payload) {
  const rows = await query('SELECT permissions FROM users WHERE id = ?', [payload.userId]);
  if (rows.length === 0) throw new ApiError(404, 'Không tìm thấy người dùng.', 'NOT_FOUND');
  return parseJSON(rows[0].permissions, []);
}

export async function saveUserPermissions(payload) {
  const userId = payload.userId;
  const perms = Array.isArray(payload.permissions) ? payload.permissions : [];
  await query('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(perms), userId]);
  return 'OK';
}