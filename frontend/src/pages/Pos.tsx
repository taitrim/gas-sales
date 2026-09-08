import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api } from '../api';
import type { Customer, Order, Product, StoreInfo } from '../types';
import { fmtMoney, fmtNumber } from '../format';
import { tierPrice, bestTier, type PricingTier } from '../pricing';
import PrintInvoice from '../components/PrintInvoice';
import CustomerSearch from '../components/CustomerSearch';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

interface CartItem {
  productId: string;
  variantId?: string | null;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  basePrice: number;
  tiers: PricingTier[];
  costPrice: number;
  stock: number;
}

export default function Pos() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [taxRate, setTaxRate] = useState(0);
  const [isPreorder, setIsPreorder] = useState(false);
  const [pointsUsed, setPointsUsed] = useState(0);
  const [paying, setPaying] = useState(false);
  const [printDoc, setPrintDoc] = useState<Order | null>(null);
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddr, setNewCustAddr] = useState('');
  const [variantPick, setVariantPick] = useState<Product | null>(null);

  const load = useCallback(() => {
    Promise.all([api.getProducts(), api.getCustomers(), api.getStoreInfo()])
      .then(([p, c, info]) => {
        setProducts(p);
        setCustomers(c);
        setStoreInfo(info);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products]
  );

  function catColor(cat: string) {
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 45%)`;
  }

  function stockStatus(stock: number) {
    if (stock <= 0) return 'out';
    if (stock <= 10) return 'low';
    return 'ok';
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    });
  }, [products, search, category]);

  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);
  const subtotal = cart.reduce((s, it) => s + it.quantity * it.price, 0);
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const custPoints = Number(selectedCustomer?.points || 0);
  const pointValue = Number(storeInfo.pointValue) || 1000;
  const pointsRate = Number(storeInfo.pointsRate) || 1;
  const maxRedeem = Math.min(Math.floor((subtotal - discount) / pointValue), custPoints);
  const usedPoints = Math.min(Math.max(0, Math.floor(pointsUsed)), maxRedeem);
  const pointsValue = usedPoints * pointValue;
  const taxAmount = Math.max(0, Math.round((subtotal - discount - pointsValue) * (taxRate / 100)));
  const total = Math.max(0, subtotal - discount - pointsValue + taxAmount);
  const earnPreview = Math.floor(total / 1000) * pointsRate;

  function addToCart(p: Product, variant?: { id: string; name: string; price: number; stock: number }) {
    const inCart = qtyInCart(p.id, variant?.id);
    const stock = variant ? Number(variant.stock) : Number(p.stock);
    if (stock <= 0) {
      toast(`${p.name}${variant ? ' ' + variant.name : ''} đã hết hàng.`, 'err');
      return;
    }
    if (inCart >= stock) {
      toast(`Vượt quá tồn kho (${fmtNumber(stock)}).`, 'err');
      return;
    }
    const key = variant?.id || p.id;
    setCart((prev) => {
      const existing = prev.find((it) => (it.variantId || it.productId) === key);
      const newQty = (existing?.quantity || 0) + 1;
      const price = variant ? Number(variant.price) : tierPrice(p.pricingTiers, newQty) ?? Number(p.retailPrice);
      if (existing) {
        return prev.map((it) =>
          (it.variantId || it.productId) === key ? { ...it, quantity: newQty, price } : it
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          variantId: variant?.id || null,
          sku: variant ? p.sku + '-' + variant.name : p.sku,
          productName: variant ? `${p.name} (${variant.name})` : p.name,
          quantity: 1,
          price,
          basePrice: variant ? Number(variant.price) : Number(p.retailPrice),
          tiers: Array.isArray(p.pricingTiers) ? p.pricingTiers : p.pricingTiers ? [p.pricingTiers] : [],
          costPrice: Number(p.importPrice),
          stock
        }
      ];
    });
  }

  function handleProductClick(p: Product) {
    const activeVariants = (p.variants || []).filter((v) => v.isActive);
    if (activeVariants.length > 0) {
      setVariantPick(p);
      return;
    }
    addToCart(p);
  }

  function setQty(idx: number, qty: number) {
    setCart((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const q = Math.max(0, Math.min(qty, it.stock));
        return { ...it, quantity: q, price: it.variantId ? it.price : tierPrice(it.tiers, q) ?? it.basePrice };
      })
    );
  }

  function qtyInCart(productId: string, variantId?: string) {
    const key = variantId || productId;
    return cart.find((it) => (it.variantId || it.productId) === key)?.quantity || 0;
  }

  const cartKey = (it: CartItem) => it.variantId || it.productId;

  function handleCustomerSelect(c: { id: string; name: string; phone?: string }) {
    setCustomerId(c.id);
    setCustomerName(c.name || '');
    setPhone(c.phone || '');
  }

  async function handleAddCustomer() {
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast('Nhập tên và SĐT khách hàng.', 'err');
      return;
    }
    try {
      const res = await api.addCustomer({ name: newCustName.trim(), phone: newCustPhone.trim(), address: newCustAddr.trim() });
      const newCust: Customer = { id: res.id, name: newCustName.trim(), phone: newCustPhone.trim(), address: newCustAddr.trim(), totalSpent: 0, lastPurchaseDate: null, notes: '', debt: 0 };
      setCustomers((prev) => [newCust, ...prev]);
      handleCustomerSelect(newCust);
      setCustModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddr('');
      toast('Đã thêm khách hàng mới.');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  }

  async function handlePay() {
    if (cart.length === 0) {
      toast('Giỏ hàng trống.', 'err');
      return;
    }
    setPaying(true);
    try {
      const orderData = {
        customerId: customerId || null,
        customerName,
        phone: phone || null,
        orderType: 'retail',
        status: isPreorder ? 'pending' : 'completed',
        paymentStatus: isPreorder ? 'unpaid' : 'paid',
        paymentMethod,
        subtotal,
        discount,
        shippingFee: 0,
        surcharge: 0,
        totalAmount: total,
        shippingMethod: 'pickUp',
        taxRate,
        pointsUsed: usedPoints,
        isPreorder,
        items: cart.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          sku: it.sku,
          productName: it.productName,
          quantity: it.quantity,
          price: it.price,
          costPrice: it.costPrice
        }))
      };
      const res = await api.createOrder(orderData);
      const now = new Date().toISOString();
      setPrintDoc({
        id: res.orderId,
        customerId: customerId || null,
        customerName,
        phone: phone || '',
        address: '',
        orderType: 'retail',
        subtotal,
        discount,
        shippingFee: 0,
        surcharge: 0,
        totalAmount: total,
        paymentMethod,
        status: isPreorder ? 'pending' : 'completed',
        paymentStatus: isPreorder ? 'unpaid' : 'paid',
        shippingMethod: 'pickUp',
        carrier: '',
        dropshipSupplierId: null,
        createdBy: '',
        createdAt: now,
        storeId: '',
        note: '',
        deliveryDate: null,
        taxRate,
        taxAmount,
        pointsUsed: usedPoints,
        pointsValue,
        isPreorder,
        items: cart.map((it) => ({
          productId: it.productId,
          sku: it.sku,
          productName: it.productName,
          quantity: it.quantity,
          price: it.price,
          costPrice: it.costPrice
        }))
      });
      toast(`${isPreorder ? 'Đã tạo đơn đặt trước' : 'Đã bán'} ${fmtMoney(total)}!`);
      setCart([]);
      setDiscount(0);
      setTaxRate(0);
      setPointsUsed(0);
      setIsPreorder(false);
      setCustomerId('');
      setCustomerName('');
      setPhone('');
      setCartOpen(false);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setPaying(false);
    }
  }

  function PosItem({ it, idx, qtyDraft, setQtyDraft, setQty, fmtMoney }: {
    it: CartItem;
    idx: number;
    qtyDraft: Record<string, string>;
    setQtyDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setQty: (idx: number, qty: number) => void;
    fmtMoney: (n: number) => string;
  }) {
    return (
      <div className="pos-item" key={it.variantId || it.productId}>
        <div className="pos-item-info">
          <div className="pos-item-name">{it.productName}</div>
          <div className="pos-item-meta">
            {it.price < it.basePrice && (
              <span className="pos-tier-badge">Giá mốc</span>
            )}
            <div className="pos-item-price">
              {it.price < it.basePrice ? (
                <>
                 {fmtMoney(it.basePrice)} <b style={{ color: 'var(--danger)' }}>{fmtMoney(it.price)}</b>
                </>
              ) : (
                fmtMoney(it.price)
              )}
            </div>
          </div>
        </div>
        <div className="pos-item-qty">
          <button
            className="qty-btn"
            onClick={() => {
              setQty(idx, it.quantity - 1);
              setQtyDraft((d) => ({ ...d, [cartKey(it)]: String(it.quantity - 1) }));
            }}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={it.stock}
            className="qty-input"
            value={qtyDraft[cartKey(it)] ?? String(it.quantity)}
            onChange={(e) => {
              const v = e.target.value;
              setQtyDraft((d) => ({ ...d, [cartKey(it)]: v }));
              setQty(idx, Number(v));
            }}
            onBlur={() =>
              setQtyDraft((d) => {
                const next = { ...d };
                delete next[cartKey(it)];
                return next;
              })
            }
          />
          <button
            className="qty-btn"
            onClick={() => {
              setQty(idx, it.quantity + 1);
              setQtyDraft((d) => ({ ...d, [cartKey(it)]: String(it.quantity + 1) }));
            }}
          >
            +
          </button>
        </div>
        <div className="pos-item-total">{fmtMoney(it.quantity * it.price)}</div>
      </div>
    );
  }

  const renderCartContent = () => (
    <div className="pos-cart-inner">
      <div className="pos-cart-head">
        <strong>Giỏ hàng</strong>
        <button className="btn-link danger" onClick={() => setCart([])}>
          Xóa hết
        </button>
      </div>

      <div className="pos-cart-items">
        {cart.length === 0 ? (
          <div className="empty">Chưa có sản phẩm nào.</div>
        ) : (
          cart.map((it, idx) => (
            <PosItem
              key={cartKey(it)}
              it={it}
              idx={idx}
              qtyDraft={qtyDraft}
              setQtyDraft={setQtyDraft}
              setQty={setQty}
              fmtMoney={fmtMoney}
            />
          ))
)}
      </div>

      <div className="pos-cart-foot">
        <div className="form-section">
          <div className="form-section-title">
            <span className="form-section-ic">👤</span>
            Khách hàng
          </div>
          <div className="field field-customer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <FieldLabel tone="info">
                Khách hàng
              </FieldLabel>
              <button type="button" className="btn btn-soft" style={{ padding: '6px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }} onClick={() => setCustModalOpen(true)}>
                + Thêm KH
              </button>
            </div>
            <CustomerSearch
              customers={customers}
              selectedId={customerId}
              selectedName={customerName}
              selectedPhone={phone}
              onSelect={handleCustomerSelect}
            />
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field field-name">
              <FieldLabel tone="primary">
                Tên khách
              </FieldLabel>
              <input className="field-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="field field-phone">
              <FieldLabel tone="success">
                SĐT
              </FieldLabel>
              <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">
            <span className="form-section-ic">💳</span>
            Thanh toán
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <FieldLabel tone="violet">
                Thanh toán
              </FieldLabel>
              <Select
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: 'cash', label: '💵 Tiền mặt', tone: 'badge-green' },
                  { value: 'transfer', label: '🏦 Chuyển khoản', tone: 'badge-blue' },
                  { value: 'card', label: '💳 Thẻ', tone: 'badge-purple' },
                  { value: 'cod', label: '🚚 COD', tone: 'badge-amber' }
                ]}
              />
            </div>
            <div className="field field-discount">
              <FieldLabel tone="danger">
                Giảm giá
              </FieldLabel>
              <input
                type="number"
                className="field-input"
                value={discount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <FieldLabel tone="success">
                Thuế VAT (%)
              </FieldLabel>
              <input
                type="number"
                min={0}
                max={100}
                className="field-input"
                value={taxRate}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div className="field field-surcharge">
              <FieldLabel tone="violet">
                Dùng điểm ({fmtNumber(custPoints)} điểm)
              </FieldLabel>
              <input
                type="number"
                min={0}
                max={maxRedeem}
                className="field-input"
                value={usedPoints}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPointsUsed(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="field">
            <label className={`preorder-toggle ${isPreorder ? 'on' : ''}`}>
              <input
                type="checkbox"
                className="preorder-check"
                checked={isPreorder}
                onChange={(e) => setIsPreorder(e.target.checked)}
              />
              <span className="preorder-box">✓</span>
              <span>
                <b>Đặt hàng trước (pre-order)</b>
                <small>Không trừ kho · nhận hàng sau</small>
              </span>
            </label>
          </div>
          <div className="hint">
            1 điểm = {fmtMoney(pointValue)}, tối đa {fmtNumber(maxRedeem)} điểm
            {custPoints > 0 && earnPreview > 0 ? ` · thanh toán sẽ tích ${fmtNumber(earnPreview)} điểm` : ''}.
          </div>
        </div>
        <div className="pos-totals">
          <div className="pos-total-row pos-subtotal">
            <span>Tạm tính</span>
            <b className="money-primary">{fmtMoney(subtotal)}</b>
          </div>
          {discount > 0 && (
            <div className="pos-total-row pos-discount">
              <span>Giảm giá</span>
              <b className="money-out">-{fmtMoney(discount)}</b>
            </div>
          )}
          {pointsValue > 0 && (
            <div className="pos-total-row pos-discount">
              <span>Điểm ({fmtNumber(usedPoints)}đ)</span>
              <b className="money-out">-{fmtMoney(pointsValue)}</b>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="pos-total-row pos-subtotal">
              <span>VAT {fmtNumber(taxRate)}%</span>
              <b className="money-debt">+{fmtMoney(taxAmount)}</b>
            </div>
          )}
          <div className="pos-total-row pos-grand">
            <span>TỔNG</span>
            <b>{fmtMoney(total)}</b>
          </div>
        </div>
        <button className="btn btn-primary pos-pay" onClick={handlePay} disabled={paying || cart.length === 0}>
          {paying ? 'Đang xử lý...' : `${isPreorder ? 'Đặt trước' : 'Thanh toán'} ${fmtMoney(total)}`}
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="empty">Đang tải dữ liệu...</div>;

  return (
    <div className="pos">
      <div className="pos-products">
        <div className="pos-search">
          <input
            type="search"
            placeholder="Tìm sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <select
            className="pos-cat-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="pos-cat-chips">
          <button className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="pos-grid">
          {filtered.map((p) => {
            const activeVariants = (p.variants || []).filter((v) => v.isActive);
            const hasVariants = activeVariants.length > 0;
            const variantStock = activeVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
            const out = !hasVariants && Number(p.stock) <= 0;
            const tier = bestTier(p.pricingTiers);
            const st = hasVariants
              ? variantStock <= 0 ? 'out' : variantStock <= 5 ? 'low' : 'ok'
              : stockStatus(Number(p.stock));
            const inCart = qtyInCart(p.id);
            const stockText = st === 'out' ? 'Hết hàng' : st === 'low' ? `Còn ${fmtNumber(hasVariants ? variantStock : p.stock)}` : `Tồn ${fmtNumber(hasVariants ? variantStock : p.stock)}`;
            return (
              <button
                key={p.id}
                className={`pos-product ${out ? 'out' : ''} ${inCart > 0 ? 'in-cart' : ''} st-${st}`}
                onClick={() => handleProductClick(p)}
                disabled={out}
                style={{ '--cat': catColor(p.category || '') } as CSSProperties}
              >
                <div className="pos-prod-img">
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="pos-prod-img-ph">🍽️</span>}
                  {hasVariants && (
                    <span className="pos-badge pos-badge-variant" title="Sản phẩm có biến thể">🧩</span>
                  )}
                  {inCart > 0 && (
                    <span className="pos-in-cart" title={`Đã có ${inCart} trong giỏ`}>{inCart}×</span>
                  )}
                  {out && (
                    <span className="pos-sold-out">
                      <span className="pos-sold-out-label">Hết hàng</span>
                    </span>
                  )}
                </div>
                <div className="pos-prod-body">
                  {p.category && (
                    <div className="pos-prod-cat" style={{ '--cat': catColor(p.category) } as CSSProperties}>
                      {p.category}
                    </div>
                  )}
                  <div className="pos-prod-name" title={p.name}>{p.name}</div>
                  <div className="pos-prod-price">
                    <span className="pos-prod-main">{fmtMoney(p.retailPrice)}</span>
                    {tier && Number(p.retailPrice) > 0 ? (
                      <span className="pos-prod-tier" title={`Mua ${tier.minQty}+ chỉ còn ${fmtMoney(tier.comboPrice)}`}>
                        Từ {fmtMoney(tier.comboPrice)}
                      </span>
                    ) : null}
                  </div>
                  <div className="pos-prod-meta">
                    <span className={`pos-stock ${st}`}>
                      <span className="dot"></span>
                      {stockText}
                    </span>
                    {!out && <span className="pos-add-hint">+ Thêm</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="empty">Không tìm thấy sản phẩm.</div>}
        </div>
      </div>

      <aside className="pos-cart card">{renderCartContent()}</aside>

      {cart.length > 0 && (
        <button className="pos-fab" onClick={() => setCartOpen(true)}>
          <span className="pos-fab-ico">🛒</span>
          <span className="pos-fab-count">{cartCount}</span>
          <span className="pos-fab-total">{fmtMoney(total)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="pos-sheet-overlay" onClick={() => setCartOpen(false)}>
          <div className="pos-sheet card" onClick={(e) => e.stopPropagation()}>
            <div className="pos-sheet-head">
              <strong>Giỏ hàng</strong>
              <button className="close-btn" onClick={() => setCartOpen(false)} aria-label="Đóng giỏ hàng">
                ✕
              </button>
            </div>
            <div className="pos-sheet-body">{renderCartContent()}</div>
          </div>
        </div>
      )}

      {variantPick && (
        <div className="modal-overlay" onClick={() => setVariantPick(null)} style={{ zIndex: 60 }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Chọn biến thể — {variantPick.name}</h3>
              <button className="close-btn" onClick={() => setVariantPick(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="muted" style={{ fontSize: 12.5 }}>
                Sản phẩm này có nhiều biến thể. Chọn biến thể để thêm vào giỏ.
              </div>
              {(variantPick.variants || [])
                .filter((v) => v.isActive)
                .map((v) => {
                  const out = Number(v.stock) <= 0;
                  return (
                    <button
                      key={v.id}
                      className="pos-variant-opt"
                      disabled={out}
                      onClick={() => {
                        addToCart(variantPick, v);
                        setVariantPick(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: '#fff',
                        cursor: 'pointer',
                        opacity: out ? 0.5 : 1
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {v.sku || '—'} · Tồn {fmtNumber(v.stock)}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
                        {out ? 'Hết hàng' : fmtMoney(v.price)}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {custModalOpen && (
        <div className="modal-overlay" onClick={() => setCustModalOpen(false)} style={{ zIndex: 60 }}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Thêm khách hàng mới</h3>
              <button className="close-btn" onClick={() => setCustModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-stack form-stack-single">
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="form-section-ic">👤</span>
                    Khách hàng mới
                  </div>
                  <div className="form-section-body">
                    <div className="field full">
                      <FieldLabel tone="primary" req>
                        Tên khách hàng
                      </FieldLabel>
                      <input
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        placeholder="Nhập tên"
                        autoFocus
                      />
                    </div>
                    <div className="field full">
                      <FieldLabel tone="info" req>
                        Số điện thoại
                      </FieldLabel>
                      <input
                        type="tel"
                        value={newCustPhone}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        placeholder="Nhập SĐT"
                        inputMode="tel"
                      />
                    </div>
                    <div className="field full">
                      <FieldLabel tone="muted">Địa chỉ</FieldLabel>
                      <input
                        value={newCustAddr}
                        onChange={(e) => setNewCustAddr(e.target.value)}
                        placeholder="Nhập địa chỉ (tùy chọn)"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => setCustModalOpen(false)}>Hủy</button>
                <button className="btn btn-primary" onClick={handleAddCustomer}>Lưu &amp; chọn</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printDoc && (
        <PrintInvoice kind="order" data={printDoc} store={storeInfo} onClose={() => setPrintDoc(null)} />
      )}
    </div>
  );
}