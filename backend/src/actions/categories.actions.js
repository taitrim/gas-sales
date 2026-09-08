import { query } from '../db.js';
import { ApiError, genId, nowLocal } from '../utils.js';

export async function listCategories() {
  const rows = await query('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: Number(r.sort_order),
      productCount: 0
    }))
  };
}

export async function listCategoriesWithCount() {
  const rows = await query(
    `SELECT c.id, c.name, c.color, c.sort_order, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category = c.name
      GROUP BY c.id, c.name, c.color, c.sort_order
      ORDER BY c.sort_order ASC, c.name ASC`
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: Number(r.sort_order),
      productCount: Number(r.product_count)
    }))
  };
}

export async function addCategory(payload) {
  const d = payload.categoryData || {};
  const name = String(d.name || '').trim();
  if (!name) throw new ApiError(400, 'Thiếu tên danh mục.', 'BAD_REQUEST');
  const id = genId('CAT');
  await query(
    'INSERT INTO categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, d.color || null, Number(d.sortOrder) || 0, nowLocal()]
  );
  return { id };
}

export async function updateCategory(payload) {
  const d = payload.categoryData || {};
  if (!d.id) throw new ApiError(400, 'Thiếu ID danh mục.', 'BAD_REQUEST');
  const name = String(d.name || '').trim();
  if (!name) throw new ApiError(400, 'Thiếu tên danh mục.', 'BAD_REQUEST');
  await query(
    'UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?',
    [name, d.color || null, Number(d.sortOrder) || 0, d.id]
  );
  return 'OK';
}

export async function deleteCategory(payload) {
  if (!payload.categoryId) throw new ApiError(400, 'Thiếu ID danh mục.', 'BAD_REQUEST');
  const rows = await query('SELECT name FROM categories WHERE id = ?', [payload.categoryId]);
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy danh mục.', 'NOT_FOUND');
  // Xóa khỏi bảng categories; sản phẩm giữ nguyên category string (không xóa sản phẩm)
  await query('DELETE FROM categories WHERE id = ?', [payload.categoryId]);
  return 'OK';
}