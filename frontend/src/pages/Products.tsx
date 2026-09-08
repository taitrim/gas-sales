import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Category, ComboComponent, MenuItem, PriceHistoryEntry, Product, ProductVariant, Supplier } from '../types';
import { fmtDateTime, fmtMoney, fmtNumber } from '../format';
import { bestTier, type PricingTier } from '../pricing';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { exportCSV } from '../export';
import { useToast } from '../components/Toast';

type RawTier = { minQty: number; comboPrice?: number; price?: number };

function toTierArr(tiers: RawTier | RawTier[] | undefined): RawTier[] {
  if (!tiers) return [];
  return Array.isArray(tiers) ? tiers : [tiers];
}

const CATEGORY_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

const emptyForm = {
  sku: '',
  name: '',
  category: '',
  supplierId: '',
  importPrice: 0,
  retailPrice: 0,
  wholesalePrice: 0,
  stock: 0,
  unit: '',
  image: '',
  pricingTiers: [] as PricingTier[]
};

const MAX_IMAGE = 1024;

function resizeImage(file: File): Promise<{ dataUrl: string; mimeType: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không đọc được ảnh.'));
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      resolve({ dataUrl: canvas.toDataURL(mimeType), mimeType, fileName: file.name });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh.'));
    };
    img.src = url;
  });
}

export default function Products() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const stockFilter = searchParams.get('stock') || '';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploading, setUploading] = useState(false);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [adjQty, setAdjQty] = useState(0);
  const [adjNote, setAdjNote] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);

  const [detail, setDetail] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<'variants' | 'combos' | 'prices'>('variants');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [combos, setCombos] = useState<ComboComponent[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [variantForm, setVariantForm] = useState<{ id?: string; name: string; sku: string; price: number; stock: number; isActive: boolean } | null>(null);
  const [comboForm, setComboForm] = useState<{ productId: string; quantity: number }[]>([]);
  const [savingDetail, setSavingDetail] = useState(false);

  // Quản lý danh mục
  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState<{ id?: string; name: string; color: string }>({ name: '', color: CATEGORY_COLORS[0] });
  const [savingCat, setSavingCat] = useState(false);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  // Nhận diện thực đơn
  const [menuModal, setMenuModal] = useState(false);
  const [menuImage, setMenuImage] = useState<string>('');
  const [menuMime, setMenuMime] = useState('image/png');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [menuChecks, setMenuChecks] = useState<Record<number, boolean>>({});
  const [creatingMenu, setCreatingMenu] = useState(false);
  const menuFileRef = useRef<HTMLInputElement>(null);

  const {
    items: products,
    total,
    page,
    setPage,
    search,
    setSearch,
    loading,
    reload
  } = usePaginatedList<Product>({
    fetcher: (p) =>
      api.listProducts({
        page: p.page,
        pageSize: p.pageSize,
        search: p.search,
        stock: stockFilter || undefined,
        category: activeCategory || undefined
      })
  });

  const reloadCategories = useCallback(() => {
    api
      .listCategories()
      .then((r) => setCategories(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getSuppliers()
      .then(setSuppliers)
      .catch(() => {});
    reloadCategories();
  }, [reloadCategories]);

  function openCreate() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setForm({
      sku: p.sku || '',
      name: p.name,
      category: p.category || '',
      supplierId: p.supplierId || '',
      importPrice: Number(p.importPrice),
      retailPrice: Number(p.retailPrice),
      wholesalePrice: Number(p.wholesalePrice),
      stock: Number(p.stock),
      unit: p.unit || '',
      image: p.image || '',
      pricingTiers: toTierArr(p.pricingTiers).map((t) => ({
        minQty: Number(t.minQty),
        comboPrice: Number(t.comboPrice ?? t.price)
      }))
    });
    setEditing(p);
    setShowForm(true);
  }

  function setTier(i: number, key: keyof PricingTier, v: number) {
    setForm((f) => ({
      ...f,
      pricingTiers: f.pricingTiers.map((t, idx) => (idx === i ? { ...t, [key]: v } : t))
    }));
  }

  function addTier() {
    setForm((f) => ({ ...f, pricingTiers: [...f.pricingTiers, { minQty: 0, comboPrice: 0 }] }));
  }

  function removeTier(i: number) {
    setForm((f) => ({ ...f, pricingTiers: f.pricingTiers.filter((_, idx) => idx !== i) }));
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { dataUrl, mimeType, fileName } = await resizeImage(file);
      const path = await api.uploadImage(dataUrl.split(',')[1], mimeType, fileName);
      setForm((f) => ({ ...f, image: path }));
      toast('Đã tải ảnh lên.');
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên sản phẩm.', 'err');
      return;
    }
    try {
      if (editing) {
        await api.updateProduct({ ...form, id: editing.id });
        toast('Đã cập nhật sản phẩm.');
      } else {
        await api.addProduct(form);
        toast('Đã thêm sản phẩm.');
      }
      setShowForm(false);
      reload();
      reloadCategories();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteProduct(deleting.id);
      toast('Đã xóa sản phẩm.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function openAdjust(p: Product) {
    setAdjusting(p);
    setAdjQty(0);
    setAdjNote('');
  }

  async function handleAdjust() {
    if (!adjusting) return;
    if (!adjQty || adjQty === 0) {
      toast('Nhập số lượng cần điều chỉnh (khác 0).', 'err');
      return;
    }
    setSavingAdj(true);
    try {
      await api.createStockAdjustment({
        productId: adjusting.id,
        quantity: adjQty,
        note: adjNote.trim() || 'Điều chỉnh kho'
      });
      toast('Đã điều chỉnh tồn kho.');
      setAdjusting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSavingAdj(false);
    }
  }

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name || '—';

  function openDetail(p: Product) {
    setDetail(p);
    setDetailTab('variants');
    Promise.all([api.getProductVariants(p.id), api.getProductCombos(p.id), api.getProductPriceHistory(p.id)])
      .then(([v, c, h]) => {
        setVariants(v);
        setCombos(c);
        setPriceHistory(h);
      })
      .catch((err) => toast((err as Error).message, 'err'));
  }

  async function reloadDetail(p: Product) {
    Promise.all([api.getProductVariants(p.id), api.getProductCombos(p.id), api.getProductPriceHistory(p.id)])
      .then(([v, c, h]) => {
        setVariants(v);
        setCombos(c);
        setPriceHistory(h);
      })
      .catch(() => {});
  }

  async function handleSaveVariant() {
    if (!detail || !variantForm) return;
    if (!variantForm.name.trim()) {
      toast('Nhập tên biến thể.', 'err');
      return;
    }
    setSavingDetail(true);
    try {
      if (variantForm.id) {
        await api.updateVariant({ ...variantForm, id: variantForm.id });
        toast('Đã cập nhật biến thể.');
      } else {
        await api.addVariant({
          productId: detail.id,
          name: variantForm.name,
          sku: variantForm.sku,
          price: Number(variantForm.price),
          stock: Number(variantForm.stock)
        });
        toast('Đã thêm biến thể.');
      }
      setVariantForm(null);
      reloadDetail(detail);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleDeleteVariant(v: ProductVariant) {
    try {
      await api.deleteVariant(v.id);
      toast('Đã xóa biến thể.');
      if (detail) reloadDetail(detail);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function setComboRow(i: number, key: keyof { productId: string; quantity: number }, v: string | number) {
    setComboForm((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  }

  async function handleSaveCombos() {
    if (!detail) return;
    const items = comboForm.filter((r) => r.productId && Number(r.quantity) > 0);
    if (items.length === 0) {
      toast('Thêm ít nhất 1 thành phần.', 'err');
      return;
    }
    setSavingDetail(true);
    try {
      await api.updateProduct({
        id: detail.id,
        name: detail.name,
        sku: detail.sku,
        category: detail.category,
        supplierId: detail.supplierId,
        importPrice: Number(detail.importPrice),
        retailPrice: Number(detail.retailPrice),
        wholesalePrice: Number(detail.wholesalePrice),
        stock: Number(detail.stock),
        unit: detail.unit,
        image: detail.image,
        pricingTiers: toTierArr(detail.pricingTiers),
        isCombo: true,
        comboComponents: items
      });
      toast('Đã lưu combo.');
      reloadDetail(detail);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSavingDetail(false);
    }
  }

  function openComboEditor() {
    setComboForm(detail?.comboComponents?.length ? detail.comboComponents.map((c) => ({ productId: c.productId, quantity: Number(c.quantity) })) : []);
  }

  const fieldLabels: Record<string, string> = {
    retail_price: 'Giá bán',
    wholesale_price: 'Giá sỉ',
    import_price: 'Giá nhập'
  };

  async function exportProducts() {
    try {
      const all = await api.getProducts();
      exportCSV(
        ['SKU', 'Tên sản phẩm', 'Danh mục', 'NCC', 'Giá nhập', 'Giá bán', 'Giá sỉ', 'Tồn kho', 'Đơn vị'],
        all.map((p) => [p.sku, p.name, p.category, supplierName(p.supplierId), p.importPrice, p.retailPrice, p.wholesalePrice, p.stock, p.unit]),
        'san-pham.csv'
      );
      toast('Đã xuất CSV.');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  // ---- Quản lý danh mục ----
  function openAddCategory() {
    setCatForm({ name: '', color: CATEGORY_COLORS[0] });
  }

  function openEditCategory(c: Category) {
    setCatForm({ id: c.id, name: c.name, color: c.color || CATEGORY_COLORS[0] });
  }

  async function handleSaveCategory() {
    if (!catForm.name.trim()) {
      toast('Nhập tên danh mục.', 'err');
      return;
    }
    setSavingCat(true);
    try {
      if (catForm.id) {
        await api.updateCategory(catForm);
        toast('Đã cập nhật danh mục.');
      } else {
        await api.addCategory(catForm);
        toast('Đã thêm danh mục.');
      }
      setCatModal(false);
      reloadCategories();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSavingCat(false);
    }
  }

  async function handleDeleteCategory() {
    if (!deletingCat) return;
    try {
      await api.deleteCategory(deletingCat.id);
      toast('Đã xóa danh mục.');
      setDeletingCat(null);
      reloadCategories();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  // ---- Nhận diện thực đơn ----
  function handlePickMenu(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setMenuImage(dataUrl);
      setMenuMime(file.type || 'image/png');
      setMenuItems([]);
      setMenuChecks({});
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  async function handleRecognize() {
    if (!menuImage) {
      toast('Chọn ảnh menu trước.', 'err');
      return;
    }
    setRecognizing(true);
    try {
      const base64 = menuImage.split(',')[1];
      const res = await api.recognizeMenuItems(base64, menuMime);
      setMenuItems(res.items);
      setMenuChecks(Object.fromEntries(res.items.map((_, i) => [i, true])));
      if (!res.items.length) toast('Không nhận diện được món nào. Thử ảnh rõ hơn.');
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setRecognizing(false);
    }
  }

  function updateMenuItem(i: number, key: keyof MenuItem, v: string | number) {
    setMenuItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: key === 'price' ? Number(v) : String(v) } : it)));
  }

  async function handleCreateFromMenu() {
    const selected = menuItems.filter((_, i) => menuChecks[i]);
    const valid = selected.filter((it) => it.name.trim());
    if (!valid.length) {
      toast('Chọn ít nhất 1 món để tạo.', 'err');
      return;
    }
    setCreatingMenu(true);
    try {
      for (const it of valid) {
        await api.addProduct({
          sku: '',
          name: it.name.trim(),
          category: activeCategory || '',
          supplierId: '',
          importPrice: 0,
          retailPrice: Number(it.price) || 0,
          wholesalePrice: 0,
          stock: 0,
          unit: it.unit || '',
          image: menuImage,
          pricingTiers: []
        });
      }
      toast(`Đã tạo ${valid.length} sản phẩm.`);
      setMenuModal(false);
      setMenuItems([]);
      setMenuImage('');
      reload();
      reloadCategories();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setCreatingMenu(false);
    }
  }

  const catColor = (name: string) => categories.find((c) => c.name === name)?.color || '';

  return (
    <div>
      <div className="page-head">
        <h1>Sản phẩm</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setMenuModal(true)} title="Nhận diện thực đơn từ ảnh bằng AI">
            🍽️ Tạo từ ảnh menu
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            + Thêm sản phẩm
          </button>
        </div>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-search">
          <input
            type="search"
            placeholder="Tìm theo tên, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted toolbar-count">{total} sản phẩm</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setCatModal(true)} title="Quản lý danh mục">
            🗂️ Danh mục
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportProducts} title="Xuất CSV toàn bộ sản phẩm">
            ⬇ CSV
          </button>
        </div>
      </div>

      {(categories.length > 0 || activeCategory) && (
        <div className="cat-filter">
          <button
            className={`chip ${!activeCategory ? 'active' : ''}`}
            onClick={() => setActiveCategory('')}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip ${activeCategory === c.name ? 'active' : ''}`}
              style={activeCategory === c.name ? { background: c.color || undefined, borderColor: c.color || undefined, color: '#fff' } : undefined}
              onClick={() => setActiveCategory((prev) => (prev === c.name ? '' : c.name))}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : products.length === 0 ? (
        <div className="empty">Không có sản phẩm nào.</div>
      ) : (
        <>
          <div className="data-cards products-cards">
            {products.map((p) => {
              const low = Number(p.stock) <= 5;
              return (
                <div className="product-card" key={p.id} onClick={() => openDetail(p)}>
                  <div className="pc-img">
                    {p.image ? <img src={p.image} alt="" /> : <span>🍽️</span>}
                    {low && <span className="pc-low">Sắp hết</span>}
                  </div>
                  <div className="pc-body">
                    <div className="pc-name" title={p.name}>{p.name}</div>
                    {p.category ? (
                      <span className="pc-cat" style={catColor(p.category) ? { background: `${catColor(p.category)}1a`, color: catColor(p.category) } : undefined}>
                        {p.category}
                      </span>
                    ) : (
                      <span className="pc-cat muted">—</span>
                    )}
                    <div className="pc-price">{fmtMoney(p.retailPrice)}</div>
                    <div className="pc-foot">
                      <span className={low ? 'pc-stock danger' : 'pc-stock'}>Tồn: {fmtNumber(p.stock, 2)}</span>
                      {p.unit && <span className="muted">{p.unit}</span>}
                    </div>
                  </div>
                  <div className="pc-actions">
                    <button className="btn-link" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                      Sửa
                    </button>
                    <button className="btn-link" onClick={(e) => { e.stopPropagation(); openAdjust(p); }}>
                      Kho
                    </button>
                    <button className="btn-link danger" onClick={(e) => { e.stopPropagation(); setDeleting(p); }}>
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
        </>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Lưu
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🖼️</span>
                Hình ảnh &amp; định danh
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="primary" req>
                    Tên sản phẩm
                  </FieldLabel>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="muted">SKU</FieldLabel>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="violet">Danh mục</FieldLabel>
                  <input
                    list="category-list"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Chọn hoặc nhập tên mới"
                  />
                  <datalist id="category-list">
                    {categories.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <FieldLabel tone="info">Nhà cung cấp</FieldLabel>
                  <Select
                    value={form.supplierId}
                    placeholder="— Chọn NCC —"
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    onChange={(v) => setForm({ ...form, supplierId: v })}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="primary">Ảnh sản phẩm</FieldLabel>
                  <div className="img-upload">
                    {form.image ? <img src={form.image} alt="" /> : <div className="img-placeholder">Chưa có ảnh</div>}
                    <div className="img-actions">
                      <button className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => document.getElementById('prod-img-input')?.click()}>
                        {uploading ? 'Đang tải...' : form.image ? 'Đổi ảnh' : 'Chọn ảnh'}
                      </button>
                      {form.image && (
                        <button className="btn btn-danger-outline btn-sm" onClick={() => setForm((f) => ({ ...f, image: '' }))}>
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    id="prod-img-input"
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handlePickImage}
                  />
                  <div className="hint">Tự động nén về tối đa 1024px. Hoặc dán URL ảnh trực tiếp.</div>
                </div>
                <div className="field full">
                  <FieldLabel tone="muted">URL ảnh</FieldLabel>
                  <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">💰</span>
                Giá bán
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="amber">Giá nhập (VNĐ)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.importPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, importPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="success">Giá bán lẻ (VNĐ)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.retailPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, retailPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="field field-surcharge">
                  <FieldLabel tone="info">Giá sỉ (VNĐ)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.wholesalePrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, wholesalePrice: Number(e.target.value) })}
                  />
                  <div className="hint">Áp dụng tự động khi lập đơn loại "Bán sỉ". Để trống/0 nếu không bán sỉ.</div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">📦</span>
                Kho hàng
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="success">Tồn kho ban đầu</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.stock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="muted">Đơn vị</FieldLabel>
                  <input
                    value={form.unit}
                    placeholder="VD: cái, hộp, kg..."
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🏷️</span>
                Giá bán theo mốc
              </div>
              {form.pricingTiers.length === 0 && (
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Chưa có mốc giá. Ví dụ: mua từ 40 → 2.250đ/sản phẩm.
                </div>
              )}
              {form.pricingTiers.map((t, i) => (
                <div className="tier-row" key={i}>
                  <span className="tier-label">Mua từ</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="SL"
                    value={t.minQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setTier(i, 'minQty', Number(e.target.value))}
                  />
                  <span className="tier-label">→ giá combo</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="VNĐ"
                    value={t.comboPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setTier(i, 'comboPrice', Number(e.target.value))}
                  />
                  <button type="button" className="btn-ghost btn-sm tier-del" onClick={() => removeTier(i)}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={addTier}>
                + Thêm mốc giá
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa sản phẩm"
          message={`Bạn có chắc muốn xóa "${deleting.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {adjusting && (
        <Modal
          title={`Điều chỉnh tồn kho — ${adjusting.name}`}
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setAdjusting(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleAdjust} disabled={savingAdj}>
                {savingAdj ? 'Đang lưu...' : 'Lưu điều chỉnh'}
              </button>
            </>
          }
        >
          <div className="stats-grid" style={{ marginBottom: 14 }}>
            <div className="stat-card tone-slate">
              <div className="stat-icon">📦</div>
              <div className="stat-body">
                <div className="label">Tồn kho hiện tại</div>
                <div className="value">{fmtNumber(adjusting.stock, 2)}</div>
              </div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-icon">🏷️</div>
              <div className="stat-body">
                <div className="label">Giá bán</div>
                <div className="value">{fmtMoney(adjusting.retailPrice)}</div>
              </div>
            </div>
          </div>
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">⚡</span>
                Điều chỉnh số lượng
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="success">Số lượng điều chỉnh</FieldLabel>
                  <input
                    type="number"
                    value={adjQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAdjQty(Number(e.target.value))}
                    placeholder="Âm (−) để giảm, dương (+) để tăng"
                  />
                  <div className="hint">
                    Ví dụ: nhập <b>50</b> để thêm 50, nhập <b>-20</b> để giảm 20. Lý do sẽ được ghi vào nhật ký.
                  </div>
                </div>
                <div className="field full">
                  <FieldLabel tone="danger">Lý do điều chỉnh</FieldLabel>
                  <input
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="VD: Kiểm kê cuối tháng, nhập thêm hàng..."
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal
          title={`${detail.name}${detail.isCombo ? ' (Combo)' : ''}`}
          onClose={() => setDetail(null)}
          footer={null}
          wide
          headActions={
            <>
              <button className="btn btn-primary btn-sm" onClick={() => { const p = detail; setDetail(null); openEdit(p); }}>
                ✏️ Sửa
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { const p = detail; setDetail(null); openAdjust(p); }}>
                Kho
              </button>
              <button className="btn btn-danger-outline btn-sm" onClick={() => { const p = detail; setDetail(null); setDeleting(p); }}>
                Xóa
              </button>
            </>
          }
        >
          <div className="od-head">
            {detail.image ? <img className="od-head-img" src={detail.image} alt="" /> : <div className="od-head-img no-img">🍽️</div>}
            <div className="od-head-info">
              <div className="od-head-row">
                <span className="od-head-k">SKU</span>
                <span className="od-head-v">{detail.sku || '—'}</span>
              </div>
              <div className="od-head-row">
                <span className="od-head-k">Danh mục</span>
                <span className="od-head-v" style={catColor(detail.category) ? { color: catColor(detail.category), fontWeight: 700 } : undefined}>
                  {detail.category || '—'}
                </span>
              </div>
              <div className="od-head-row">
                <span className="od-head-k">NCC</span>
                <span className="od-head-v">{supplierName(detail.supplierId)}</span>
              </div>
              <div className="od-head-row">
                <span className="od-head-k">Tồn kho</span>
                <span className="od-head-v" style={{ color: Number(detail.stock) <= 5 ? 'var(--danger)' : undefined }}>
                  {fmtNumber(detail.stock, 2)} {detail.unit || ''}
                </span>
              </div>
            </div>
          </div>

          <div className="od-costs" style={{ marginBottom: 14 }}>
            <div className="od-cost od-cost-rev">
              <span className="od-cost-k">Giá bán</span>
              <span className="od-cost-v">{fmtMoney(detail.retailPrice)}</span>
            </div>
            <div className="od-cost od-cost-prof">
              <span className="od-cost-k">Giá sỉ</span>
              <span className="od-cost-v">{Number(detail.wholesalePrice) > 0 ? fmtMoney(detail.wholesalePrice) : '—'}</span>
            </div>
            <div className="od-cost od-cost-prof">
              <span className="od-cost-k">Giá nhập</span>
              <span className="od-cost-v money-out">{fmtMoney(detail.importPrice)}</span>
            </div>
          </div>

          {(() => {
            const tiers = toTierArr(detail.pricingTiers);
            const best = bestTier(detail.pricingTiers);
            return tiers.length > 0 && best ? (
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
                Bậc giá: mua ≥{fmtNumber(best.minQty)} →{' '}
                <span className="money-in" style={{ fontWeight: 700 }}>{fmtMoney(best.comboPrice)}</span>
              </div>
            ) : null;
          })()}

          <div className="tabs">
            <button className={`tab ${detailTab === 'variants' ? 'active' : ''}`} onClick={() => setDetailTab('variants')}>
              Biến thể ({variants.length})
            </button>
            <button className={`tab ${detailTab === 'combos' ? 'active' : ''}`} onClick={() => setDetailTab('combos')}>
              Combo
            </button>
            <button className={`tab ${detailTab === 'prices' ? 'active' : ''}`} onClick={() => setDetailTab('prices')}>
              Lịch sử giá ({priceHistory.length})
            </button>
          </div>

          {detailTab === 'variants' && (
            <div style={{ marginTop: 14 }}>
              <div className="toolbar" style={{ justifyContent: 'flex-start' }}>
                <span className="muted">Tồn kho = sản phẩm gốc + tổng biến thể.</span>
                <button className="btn btn-primary btn-sm" onClick={() => setVariantForm({ name: '', sku: '', price: Number(detail.retailPrice), stock: 0, isActive: true })}>
                  + Thêm biến thể
                </button>
              </div>
              {variants.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>Chưa có biến thể. VD: Size M, Size L...</div>
              ) : (
                <div className="table-wrap">
                  <table className="data table-inline">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>SKU</th>
                        <th className="right">Giá</th>
                        <th className="right">Tồn</th>
                        <th>Trạng thái</th>
                        <th className="right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <tr key={v.id}>
                          <td data-label="Tên" style={{ fontWeight: 600 }}>{v.name}</td>
                          <td data-label="SKU" className="nowrap">{v.sku || '—'}</td>
                          <td data-label="Giá" className="right nowrap">{fmtMoney(v.price)}</td>
                          <td data-label="Tồn" className="right nowrap">{fmtNumber(v.stock, 2)}</td>
                          <td data-label="Trạng thái">
                            <span className={`badge ${v.isActive ? 'badge-green' : 'badge-gray'}`}>
                              {v.isActive ? 'Kinh doanh' : 'Ngưng'}
                            </span>
                          </td>
                          <td data-label="Thao tác" className="right nowrap actions">
                            <button className="btn-link" onClick={() => setVariantForm({ id: v.id, name: v.name, sku: v.sku, price: Number(v.price), stock: Number(v.stock), isActive: v.isActive })}>
                              Sửa
                            </button>
                            <button className="btn-link danger" onClick={() => handleDeleteVariant(v)}>
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {detailTab === 'combos' && (
            <div style={{ marginTop: 14 }}>
              <div className="toolbar" style={{ justifyContent: 'flex-start' }}>
                <span className="muted">
                  Combo là sản phẩm tổng hợp từ nhiều sản phẩm khác. Khi bán combo, hệ thống tự trừ kho các sản phẩm thành phần.
                </span>
                <button className="btn btn-primary btn-sm" onClick={openComboEditor}>
                  {combos.length ? 'Sửa thành phần' : '+ Cấu hình combo'}
                </button>
              </div>
              {combos.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>Chưa có thành phần combo.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data table-inline">
                    <thead>
                      <tr>
                        <th>Sản phẩm thành phần</th>
                        <th>SKU</th>
                        <th className="right">Số lượng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combos.map((c) => (
                        <tr key={c.productId}>
                          <td data-label="Sản phẩm" style={{ fontWeight: 600 }}>{c.productName}</td>
                          <td data-label="SKU" className="nowrap">{c.sku || '—'}</td>
                          <td data-label="SL" className="right nowrap">{fmtNumber(c.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {detailTab === 'prices' && (
            <div style={{ marginTop: 14 }}>
              {priceHistory.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>Chưa có thay đổi giá nào.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data table-inline">
                    <thead>
                      <tr>
                        <th>Thời điểm</th>
                        <th>Trường</th>
                        <th className="right">Giá cũ</th>
                        <th className="right">Giá mới</th>
                        <th>Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((h) => (
                        <tr key={h.id}>
                          <td data-label="Thời điểm" className="nowrap muted">{fmtDateTime(h.createdAt)}</td>
                          <td data-label="Trường">{fieldLabels[h.field] || h.field}</td>
                          <td data-label="Giá cũ" className="right nowrap">{fmtMoney(Number(h.oldValue))}</td>
                          <td data-label="Giá mới" className="right nowrap" style={{ fontWeight: 600 }}>{fmtMoney(Number(h.newValue))}</td>
                          <td data-label="Người thực hiện">{h.createdBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {variantForm && (
        <Modal
          title={variantForm.id ? 'Sửa biến thể' : 'Thêm biến thể'}
          onClose={() => setVariantForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setVariantForm(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleSaveVariant} disabled={savingDetail}>
                {savingDetail ? 'Đang lưu...' : 'Lưu'}
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🧬</span>
                Thông tin biến thể
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="primary" req>
                    Tên biến thể
                  </FieldLabel>
                  <input value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} placeholder="VD: Size M" />
                </div>
                <div className="field">
                  <FieldLabel tone="muted">SKU</FieldLabel>
                  <input value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} />
                </div>
                <div className="field">
                  <FieldLabel tone="success">Giá bán (VNĐ)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={variantForm.price}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setVariantForm({ ...variantForm, price: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="info">Tồn kho</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={variantForm.stock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setVariantForm({ ...variantForm, stock: Number(e.target.value) })}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="violet">Trạng thái</FieldLabel>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={variantForm.isActive}
                      onChange={(e) => setVariantForm({ ...variantForm, isActive: e.target.checked })}
                    />
                    Đang kinh doanh
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {comboForm.length > 0 && detail && (
        <Modal
          title={`Cấu hình combo — ${detail.name}`}
          onClose={() => setComboForm([])}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setComboForm([])}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleSaveCombos} disabled={savingDetail}>
                {savingDetail ? 'Đang lưu...' : 'Lưu combo'}
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🧩</span>
                Thành phần combo
              </div>
              {comboForm.map((r, i) => (
                <div key={i} className="tier-row" style={{ marginBottom: 8 }}>
                  <select style={{ flex: 2 }} value={r.productId} onChange={(e) => setComboRow(i, 'productId', e.target.value)}>
                    <option value="">— Chọn sản phẩm —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === detail.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    style={{ flex: 1, maxWidth: 110 }}
                    placeholder="SL"
                    onFocus={(e) => e.target.select()}
                    value={r.quantity}
                    onChange={(e) => setComboRow(i, 'quantity', Number(e.target.value))}
                  />
                  <button type="button" className="btn-ghost btn-sm tier-del" onClick={() => setComboForm((prev) => prev.filter((_, idx) => idx !== i))}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setComboForm((prev) => [...prev, { productId: '', quantity: 1 }])}>
                + Thêm thành phần
              </button>
            </div>
          </div>
        </Modal>
      )}

      {catModal && (
        <Modal
          title="Quản lý danh mục"
          onClose={() => setCatModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setCatModal(false)}>
                Đóng
              </button>
              <button className="btn btn-primary" onClick={() => { openAddCategory(); setCatForm({ name: '', color: CATEGORY_COLORS[0] }); }} style={{ display: 'none' }}>
                + Thêm
              </button>
            </>
          }
        >
          <div className="toolbar" style={{ justifyContent: 'flex-start', marginBottom: 12 }}>
            <span className="muted">Gom sản phẩm theo nhóm, dùng để lọc nhanh trên menu.</span>
            <button className="btn btn-primary btn-sm" onClick={() => { openAddCategory(); }}>
              + Thêm danh mục
            </button>
          </div>
          {categories.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>Chưa có danh mục nào.</div>
          ) : (
            <div className="table-wrap">
              <table className="data table-inline">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Màu</th>
                    <th className="right">Số sản phẩm</th>
                    <th className="right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Tên" style={{ fontWeight: 600 }}>{c.name}</td>
                      <td data-label="Màu">
                        <span className="cat-dot" style={{ background: c.color || '#ccc' }} />
                      </td>
                      <td data-label="Số sản phẩm" className="right">{c.productCount}</td>
                      <td data-label="Thao tác" className="right nowrap actions">
                        <button className="btn-link" onClick={() => openEditCategory(c)}>Sửa</button>
                        <button className="btn-link danger" onClick={() => setDeletingCat(c)}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-stack form-stack-single" style={{ marginTop: 16 }}>
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🗂️</span>
                {catForm.id ? 'Sửa danh mục' : 'Thêm danh mục'}
              </div>
              <div className="tier-row">
                <input
                  placeholder="Tên danh mục"
                  value={catForm.name}
                  onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                />
                <select
                  style={{ maxWidth: 90 }}
                  value={catForm.color}
                  onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                >
                  {CATEGORY_COLORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleSaveCategory} disabled={savingCat}>
                  {savingCat ? '...' : catForm.id ? 'Lưu' : 'Thêm'}
                </button>
              </div>
              <div className="cat-color-row">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`cat-color-swatch ${catForm.color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setCatForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deletingCat && (
        <ConfirmDialog
          title="Xóa danh mục"
          message={`Xóa danh mục "${deletingCat.name}"? Sản phẩm thuộc danh mục này sẽ giữ nguyên tên nhóm.`}
          onConfirm={handleDeleteCategory}
          onCancel={() => setDeletingCat(null)}
        />
      )}

      {menuModal && (
        <Modal
          title="🍽️ Tạo sản phẩm từ ảnh menu"
          onClose={() => setMenuModal(false)}
          footer={
            menuItems.length > 0 ? (
              <>
                <button className="btn btn-ghost" onClick={() => setMenuModal(false)}>
                  Đóng
                </button>
                <button className="btn btn-primary" onClick={handleCreateFromMenu} disabled={creatingMenu}>
                  {creatingMenu ? 'Đang tạo...' : `Tạo ${menuItems.filter((_, i) => menuChecks[i]).length} sản phẩm`}
                </button>
              </>
            ) : null
          }
          wide
        >
          <p className="muted mb">
            Upload ảnh thực đơn, hệ thống dùng AI đọc tên món và giá, sau đó bạn duyệt lại trước khi tạo sản phẩm.
          </p>
          <div className="menu-ocr">
            <div className="menu-ocr-left">
              {menuImage ? (
                <img className="menu-preview" src={menuImage} alt="menu" />
              ) : (
                <div className="menu-drop" onClick={() => menuFileRef.current?.click()}>
                  <div style={{ fontSize: 32 }}>📄</div>
                  <div>Chọn ảnh menu</div>
                  <div className="muted" style={{ fontSize: 12 }}>JPG/PNG/WebP, tối đa ~15MB</div>
                </div>
              )}
              <input ref={menuFileRef} type="file" accept="image/*" hidden onChange={handlePickMenu} />
              {menuImage && (
                <button className="btn btn-ghost btn-sm" onClick={() => menuFileRef.current?.click()}>
                  Đổi ảnh
                </button>
              )}
            </div>
            <div className="menu-ocr-right">
              <button className="btn btn-primary" onClick={handleRecognize} disabled={!menuImage || recognizing}>
                {recognizing ? 'Đang nhận diện...' : '🤖 Nhận diện món'}
              </button>
              {menuItems.length > 0 && (
                <div className="menu-items">
                  <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Đã nhận diện {menuItems.length} món</span>
                    <button className="btn-link" onClick={() => setMenuChecks(Object.fromEntries(menuItems.map((_, i) => [i, true])))}>
                      Chọn tất cả
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className="data table-inline">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Tên món</th>
                          <th className="right">Giá (VNĐ)</th>
                          <th>Đơn vị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {menuItems.map((it, i) => (
                          <tr key={i}>
                            <td>
                              <input
                                type="checkbox"
                                checked={!!menuChecks[i]}
                                onChange={(e) => setMenuChecks((prev) => ({ ...prev, [i]: e.target.checked }))}
                              />
                            </td>
                            <td data-label="Tên món">
                              <input
                                style={{ minWidth: 140 }}
                                value={it.name}
                                onChange={(e) => updateMenuItem(i, 'name', e.target.value)}
                              />
                            </td>
                            <td data-label="Giá" className="right">
                              <input
                                type="number"
                                style={{ width: 110, textAlign: 'right' }}
                                value={it.price}
                                onChange={(e) => updateMenuItem(i, 'price', e.target.value)}
                              />
                            </td>
                            <td data-label="Đơn vị">
                              <input
                                style={{ width: 80 }}
                                value={it.unit}
                                placeholder="đĩa, tô..."
                                onChange={(e) => updateMenuItem(i, 'unit', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Sản phẩm mới sẽ gán danh mục đang lọc ({activeCategory || 'Tất cả'}), giá bán = giá trên menu, ảnh = ảnh menu vừa chọn.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}