import { randomInt } from 'crypto';

export class ApiError extends Error {
  constructor(status, message, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const asyncWrap = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    throw err;
  }
};

export function genId(prefix) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  // 6 chữ số ngẫu nhiên mật mã (100000-999999) thay vì 4 chữ số Math.random
  // → giảm đáng kể nguy cơ trùng ID khi tạo đồng thời
  const rand = 100000 + randomInt(0, 900000);
  return `${prefix}-${yy}${mm}${dd}-${rand}`;
}

export function nowISO() {
  return new Date().toISOString();
}

// Chuyển Date sang chuỗi DATETIME theo giờ địa phương của server
export function toSqlDateTime(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function nowLocal() {
  return toSqlDateTime(new Date());
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function strOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function dateOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

export function parseJSON(value, fallback = []) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toBool(v) {
  return v === true || v === 1 || String(v).toUpperCase() === 'TRUE';
}