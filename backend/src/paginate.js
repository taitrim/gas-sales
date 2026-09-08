export function parsePage({ page, pageSize } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const s = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  return { page: p, pageSize: s, offset: (p - 1) * s };
}

export function buildSearch(fields, search) {
  const q = (search || '').trim().toLowerCase();
  if (!q) return { sql: '', params: [] };
  const like = `%${q}%`;
  const clauses = fields.map((f) => `LOWER(${f}) LIKE ?`);
  return { sql: `(${clauses.join(' OR ')})`, params: fields.map(() => like) };
}