import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Order, Product, StoreInfo, Supplier } from '../types';
import {
  fmtDateTime,
  fmtMoney,
  fmtNumber,
  ORDER_STATUS,
  PAYMENT_STATUS,
  SHIPPING_METHOD
} from '../format';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import PrintInvoice from '../components/PrintInvoice';
import OrderDetailModal from '../components/OrderDetailModal';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { exportCSV } from '../export';
import { useToast } from '../components/Toast';
import OrderFormModal, { type OrderForm, emptyOrderForm, ORDER_STATUS_ICON, PAYMENT_STATUS_ICON } from '../components/OrderFormModal';

export default function Orders() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || '';
  const urlDetail = searchParams.get('detail') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string; address: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [paymentFilter, setPaymentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [preorderFilter, setPreorderFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [completeCheck, setCompleteCheck] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyOrderForm());
  const [printDoc, setPrintDoc] = useState<Order | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});
  const [returning, setReturning] = useState<Order | null>(null);
  const [returnForm, setReturnForm] = useState<{
    items: { productId: string; quantity: number; price: number }[];
    refundAmount: number;
    reason: string;
    note: string;
  } | null>(null);

  const {
    items: orders,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    loading,
    reload
  } = usePaginatedList<Order>({
    fetcher: (p) =>
      api.listOrders({
        page: p.page,
        pageSize: p.pageSize,
        search: p.search,
        status: (p.status as string) || undefined,
        paymentStatus: (p.paymentStatus as string) || undefined,
        orderType: (p.orderType as string) || undefined,
        preorder: (p.preorder as string) || undefined
      }),
    pageSize: 10,
    extra: {
      status: statusFilter || undefined,
      paymentStatus: paymentFilter || undefined,
      orderType: typeFilter || undefined,
      preorder: preorderFilter || undefined
    }
  });

  useEffect(() => {
    Promise.all([api.getProducts(), api.getSuppliers(), api.getCustomers(), api.getStoreInfo()])
      .then(([p, s, c, info]) => {
        setProducts(p);
        setSuppliers(s);
        setCustomers(c.map((x) => ({ id: x.id, name: x.name, phone: x.phone, address: x.address })));
        setStoreInfo(info);
      })
      .catch(() => {});
  }, []);

  // Mở chi tiết đơn từ link (vd: /orders?detail=ORD-xxx)
  useEffect(() => {
    if (!urlDetail) return;
    api
      .listOrders({ page: 1, pageSize: 1, search: urlDetail })
      .then((res) => {
        const found = res.items.find((o) => o.id === urlDetail);
        if (found) setDetail(found);
      })
      .catch(() => {});
  }, [urlDetail]);

  function openCreate() {
    setForm(emptyOrderForm());
    setEditing(null);
    setShowForm(true);
  }

  async function exportOrders() {
    try {
      // Xuất toàn bộ bằng cách phân trang listOrders (không tải 1 lần qua getOrders)
      const all: Order[] = [];
      const pageSize = 100;
      let page = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await api.listOrders({ page, pageSize });
        all.push(...res.items);
        if (page * pageSize >= res.total) break;
        page += 1;
      }
      exportCSV(
        ['Mã đơn', 'Khách hàng', 'SĐT', 'Ngày tạo', 'Tổng tiền', 'Trạng thái', 'Thanh toán', 'Giao hàng'],
        all.map((o) => [
          o.id,
          o.customerName,
          o.phone,
          fmtDateTime(o.createdAt),
          o.totalAmount,
          ORDER_STATUS[o.status]?.label || o.status,
          PAYMENT_STATUS[o.paymentStatus]?.label || o.paymentStatus,
          SHIPPING_METHOD[o.shippingMethod] || o.shippingMethod
        ]),
        `don-hang-${fmtDateForFile(new Date())}.csv`
      );
      toast('Đã xuất CSV.');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function fmtDateForFile(d: Date): string {
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }

  function openEdit(o: Order) {
    setForm({
      customerId: o.customerId || '',
      customerName: o.customerName || '',
      phone: o.phone || '',
      address: o.address || '',
      orderType: o.orderType || 'online',
      shippingMethod: o.shippingMethod || 'delivery',
      carrier: o.carrier || '',
      dropshipSupplierId: o.dropshipSupplierId || '',
      shippingFee: Number(o.shippingFee),
      discount: Number(o.discount),
      promoCode: '',
      surcharge: Number(o.surcharge),
      paymentMethod: o.paymentMethod || 'cash',
      status: o.status || 'pending',
      paymentStatus: o.paymentStatus || 'unpaid',
      deliveryDate: o.deliveryDate ? o.deliveryDate.slice(0, 10) : '',
      note: o.note || '',
      taxRate: Number(o.taxRate) || 0,
      pointsUsed: Number(o.pointsUsed) || 0,
      isPreorder: !!o.isPreorder,
      items: o.items.map((it) => ({ ...it }))
    });
    setEditing(o);
    setShowForm(true);
  }

  function changeStatus(o: Order, status: string) {
    api
      .updateOrderStatus(o.id, status)
      .then(() => {
        toast(`Đã đổi trạng thái đơn ${o.id} → ${ORDER_STATUS[status]?.label || status}`);
        reload();
      })
      .catch((err) => toast((err as Error).message, 'err'));
  }

  function changeStatusWithPay(o: Order, status: string, paymentStatus?: string) {
    api
      .updateOrderStatus(o.id, status, paymentStatus)
      .then(() => {
        toast(`Đã đổi trạng thái đơn ${o.id} → ${ORDER_STATUS[status]?.label || status}`);
        reload();
      })
      .catch((err) => toast((err as Error).message, 'err'));
  }

  function onStatusRequest(o: Order, status: string) {
    if (status === 'completed') {
      setCompleteCheck(o);
      return;
    }
    changeStatus(o, status);
  }

  async function handleSave() {
    if (form.items.length === 0) {
      toast('Đơn hàng phải có ít nhất 1 sản phẩm.', 'err');
      return;
    }
    if (form.isPreorder && !form.deliveryDate) {
      toast('Đơn đặt trước phải chọn ngày giao dự kiến.', 'err');
      return;
    }
    const subtotal = form.items.reduce((s, it) => s + it.quantity * it.price, 0);
    const pointsValue = (Number(form.pointsUsed) || 0) * (Number(storeInfo.pointValue) || 1000);
    const taxAmount = Math.max(0, Math.round((subtotal - form.discount - pointsValue) * ((Number(form.taxRate) || 0) / 100)));
    const totalAmount = Math.max(0, subtotal - form.discount - pointsValue + taxAmount + form.shippingFee + form.surcharge);
    const payload = { ...form, subtotal, totalAmount };
    try {
      if (editing) {
        await api.updateOrder({ ...payload, id: editing.id });
        toast('Đã cập nhật đơn hàng.');
      } else {
        await api.createOrder(payload);
        toast('Đã tạo đơn hàng.');
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
      await api.deleteOrder(deleting.id);
      toast('Đã xóa đơn hàng.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function openReturn(o: Order) {
    setReturning(o);
    setReturnForm({
      items: o.items.map((it) => ({ productId: it.productId, quantity: Number(it.quantity), price: Number(it.price) })),
      refundAmount: o.totalAmount,
      reason: '',
      note: ''
    });
  }

  async function handleReturn() {
    if (!returning || !returnForm) return;
    try {
      await api.createReturn({
        orderId: returning.id,
        items: returnForm.items.filter((it) => it.quantity > 0),
        refundAmount: returnForm.refundAmount,
        reason: returnForm.reason,
        note: returnForm.note
      });
      toast(`Đã tạo phiếu trả hàng cho đơn ${returning.id}.`);
      setReturning(null);
      setReturnForm(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  const hasFilters = !!(statusFilter || paymentFilter || typeFilter || preorderFilter);

  function resetFilters() {
    setStatusFilter('');
    setPaymentFilter('');
    setTypeFilter('');
    setPreorderFilter('');
    setPage(1);
  }

  return (
    <div>
      <div className="page-head">
        <h1>Đơn hàng</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Tạo đơn hàng
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-search">
          <input
            type="search"
            placeholder="Tìm mã đơn, khách hàng, SĐT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted nowrap toolbar-count">{total} đơn</span>
          <button className="btn btn-ghost btn-sm" onClick={exportOrders} title="Xuất CSV toàn bộ đơn hàng">
            ⬇ CSV
          </button>
        </div>
        <div className="ot-row ot-filters">
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            placeholder="Tất cả trạng thái"
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              ...Object.entries(ORDER_STATUS).map(([k, v]) => ({ value: k, label: `${ORDER_STATUS_ICON[k] || ''} ${v.label}` }))
            ]}
          />
          <Select
            value={paymentFilter}
            onChange={(v) => {
              setPaymentFilter(v);
              setPage(1);
            }}
            placeholder="Tất cả thanh toán"
            options={[
              { value: '', label: 'Tất cả thanh toán' },
              ...Object.entries(PAYMENT_STATUS).map(([k, v]) => ({ value: k, label: `${PAYMENT_STATUS_ICON[k] || ''} ${v.label}` }))
            ]}
          />
          <Select
            value={typeFilter}
            onChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
            placeholder="Tất cả loại đơn"
            options={[
              { value: '', label: 'Tất cả loại đơn' },
              { value: 'online', label: '🌐 Online' },
              { value: 'onsite', label: '🏬 Tại quầy' },
              { value: 'dropship', label: '📦 Drop-ship' }
            ]}
          />
          <Select
            value={preorderFilter}
            onChange={(v) => {
              setPreorderFilter(v);
              setPage(1);
            }}
            placeholder="Đơn thường"
            options={[
              { value: '', label: 'Đơn thường' },
              { value: '1', label: '📦 Đặt trước' }
            ]}
          />
          {hasFilters && (
            <button type="button" className="ot-reset" onClick={resetFilters}>
              ✕ Bỏ lọc
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : orders.length === 0 ? (
        <div className="empty">Không có đơn hàng nào.</div>
      ) : (
        <div className="order-cards">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status] || { label: o.status, cls: 'badge-gray' };
            const ps = PAYMENT_STATUS[o.paymentStatus] || { label: o.paymentStatus, cls: 'badge-gray' };
            const shipping = SHIPPING_METHOD[o.shippingMethod] || o.shippingMethod || '—';
            const orderType = o.orderType === 'dropship' ? 'Drop-ship' : o.orderType === 'onsite' ? 'Tại quầy' : 'Online';
            return (
              <div
                className="order-card is-clickable"
                key={o.id}
                role="button"
                tabIndex={0}
                aria-label={`Xem chi tiết đơn ${o.id}`}
                onClick={() => setDetail(o)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetail(o);
                  }
                }}
              >
                <div className="oc-top">
                  <div className="oc-id">
                    {o.id}
                    {o.isPreorder && <span className="badge badge-blue">Đặt trước</span>}
                  </div>
                  <div className="oc-badges" onClick={(e) => e.stopPropagation()}>
                    <Select
                      variant="badge"
                      badgeTone={st.cls}
                      value={o.status}
                      onChange={(v) => onStatusRequest(o, v)}
                      options={Object.entries(ORDER_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
                    />
                    <span className={`badge ${ps.cls}`}>{ps.label}</span>
                  </div>
                </div>

                <div className="oc-body">
                  <div className="oc-customer">
                    <div className="oc-avatar">{(o.customerName || 'K').charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="oc-cust-name">{o.customerName || 'Khách lẻ'}</div>
                      <div className="oc-cust-phone">{o.phone || '—'}</div>
                    </div>
                  </div>

                  <div className="oc-meta">
                    <div className="oc-cell">
                      <span className="ic">🕒</span>
                      <span>
                        <b>{fmtDateTime(o.createdAt)}</b>
                      </span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">🚚</span>
                      <span>
                        <b>{shipping}</b>
                      </span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">🏷️</span>
                      <span>
                        Loại: <b>{orderType}</b>
                      </span>
                    </div>
                    <div className="oc-cell">
                      <span className="ic">📦</span>
                      <span>
                        {o.items.length} món · {fmtNumber(o.items.reduce((s, it) => s + Number(it.quantity), 0))} SL
                      </span>
                    </div>
                  </div>

                  <div className="oc-total">
                    <span className="oc-total-label">Tổng tiền</span>
                    <span className="oc-total-val money-primary">{fmtMoney(o.totalAmount)}</span>
                  </div>
                </div>

                <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-link" onClick={() => setPrintDoc(o)}>
                    🖨️ In
                  </button>
                  {o.status === 'completed' && (
                    <button className="btn-link" style={{ color: 'var(--danger)' }} onClick={() => openReturn(o)}>
                      Trả hàng
                    </button>
                  )}
                  <button className="btn-link" onClick={() => openEdit(o)}>
                    Sửa
                  </button>
                  <button className="btn-link danger" onClick={() => setDeleting(o)}>
                    Xóa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {total > 0 && (
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {showForm && (
        <OrderFormModal
          form={form}
          setForm={setForm}
          products={products}
          suppliers={suppliers}
          customers={customers}
          editing={!!editing}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          onCustomerAdded={(cust) => setCustomers((prev) => [cust, ...prev])}
          pointValue={Number(storeInfo.pointValue) || 1000}
          pointsRate={Number(storeInfo.pointsRate) || 1}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa đơn hàng"
          message={`Xóa đơn ${deleting.id}? Tồn kho sẽ được cập nhật lại nếu đơn đã hoàn thành.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {detail && (
        <OrderDetailModal
          order={detail}
          onClose={() => {
            setDetail(null);
            if (urlDetail) {
              const p = new URLSearchParams(searchParams);
              p.delete('detail');
              setSearchParams(p, { replace: true });
            }
          }}
          onEdit={() => {
            const o = detail;
            setDetail(null);
            openEdit(o);
          }}
          onDelete={() => {
            const o = detail;
            setDetail(null);
            setDeleting(o);
          }}
          onPrint={() => {
            setPrintDoc(detail);
            setDetail(null);
          }}
          onStatusChange={(status) => onStatusRequest(detail, status)}
        />
      )}

      {completeCheck && (
        <Modal
          title={`Hoàn thành đơn ${completeCheck.id}`}
          onClose={() => setCompleteCheck(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setCompleteCheck(null)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const o = completeCheck;
                  setCompleteCheck(null);
                  changeStatusWithPay(o, 'completed', 'paid');
                }}
              >
                ✓ Đã thanh toán đủ
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const o = completeCheck;
                  setCompleteCheck(null);
                  changeStatusWithPay(o, 'waiting_payment', 'unpaid');
                }}
              >
                ⏳ Chưa thanh toán hết
              </button>
            </>
          }
        >
          <p style={{ margin: '4px 0 10px', lineHeight: 1.6 }}>
            Đơn <b>{completeCheck.id}</b> tổng{' '}
            <b className="money-primary">{fmtMoney(completeCheck.totalAmount)}</b>.
            Khách hàng đã thanh toán đầy đủ chưa?
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            • <b>Đã thanh toán đủ</b> → đơn hoàn thành, ghi nhận doanh thu.
            <br />
            • <b>Chưa thanh toán hết</b> → đơn chuyển sang <b>Chờ thanh toán</b> và phần còn lại được ghi vào nợ khách hàng.
          </p>
        </Modal>
      )}

      {printDoc && (
        <PrintInvoice kind="order" data={printDoc} store={storeInfo} onClose={() => setPrintDoc(null)} />
      )}

      {returning && returnForm && (
        <Modal
          title={`Trả hàng đơn ${returning.id}`}
          onClose={() => setReturning(null)}
          wide
          maxWidth={760}
          footer={
            <>
              <div className="muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>
                Hoàn tiền:{' '}
                <strong style={{ fontSize: 17, color: 'var(--danger)' }}>{fmtMoney(returnForm.refundAmount)}</strong>
              </div>
              <button className="btn btn-ghost" onClick={() => setReturning(null)}>
                Hủy
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReturn}
                disabled={returnForm.items.every((it) => it.quantity <= 0)}
              >
                Xác nhận trả hàng
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">📦</span>
                Sản phẩm trả lại
              </div>
              <div className="form-section-body">
                <div className="items-box full">
                  {returnForm.items.map((it, idx) => {
                    const item = returning.items[idx];
                    const maxQty = Number(item?.quantity) || 0;
                    return (
                      <div className="item-row" key={idx}>
                        <input value={item?.productName || ''} readOnly disabled className="item-name-input" />
                        <input
                          type="number"
                          min={0}
                          max={maxQty}
                          value={it.quantity}
                          className="item-qty-input"
                          onChange={(e) => {
                            const q = Math.max(0, Math.min(maxQty, Number(e.target.value)));
                            const items = returnForm.items.map((x, i) => (i === idx ? { ...x, quantity: q } : x));
                            const refund = items.reduce((s, x) => s + x.quantity * x.price, 0);
                            setReturnForm({ ...returnForm, items, refundAmount: refund });
                          }}
                        />
                        <input value={fmtMoney(it.price)} readOnly disabled className="item-price-input" />
                        <input value={fmtMoney(it.quantity * it.price)} readOnly disabled className="item-total-input" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">💰</span>
                Hoàn tiền &amp; lý do
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="warning">
                    Số tiền hoàn lại
                  </FieldLabel>
                  <input
                    type="number"
                    className="field-input"
                    value={returnForm.refundAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setReturnForm({ ...returnForm, refundAmount: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="violet">
                    Lý do
                  </FieldLabel>
                  <Select
                    value={returnForm.reason}
                    onChange={(v) => setReturnForm({ ...returnForm, reason: v })}
                    placeholder="— Chọn lý do —"
                    options={[
                      { value: 'Khách không nhận hàng', label: 'Khách không nhận hàng', tone: 'badge-red' },
                      { value: 'Sai sản phẩm', label: 'Sai sản phẩm', tone: 'badge-amber' },
                      { value: 'Hàng lỗi', label: 'Hàng lỗi', tone: 'badge-red' },
                      { value: 'Khách đổi trả', label: 'Khách đổi trả', tone: 'badge-blue' },
                      { value: 'Khác', label: 'Khác', tone: 'badge-gray' }
                    ]}
                  />
                </div>
                <div className="field full">
                  <FieldLabel tone="muted">
                    Ghi chú
                  </FieldLabel>
                  <textarea
                    className="field-input"
                    value={returnForm.note}
                    onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
