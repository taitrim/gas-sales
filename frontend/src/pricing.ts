import type { Product } from './types';

export interface PricingTier {
  minQty: number;
  comboPrice: number;
}

type RawTier = { minQty: number; comboPrice?: number; price?: number };

function toArr(tiers: RawTier | RawTier[] | undefined): RawTier[] {
  if (!tiers) return [];
  return Array.isArray(tiers) ? tiers : [tiers];
}

// Giá theo mốc khi số lượng >= minQty (chọn mốc cao nhất khớp)
export function tierPrice(tiers: RawTier | RawTier[] | undefined, qty: number): number | null {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return null;
  const valid = toArr(tiers)
    .map((t) => ({
      minQty: Number(t.minQty),
      price: Number(t.comboPrice ?? t.price)
    }))
    .filter((t) => t.minQty > 0 && t.price > 0)
    .sort((a, b) => b.minQty - a.minQty);
  for (const t of valid) {
    if (n >= t.minQty) return t.price;
  }
  return null;
}

// Mốc giá rẻ nhất (dùng để hiển thị gợi ý trên card sản phẩm)
export function bestTier(tiers: RawTier | RawTier[] | undefined): PricingTier | null {
  let best: PricingTier | null = null;
  for (const t of toArr(tiers)) {
    const minQty = Number(t.minQty);
    const price = Number(t.comboPrice ?? t.price);
    if (minQty <= 0 || price <= 0) continue;
    if (!best || price < best.comboPrice) {
      best = { minQty, comboPrice: price };
    }
  }
  return best;
}

export function effectivePrice(p: Product, qty: number, wholesale = false): number {
  if (wholesale && Number(p.wholesalePrice) > 0) return Number(p.wholesalePrice);
  return (tierPrice(p.pricingTiers, qty) ?? Number(p.retailPrice)) || 0;
}