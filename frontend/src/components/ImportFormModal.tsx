import type { Product, Supplier } from '../types';
import { fmtMoney } from '../format';
import Modal from './Modal';
import Select from './ui/Select';
import FieldLabel from './ui/FieldLabel';
import ProductSearch from './ProductSearch';

export interface ImportFormItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  importPrice: number;
}

export interface ImportForm {
  supplierId: string;
  supplierName: string;
  carrier: string;
  shippingFee: number;
  paidAmount: number;
  items: ImportFormItem[];
}

export default function ImportFormModal({
  form,
  setForm,
  products,
  suppliers,
  selectSupplier,
  editing,
  onClose,
  onSave
}: {
  form: ImportForm;
  setForm: React.Dispatch<React.SetStateAction<ImportForm>>;
  products: Product[];
  suppliers: Supplier[];
  selectSupplier: (id: string) => void;
  editing: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  function addItem(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setForm({
      ...form,
      items: [
        ...form.items,
        {
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          quantity: 1,
          importPrice: Number(p.importPrice)
        }
      ]
    });
  }

  function updateItem(idx: number, patch: Partial<ImportFormItem>) {
    setForm({
      ...form,
      items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    });
  }

  function removeItem(idx: number) {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  }

  const total =
    form.items.reduce((s, it) => s + it.quantity * it.importPrice, 0) + form.shippingFee;

  // Khi đã chọn NCC: chỉ cho thêm sản phẩm của đúng NCC đó (+ sản phẩm chưa gán NCC)
  const availableProducts = form.supplierId
    ? products.filter((p) => p.supplierId === form.supplierId || !p.supplierId)
    : products;

  return (
    <Modal
      title={editing ? 'Sửa phiếu nhập' : 'Tạo phiếu nhập'}
      onClose={onClose}
      wide
      maxWidth={1180}
      footer={
        <>
          <div className="muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>
            Tổng cộng:{' '}
            <strong style={{ fontSize: 17, color: 'var(--primary)' }}>{fmtMoney(total)}</strong>
            <div style={{ fontSize: 12 }}>
              Còn nợ: {fmtMoney(total - form.paidAmount)}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={onSave}>
            {editing ? 'Lưu thay đổi' : 'Tạo phiếu'}
          </button>
        </>
      }
    >
      <div className="form-stack">
        <div className="form-section sec-products">
          <div className="form-section-title">
            <span className="form-section-ic">📦</span>
            Sản phẩm nhập
          </div>
          <div className="form-section-body">
            <div className="items-box full">
              {form.items.map((it, idx) => (
                <div className="item-row" key={idx}>
                  <input value={it.productName} readOnly disabled className="item-name-input" />
                  <input
                    type="number"
                    min={0}
                    placeholder="Số lượng"
                    className="item-qty-input"
                    value={it.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    min={0}
                    className="item-price-input"
                    value={it.importPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateItem(idx, { importPrice: Number(e.target.value) })}
                  />
                  <input
                    value={fmtMoney(it.quantity * it.importPrice)}
                    readOnly
                    disabled
                    className="item-total-input"
                  />
                  <button className="btn-link danger item-remove" onClick={() => removeItem(idx)}>
                    ✕
                  </button>
                </div>
              ))}
              {form.items.length === 0 && (
                <div className="empty" style={{ margin: '4px 0 10px' }}>
                  Chưa có sản phẩm nào — chọn bên dưới để thêm.
                </div>
              )}
              {form.supplierId ? (
                <div className="items-add-row">
                  <ProductSearch
                    importMode
                    placeholder="+ Thêm sản phẩm (của NCC này)..."
                    products={availableProducts}
                    addedIds={form.items.map((it) => it.productId)}
                    onAdd={addItem}
                  />
                </div>
              ) : (
                <div className="hint" style={{ marginTop: 4 }}>
                  👆 Chọn <b>nhà cung cấp</b> ở cột phải trước, sau đó mới thêm sản phẩm.
                </div>
              )}
              {form.supplierId && (
                <div className="hint">
                  Chỉ hiện sản phẩm của nhà cung cấp này ({availableProducts.length} sản phẩm)
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-section sec-vendor">
          <div className="form-section-title">
            <span className="form-section-ic">🏪</span>
            Nhà cung cấp &amp; vận chuyển
          </div>
          <div className="form-section-body">
            <div className="field full">
              <FieldLabel tone="primary">Nhà cung cấp</FieldLabel>
              <Select
                value={form.supplierId}
                placeholder="— Chọn NCC —"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(v) => selectSupplier(v)}
              />
            </div>
            <div className="field full">
              <FieldLabel tone="info">Đơn vị vận chuyển</FieldLabel>
              <input
                className="field-input"
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="form-section sec-import-costs">
          <div className="form-section-title">
            <span className="form-section-ic">💰</span>
            Chi phí &amp; thanh toán NCC
          </div>
          <div className="form-section-body">
            <div className="field">
              <FieldLabel tone="amber">Phí vận chuyển (VNĐ)</FieldLabel>
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.shippingFee}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm({ ...form, shippingFee: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <FieldLabel tone="success">Đã trả NCC (VNĐ)</FieldLabel>
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.paidAmount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
              />
              <div className="hint">Còn nợ NCC: {fmtMoney(total - form.paidAmount)}</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}