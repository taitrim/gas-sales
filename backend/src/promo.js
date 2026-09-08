import { toBool } from './utils.js';

// Xác định chiết khấu từ mã khuyến mãi (trả về { discount, promo } hoặc null nếu không dùng được)
export async function computePromoDiscount(conn, code, subtotal) {
  if (!code) return null;
  const [rows] = await conn.query('SELECT * FROM promotions WHERE code = ? LIMIT 1', [String(code).trim()]);
  const promo = rows[0];
  if (!promo) return { discount: 0, promo: null, error: 'Mã khuyến mãi không tồn tại.' };
  if (!toBool(promo.active)) return { discount: 0, promo, error: 'Mã khuyến mãi đã bị vô hiệu hóa.' };

  const now = new Date();
  if (promo.start_date && new Date(promo.start_date).getTime() > now.getTime()) {
    return { discount: 0, promo, error: 'Mã khuyến mãi chưa có hiệu lực.' };
  }
  if (promo.end_date && new Date(promo.end_date).getTime() < now.getTime()) {
    return { discount: 0, promo, error: 'Mã khuyến mãi đã hết hạn.' };
  }
  if (promo.usage_limit > 0 && promo.used_count >= promo.usage_limit) {
    return { discount: 0, promo, error: 'Mã khuyến mãi đã hết lượt sử dụng.' };
  }
  if (Number(promo.min_order_amount) > 0 && Number(subtotal) < Number(promo.min_order_amount)) {
    return {
      discount: 0,
      promo,
      error: `Đơn hàng tối thiểu ${Number(promo.min_order_amount).toLocaleString('vi-VN')}đ để dùng mã này.`
    };
  }

  let discount = 0;
  if (promo.discount_type === 'percent') {
    discount = (Number(subtotal) * Number(promo.discount_value)) / 100;
    if (Number(promo.max_discount) > 0 && discount > Number(promo.max_discount)) {
      discount = Number(promo.max_discount);
    }
  } else {
    discount = Number(promo.discount_value) || 0;
  }
  discount = Math.max(0, Math.min(discount, Number(subtotal)));
  return { discount, promo };
}