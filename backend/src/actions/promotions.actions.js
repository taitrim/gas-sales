import { query } from '../db.js';
import { ApiError, genId, nowLocal, dateOrNull } from '../utils.js';

function mapPromotionRow(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    discountType: r.discount_type,
    discountValue: Number(r.discount_value),
    minOrderAmount: Number(r.min_order_amount),
    maxDiscount: Number(r.max_discount),
    active: Boolean(r.active),
    startDate: r.start_date,
    endDate: r.end_date,
    usageLimit: Number(r.usage_limit),
    usedCount: Number(r.used_count),
    createdAt: r.created_at
  };
}

export async function getPromotions() {
  const rows = await query('SELECT * FROM promotions ORDER BY created_at DESC');
  return rows.map(mapPromotionRow);
}

export async function addPromotion(payload) {
  const d = payload.promotionData || {};
  if (!d.code) throw new ApiError(400, 'Thiếu mã khuyến mãi.', 'BAD_REQUEST');
  if (!['percent', 'amount'].includes(d.discountType)) {
    throw new ApiError(400, 'Loại chiết khấu không hợp lệ.', 'BAD_REQUEST');
  }
  const code = String(d.code).trim().toUpperCase();
  const dup = await query('SELECT id FROM promotions WHERE code = ?', [code]);
  if (dup.length > 0) throw new ApiError(400, `Mã "${code}" đã tồn tại.`, 'DUPLICATE');

  const id = genId('PROMO');
  await query(
    `INSERT INTO promotions (id, code, name, discount_type, discount_value, min_order_amount, max_discount,
       active, start_date, end_date, usage_limit, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      code,
      d.name || '',
      d.discountType,
      Number(d.discountValue) || 0,
      Number(d.minOrderAmount) || 0,
      Number(d.maxDiscount) || 0,
      d.active === undefined || d.active ? 1 : 0,
      dateOrNull(d.startDate),
      dateOrNull(d.endDate),
      Number(d.usageLimit) || 0,
      payload.user?.id || null,
      nowLocal()
    ]
  );
  return { id };
}

export async function updatePromotion(payload) {
  const d = payload.promotionData || {};
  if (!d.id) throw new ApiError(400, 'Thiếu ID khuyến mãi.', 'BAD_REQUEST');
  await query(
    `UPDATE promotions SET code = ?, name = ?, discount_type = ?, discount_value = ?, min_order_amount = ?,
       max_discount = ?, active = ?, start_date = ?, end_date = ?, usage_limit = ?
     WHERE id = ?`,
    [
      String(d.code || '').trim().toUpperCase(),
      d.name || '',
      d.discountType || 'percent',
      Number(d.discountValue) || 0,
      Number(d.minOrderAmount) || 0,
      Number(d.maxDiscount) || 0,
      d.active === undefined || d.active ? 1 : 0,
      dateOrNull(d.startDate),
      dateOrNull(d.endDate),
      Number(d.usageLimit) || 0,
      d.id
    ]
  );
  return 'OK';
}

export async function deletePromotion(payload) {
  await query('DELETE FROM promotions WHERE id = ?', [payload.promotionId]);
  return 'OK';
}