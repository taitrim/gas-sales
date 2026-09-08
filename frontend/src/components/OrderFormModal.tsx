import { Fragment, useState } from 'react';
import { api } from '../api';
import type { Product, Supplier } from '../types';
import { fmtMoney, fmtNumber, ORDER_STATUS, PAYMENT_STATUS } from '../format';
import Modal from './Modal';
import CustomerSearch from './CustomerSearch';
import ProductSearch from './ProductSearch';
import Select from './ui/Select';
import DatePicker from './ui/DatePicker';
import FieldLabel from './ui/FieldLabel';
import { bestTier, effectivePrice } from '../pricing';

export interface OrderFormItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  costPrice: number;
}

export interface OrderForm {
  customerId: string;
  customerName: string;
  phone: string;
  address: string;
  orderType: string;
  shippingMethod: string;
  carrier: string;
  dropshipSupplierId: string;
  shippingFee: number;
  discount: number;
  promoCode: string;
  surcharge: number;
  paymentMethod: string;
  status: string;
  paymentStatus: string;
  deliveryDate: string;
  note: string;
  taxRate: number;
  pointsUsed: number;
  isPreorder: boolean;
  items: OrderFormItem[];
}

export const ORDER_STATUS_ICON: Record<string, string> = {
  pending: '⏳',
  processing: '🔄',
  waiting_payment: '💳',
  completed: '✅',
  cancelled: '❌'
};

export const PAYMENT_STATUS_ICON: Record<string, string> = {
  unpaid: '❌',
  partial: '⏳',
  paid: '✅'
};

export function emptyOrderForm(): OrderForm {
  return {
    customerId: '',
    customerName: '',
    phone: '',
    address: '',
    orderType: 'online',
    shippingMethod: 'delivery',
    carrier: '',
    dropshipSupplierId: '',
    shippingFee: 0,
    discount: 0,
    promoCode: '',
    surcharge: 0,
    paymentMethod: 'cash',
    status: 'pending',
    paymentStatus: 'unpaid',
    deliveryDate: '',
    note: '',
    taxRate: 0,
    pointsUsed: 0,
    isPreorder: false,
    items: []
  };
}

export default function OrderFormModal({
  form,
  setForm,
  products,
  suppliers,
  customers,
  editing,
  onClose,
  onSave,
  onCustomerAdded,
  pointValue,
  pointsRate
}: {
  form: OrderForm;
  setForm: React.Dispatch<React.SetStateAction<OrderForm>>;
  products: Product[];
  suppliers: Supplier[];
  customers: { id: string; name: string; phone: string; address: string; points?: number }[];
  editing: boolean;
  onClose: () => void;
  onSave: () => void;
  onCustomerAdded: (cust: { id: string; name: string; phone: string; address: string }) => void;
  pointValue?: number;
  pointsRate?: number;
}) {
  const [qty, setQty] = useState<Record<number, string>>({});
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddr, setNewCustAddr] = useState('');

  async function handleAddCustomer() {
    if (!newCustName.trim() || !newCustPhone.trim()) {
      alert('Nhập tên và SĐT khách hàng.');
      return;
    }
    try {
      const res = await api.addCustomer({ name: newCustName.trim(), phone: newCustPhone.trim(), address: newCustAddr.trim() });
      const newCust = { id: res.id, name: newCustName.trim(), phone: newCustPhone.trim(), address: newCustAddr.trim() };
      onCustomerAdded(newCust);
      const c = customers.find((x) => x.id === res.id) || newCust;
      setForm({
        ...form,
        customerId: res.id,
        customerName: c.name,
        phone: c.phone,
        address: c.address
      });
      setCustModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddr('');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function addItem(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const existing = form.items.find((it) => it.productId === productId);
    if (existing) {
      const idx = form.items.indexOf(existing);
      updateItem(idx, {
        quantity: existing.quantity + 1,
        price: effectivePrice(p, existing.quantity + 1, form.orderType === 'wholesale')
      });
      return;
    }
    setForm({
      ...form,
      items: [
        ...form.items,
        {
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          quantity: 1,
          price: effectivePrice(p, 1, form.orderType === 'wholesale'),
          costPrice: Number(p.importPrice)
        }
      ]
    });
  }

  function updateItem(idx: number, patch: Partial<OrderFormItem>) {
    setForm({
      ...form,
      items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    });
  }

  function setItemQuantity(idx: number, q: number) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => {
        if (i !== idx) return it;
        const product = products.find((p) => p.id === it.productId);
        return {
          ...it,
          quantity: q,
          price: product ? effectivePrice(product, q, f.orderType === 'wholesale') : it.price
        };
      })
    }));
  }

  function changeOrderType(v: string) {
    const wholesale = v === 'wholesale';
    setForm((f) => ({
      ...f,
      orderType: v,
      items: f.items.map((it) => {
        const product = products.find((p) => p.id === it.productId);
        if (!product) return it;
        return { ...it, price: effectivePrice(product, it.quantity, wholesale) };
      })
    }));
  }

  function removeItem(idx: number) {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  }

  function handleCustomerSelect(c: { id: string; name: string; phone?: string; address?: string }) {
    setForm({
      ...form,
      customerId: c.id,
      customerName: c.name || '',
      phone: c.phone || '',
      address: c.address || ''
    });
  }

  const subtotal = form.items.reduce((s, it) => s + it.quantity * it.price, 0);
  const pv = pointValue || 1000;
  const pointsValue = (Number(form.pointsUsed) || 0) * pv;
  const taxAmount = Math.max(0, Math.round((subtotal - form.discount - pointsValue) * ((Number(form.taxRate) || 0) / 100)));
  const totalAmount = Math.max(0, subtotal - form.discount - pointsValue + taxAmount + form.shippingFee + form.surcharge);

  return (
      <Fragment>
        <Modal
          title={editing ? 'Sửa đơn hàng' : 'Tạo đơn hàng'}
          onClose={onClose}
          wide
          maxWidth={1180}
          footer={
            <>
              <div className="muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>
                Tổng cộng:{' '}
                <strong style={{ fontSize: 17, color: 'var(--primary)' }}>{fmtMoney(totalAmount)}</strong>
                {(() => {
                  const rate = pointsRate || 1;
                  const earn = Math.floor(totalAmount / 1000) * rate;
                  return form.paymentStatus === 'paid' && (form.customerId || form.customerName)
                    ? <span style={{ marginLeft: 12, color: 'var(--success)', fontWeight: 600 }}>⭐ Tích {fmtNumber(earn)} điểm</span>
                    : null;
                })()}
              </div>
              <button className="btn btn-ghost" onClick={onClose}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={onSave}>
                {editing ? 'Lưu thay đổi' : 'Tạo đơn'}
              </button>
            </>
          }
        >
          <div className="form-stack">
            <div className="form-section sec-products">
              <div className="form-section-title">
                <span className="form-section-ic">🛍️</span>
                Sản phẩm
              </div>
              <div className="form-section-body">
                <div className="items-box full">
          {form.items.map((it, idx) => {
            const product = products.find((p) => p.id === it.productId);
            const maxStock = product ? Number(product.stock) + (editing ? it.quantity : 0) : Infinity;
            return (
              <div className="item-row" key={idx}>
                <input
                  value={it.productName}
                  readOnly
                  disabled
                  className={`item-name-input ${product && bestTier(product.pricingTiers) ? 'has-tier' : ''}`}
                />
                {form.orderType === 'wholesale' && product && Number(product.wholesalePrice) > 0 ? (
                  <div
                    className="tier-hint"
                    style={{ gridColumn: '1 / -1', marginTop: -4, color: 'var(--primary-dark)' }}
                  >
                    Giá sỉ: {fmtMoney(product.wholesalePrice)}/đơn vị
                  </div>
                ) : (
                  product &&
                  bestTier(product.pricingTiers) && (
                    <div className="tier-hint" style={{ gridColumn: '1 / -1', marginTop: -4 }}>
                      Mua ≥{fmtNumber(bestTier(product.pricingTiers)?.minQty)} →{' '}
                      {fmtMoney(bestTier(product.pricingTiers)?.comboPrice)}/đơn vị (giá tự cập nhật theo số lượng)
                    </div>
                  )
                )}
                <input
                  type="number"
                  min={0}
                  max={maxStock}
                  value={qty[idx] ?? it.quantity}
                  placeholder="Số lượng"
                  className="item-qty-input"
                  onChange={(e) => {
                    setQty({ ...qty, [idx]: e.target.value });
                    setItemQuantity(idx, Number(e.target.value));
                  }}
                />
                <input
                  type="number"
                  value={it.price}
                  className="item-price-input"
                  onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                />
                <input value={fmtMoney(it.quantity * it.price)} readOnly disabled className="item-total-input" />
                <button className="btn-link danger item-remove" onClick={() => removeItem(idx)}>
                  ✕
                </button>
              </div>
            );
          })}
                  <div className="items-add-row">
                    <ProductSearch
                      products={products}
                      addedIds={form.items.map((it) => it.productId)}
                      onAdd={addItem}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section sec-customer">
              <div className="form-section-title">
                <span className="form-section-ic">👤</span>
                Khách hàng
              </div>
              <div className="form-section-body">
                <div className="field field-customer full">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <FieldLabel tone="info">
                      Khách hàng
                    </FieldLabel>
                    <button type="button" className="btn btn-soft" style={{ padding: '6px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }} onClick={() => setCustModalOpen(true)}>
                      + Thêm KH
                    </button>
                  </div>
                  <CustomerSearch
                    customers={customers}
                    selectedId={form.customerId}
                    selectedName={form.customerName}
                    selectedPhone={form.phone}
                    onSelect={handleCustomerSelect}
                    collapsed
                  />
                </div>
              </div>
            </div>

            <div className="form-section sec-order">
              <div className="form-section-title">
                <span className="form-section-ic">🧾</span>
                Đơn hàng
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="violet">
                    Loại đơn
                  </FieldLabel>
                  <Select
                    value={form.orderType}
                    onChange={changeOrderType}
                    options={[
                      { value: 'online', label: '🌐 Online', tone: 'badge-blue' },
                      { value: 'retail', label: '🏬 Bán lẻ', tone: 'badge-green' },
                      { value: 'wholesale', label: '📦 Bán sỉ', tone: 'badge-purple' }
                    ]}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="amber">
                    Phương thức giao
                  </FieldLabel>
                  <Select
                    value={form.shippingMethod}
                    onChange={(v) => {
                      const next = { ...form, shippingMethod: v };
                      // Khách tự lấy => mặc định đơn hoàn thành + đã thanh toán
                      if (v === 'pickUp') {
                        next.status = 'completed';
                        next.paymentStatus = 'paid';
                      }
                      setForm(next);
                    }}
                    options={[
                      { value: 'delivery', label: '🚚 Giao hàng', tone: 'badge-blue' },
                      { value: 'courier', label: '🛵 Shipper', tone: 'badge-amber' },
                      { value: 'dropship', label: '📦 Drop-ship', tone: 'badge-purple' },
                      { value: 'pickUp', label: '🏪 Khách tự lấy', tone: 'badge-green' }
                    ]}
                  />
                </div>
                {form.shippingMethod === 'dropship' && (
                  <div className="field full">
                    <FieldLabel tone="violet">
                      NCC drop-ship
                    </FieldLabel>
                    <Select
                      value={form.dropshipSupplierId}
                      onChange={(v) => setForm({ ...form, dropshipSupplierId: v })}
                      placeholder="— Chọn NCC —"
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                )}
                <div className="field full">
                  <label className={`preorder-toggle ${form.isPreorder ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      className="preorder-check"
                      checked={form.isPreorder}
                      onChange={(e) => setForm({ ...form, isPreorder: e.target.checked })}
                    />
                    <span className="preorder-box">✓</span>
                    <span>
                      <b>Đặt hàng trước (pre-order)</b>
                      <small>Không trừ kho · chuyển thành đơn thường khi hoàn thành</small>
                    </span>
                  </label>
                </div>
                {form.isPreorder && (
                  <div className="field full field-date">
                    <FieldLabel tone="warning" req>
                      Ngày giao dự kiến
                    </FieldLabel>
                    <DatePicker
                      value={form.deliveryDate}
                      onChange={(v) => setForm({ ...form, deliveryDate: v })}
                      placeholder="Chọn ngày giao..."
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="form-section sec-payment">
              <div className="form-section-title">
                <span className="form-section-ic">💳</span>
                Thanh toán & trạng thái
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="info">
                    Trạng thái
                  </FieldLabel>
                  <Select
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                    options={Object.entries(ORDER_STATUS).map(([k, v]) => ({
                      value: k,
                      label: `${ORDER_STATUS_ICON[k] || ''} ${v.label}`,
                      tone: v.cls
                    }))}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="violet">
                    Thanh toán
                  </FieldLabel>
                  <Select
                    value={form.paymentStatus}
                    onChange={(v) => setForm({ ...form, paymentStatus: v })}
                    options={Object.entries(PAYMENT_STATUS).map(([k, v]) => ({
                      value: k,
                      label: `${PAYMENT_STATUS_ICON[k] || ''} ${v.label}`,
                      tone: v.cls
                    }))}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="success">
                    Phương thức TT
                  </FieldLabel>
                  <Select
                    value={form.paymentMethod}
                    onChange={(v) => setForm({ ...form, paymentMethod: v })}
                    options={[
                      { value: 'cash', label: 'Tiền mặt', tone: 'badge-green' },
                      { value: 'transfer', label: 'Chuyển khoản', tone: 'badge-blue' },
                      { value: 'cod', label: 'COD', tone: 'badge-amber' },
                      { value: 'card', label: 'Thẻ', tone: 'badge-purple' }
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="form-section sec-costs">
              <div className="form-section-title">
                <span className="form-section-ic">💰</span>
                Chi phí
              </div>
              <div className="form-section-body">
                <div className="field field-shipping">
                  <FieldLabel tone="amber">
                    Phí ship
                  </FieldLabel>
                  <input type="number" className="field-input" value={form.shippingFee} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, shippingFee: Number(e.target.value) })} />
                </div>
                <div className="field field-discount">
                  <FieldLabel tone="danger">
                    Giảm giá
                  </FieldLabel>
                  <input type="number" className="field-input" value={form.discount} disabled={!!form.promoCode.trim()} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
                  {form.promoCode.trim() && <div className="hint">Chiết khấu sẽ do mã giảm giá tính tự động.</div>}
                </div>
                <div className="field field-promo">
                  <FieldLabel tone="warning">
                    Mã khuyến mãi
                  </FieldLabel>
                  <input className="field-input" value={form.promoCode} placeholder="VD: GIAM10" onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })} />
                </div>
                <div className="field field-surcharge">
                  <FieldLabel tone="violet">
                    Thuế VAT (%)
                  </FieldLabel>
                  <input type="number" min={0} max={100} className="field-input" value={form.taxRate} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} />
                </div>
                <div className="field field-surcharge">
                  <FieldLabel tone="violet">
                    Phụ thu
                  </FieldLabel>
                  <input type="number" className="field-input" value={form.surcharge} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, surcharge: Number(e.target.value) })} />
                </div>
                <div className="field field-surcharge">
                  <FieldLabel tone="success">
                    Dùng điểm khách
                  </FieldLabel>
                  <input type="number" min={0} className="field-input" value={form.pointsUsed} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, pointsUsed: Number(e.target.value) })} />
                  <div className="hint">
                    1 điểm = {fmtMoney(pv)}
                    {(() => {
                      const sel = customers.find((c) => c.id === form.customerId);
                      return sel ? ` · khách có ${fmtNumber(Number(sel.points) || 0)} điểm` : '';
                    })()}
                    {pointsValue > 0 ? ` → giảm ${fmtMoney(pointsValue)}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section sec-note">
              <div className="form-section-title">
                <span className="form-section-ic">📝</span>
                Ghi chú
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <textarea className="field-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
                </div>
              </div>
            </div>
          </div>
</Modal>
        {custModalOpen && (
          <div className="modal-overlay" onClick={() => setCustModalOpen(false)} style={{ zIndex: 200 }}>
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
      </Fragment>
    );
  }
