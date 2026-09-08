import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { ApiError } from './utils.js';

const BCRYPT_PREFIX = '$2';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

// Hỗ trợ 2 trường hợp: mật khẩu đã là bcrypt hash (từ import) hoặc plaintext cũ (từ Google Sheets)
export async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (String(stored).startsWith(BCRYPT_PREFIX)) {
    return bcrypt.compare(plain, stored);
  }
  return stored === plain;
}

export function signToken(user) {
  let perms = user.permissions;
  if (typeof perms === 'string') {
    try {
      perms = JSON.parse(perms);
    } catch {
      perms = null;
    }
  }
  return jwt.sign(
    {
      uid: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      storeId: user.store_id,
      permissions: Array.isArray(perms) ? perms : null
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    throw new ApiError(401, 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.', 'UNAUTHORIZED');
  }
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next(new ApiError(401, 'Chưa đăng nhập.', 'UNAUTHORIZED'));
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Bạn không có quyền thực hiện thao tác này.', 'FORBIDDEN'));
  }
  next();
}