import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ImportRecord, Product, StoreInfo, Supplier } from '../types';
import { fmtDateTime, fmtMoney, IMPORT_STATUS } from '../format';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import PrintInvoice from '../components/PrintInvoice';
import ImportFormModal, { type ImportForm } from '../components/ImportFormModal';
import ImportDetailModal from '../components/ImportDetailModal';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { exportCSV } from '../export';
import { useToast } from '../components/Toast';

function emptyForm(): ImportForm {
  return {
    supplierId: '',
    supplierName: '',
    carrier: '',
    shippingFee: 0,
    paidAmount: 0,
    items: []
  };
}

export default function Imports() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ImportRecord | null>(null);
  const [deleting, setDeleting] = useState<ImportRecord | null>(null);
  const [detail, setDetail] = useState<ImportRecord | null>(null);
  const [form, setForm] = useState<ImportForm>(emptyForm());
  const [printDoc, setPrintDoc] = useState<ImportRecord | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});

  const {
    items: records,
    total,
    page,
    setPage,
    search,
    setSearch,
    loading,
    reload
  } = usePaginatedList<ImportRecord>({
    fetcher: (p) => api.listImports({ page: p.page, pageSize: p.pageSize, search: p.search })
  });

  useEffect(() => {
    Promise.all([api.getProducts(), api.getSuppliers(), api.getStoreInfo()])
      .then(([p, s, info]) => {
        setProducts(p);
        setSuppliers(s);
        setStoreInfo(info);
      })
      .catch(() => {});
  }, []);

  function fmtFileDate(d: Date): string {
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }

  async function exportImports() {
    try {
      // Xuất toàn bộ bằng phân trang listImports (không tải 1 lần qua getImports)
      const all: ImportRecord[] = [];
      const pageSize = 100;
      let page = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await api.listImports({ page, pageSize });
        all.push(...res.items);
        if (page * pageSize >= res.total) break;
        page += 1;
      }
      exportCSV(
        ['Mã phiếu', 'Nhà cung cấp', 'Ngày nhập', 'Tổng tiền', 'Đã trả', 'Còn nợ', 'Thanh toán'],
        all.map((r) => [
          r.id,
          r.supplierName,
          fmtDateTime(r.createdAt),
          r.totalAmount,
          r.paidAmount,
          r.remainingAmount,
          IMPORT_STATUS[r.paymentStatus]?.label || r.paymentStatus
        ]),
        `phieu-nhap-${fmtFileDate(new Date())}.csv`
      );
      toast('Đã xuất CSV.');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function openCreate() {
    setForm(emptyForm());
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(r: ImportRecord) {
    setForm({
      supplierId: r.supplierId || '',
      supplierName: r.supplierName || '',
      carrier: r.carrier || '',
      shippingFee: Number(r.shippingFee),
      paidAmount: Number(r.paidAmount),
      items: r.items.map((it) => ({ ...it }))
    });
    setEditing(r);
    setShowForm(true);
  }

  function selectSupplier(id: string) {
    const s = suppliers.find((x) => x.id === id);
    setForm({ ...form, supplierId: id, supplierName: s?.name || '' });
  }

  async function handleSave() {
    if (form.items.length === 0) {
      toast('Phiếu nhập phải có ít nhất 1 sản phẩm.', 'err');
      return;
    }
    try {
      if (editing) {
        await api.updateImport({ ...form, id: editing.id });
        toast('Đã cập nhật phiếu nhập.');
      } else {
        await api.createImport(form);
        toast('Đã tạo phiếu nhập.');
      }
      setShowForm(false);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteImport(deleting.id);
      toast('Đã xóa phiếu nhập, tồn kho đã được trừ lại.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Nhập hàng</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Tạo phiếu nhập
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-search">
          <input
            type="search"
            placeholder="Tìm mã phiếu, nhà cung cấp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted toolbar-count">{total} phiếu</span>
          <button className="btn btn-ghost btn-sm" onClick={exportImports} title="Xuất CSV toàn bộ phiếu nhập">
            ⬇ Xuất CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : records.length === 0 ? (
        <div className="empty">Không có phiếu nhập nào.</div>
      ) : (
        <>
          <div className="cust-cards">
            {records.map((r) => {
              const st = IMPORT_STATUS[r.paymentStatus] || {
                label: r.paymentStatus,
                cls: 'badge-gray'
              };
              return (
                <div
                  className="order-card is-clickable"
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Xem chi tiết phiếu ${r.id}`}
                  onClick={() => setDetail(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail(r);
                    }
                  }}
                >
                  <div className="oc-top">
                    <div className="oc-customer">
                      <div className="oc-avatar oc-avatar-flat">📥</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="oc-cust-name">{r.id}</div>
                        <div className="oc-cust-phone">{fmtDateTime(r.createdAt)}</div>
                      </div>
                    </div>
                    <div className="oc-badges">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </div>
                  </div>

                  <div className="oc-body">
                    {r.supplierName && (
                      <div className="oc-addr" title={r.supplierName}>🏪 {r.supplierName} · Vận chuyển: {r.carrier || '—'} · Ship {fmtMoney(r.shippingFee)}</div>
                    )}

                    <div className="oc-meta">
                      <div className="oc-cell">
                        <span className="ic">🧾</span>
                        <span>
                          Tổng tiền: <b className="money-primary">{fmtMoney(r.totalAmount)}</b>
                        </span>
                      </div>
                      <div className="oc-cell">
                        <span className="ic">📦</span>
                        <span>
                          Số món: <b>{r.items.length} sản phẩm</b>
                        </span>
                      </div>
                      <div className="oc-cell">
                        <span className="ic">✅</span>
                        <span>
                          Đã trả: <b className="money-in">{fmtMoney(r.paidAmount)}</b>
                        </span>
                      </div>
                      <div className="oc-cell">
                        <span className="ic">⚠️</span>
                        <span>
                          Còn nợ: <b className="money-debt">{fmtMoney(r.remainingAmount)}</b>
                        </span>
                      </div>
                    </div>

                    <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-link" onClick={() => setPrintDoc(r)}>
                        🖨️ In
                      </button>
                      <button className="btn-link" onClick={() => openEdit(r)}>
                        Sửa
                      </button>
                      <button className="btn-link danger" onClick={() => setDeleting(r)}>
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
        </>
      )}

      {showForm && (
        <ImportFormModal
          form={form}
          setForm={setForm}
          products={products}
          suppliers={suppliers}
          selectSupplier={selectSupplier}
          editing={!!editing}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa phiếu nhập"
          message={`Xóa phiếu nhập ${deleting.id}? Tồn kho của các sản phẩm trong phiếu sẽ bị trừ lại.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {printDoc && (
        <PrintInvoice kind="import" data={printDoc} store={storeInfo} onClose={() => setPrintDoc(null)} />
      )}

      {detail && <ImportDetailModal imp={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
