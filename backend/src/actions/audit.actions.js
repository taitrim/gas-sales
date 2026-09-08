import { query } from '../db.js';

const PAGE_SIZE = 50;

export async function getAuditLogs(payload) {
  const page = Math.max(1, Number(payload.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(payload.pageSize) || PAGE_SIZE));
  const where = [];
  const params = [];
  if (payload.action) {
    where.push('action = ?');
    params.push(payload.action);
  }
  if (payload.userId) {
    where.push('user_id = ?');
    params.push(payload.userId);
  }
  if (payload.from) {
    where.push('created_at >= ?');
    params.push(payload.from);
  }
  if (payload.to) {
    where.push('created_at <= ?');
    params.push(payload.to);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [rows, [count]] = await Promise.all([
    query(`SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [
      ...params,
      pageSize,
      (page - 1) * pageSize
    ]),
    query(`SELECT COUNT(*) AS n FROM audit_logs ${whereSql}`, params)
  ]);
  return {
    page,
    pageSize,
    total: Number(count.n) || 0,
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      detail: r.detail,
      ip: r.ip,
      createdAt: r.created_at
    }))
  };
}