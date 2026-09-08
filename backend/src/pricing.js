// Giá bán theo mốc số lượng (tier pricing).
// pricingTiers: [{ minQty, comboPrice }] (hoặc { price }) — áp giá khi số lượng >= minQty (chọn mốc cao nhất khớp).
export function bestTierPrice(tiers, qty) {
  if (!tiers) return null;
  const arr = Array.isArray(tiers) ? tiers : [tiers];
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return null;
  const valid = arr
    .map((t) => ({
      minQty: Number(t.minQty) || 0,
      price: Number(t.comboPrice ?? t.price) || 0
    }))
    .filter((t) => t.minQty > 0 && t.price > 0)
    .sort((a, b) => b.minQty - a.minQty);
  for (const t of valid) {
    if (n >= t.minQty) return t.price;
  }
  return null;
}

export async function resolveOrderItemPrices(conn, items, { wholesale = false } = {}) {
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  if (productIds.length === 0) return items;
  const [rows] = await conn.query(
    'SELECT id, pricing_tiers_json, wholesale_price FROM products WHERE id IN (?)',
    [productIds]
  );
  const rowMap = {};
  for (const r of rows) rowMap[r.id] = r;

  // Lấy giá biến thể nếu item bán theo variant
  const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))];
  let variantMap = {};
  if (variantIds.length > 0) {
    const [vrows] = await conn.query('SELECT id, price FROM product_variants WHERE id IN (?)', [variantIds]);
    for (const v of vrows) variantMap[v.id] = Number(v.price) || 0;
  }

  return items.map((it) => {
    // Ưu tiên giá biến thể (không áp giá sỉ / mốc giá cho đơn theo biến thể)
    if (it.variantId && variantMap[it.variantId]) {
      return { ...it, price: variantMap[it.variantId] };
    }
    const r = rowMap[it.productId];
    if (!r) return it;
    // Đơn bán sỉ: ưu tiên giá sỉ nếu sản phẩm có thiết lập
    if (wholesale && Number(r.wholesale_price) > 0) {
      return { ...it, price: Number(r.wholesale_price) };
    }
    const raw = r.pricing_tiers_json;
    if (!raw) return it;
    let tiers = [];
    try {
      tiers = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      tiers = [];
    }
    const tPrice = bestTierPrice(tiers, Number(it.quantity));
    if (tPrice) return { ...it, price: tPrice };
    return it;
  });
}

export function sumItems(items) {
  return items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0) - (Number(it.discount) || 0),
    0
  );
}