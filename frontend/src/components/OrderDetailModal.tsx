import type { Order } from '../types';
import { fmtDateTime, fmtMoney, fmtNumber, ORDER_STATUS, PAYMENT_STATUS, SHIPPING_METHOD } from '../format';
import Modal from './Modal';
import Select from './ui/Select';

interface OrderDetailProps {
  order: Order;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  onStatusChange?: (status: string) => void;
}

export default function OrderDetailModal({ order: o, onClose, onEdit, onDelete, onPrint, onStatusChange }: OrderDetailProps) {
  const st = ORDER_STATUS[o.status] || { label: o.status, cls: 'badge-gray' };
  const ps = PAYMENT_STATUS[o.paymentStatus] || { label: o.paymentStatus, cls: 'badge-gray' };
  const shipping = SHIPPING_METHOD[o.shippingMethod] || o.shippingMethod || '—';
  const orderType =
    o.orderType === 'dropship' ? 'Drop-ship' : o.orderType === 'onsite' ? 'Tại quầy' : 'Online';

  const cogs = o.items.reduce((s, it) => s + Number(it.quantity) * Number(it.costPrice || 0), 0);
  const grossProfit = o.totalAmount - cogs;
  const margin = o.totalAmount > 0 ? (grossProfit / o.totalAmount) * 100 : 0;
  const otherCosts = Number(o.shippingFee || 0) + Number(o.surcharge || 0);
  const netProfit = grossProfit - otherCosts;
  const netMargin = o.totalAmount > 0 ? (netProfit / o.totalAmount) * 100 : 0;

  return (
    <Modal
      title={`Chi tiết đơn ${o.id}`}
      onClose={onClose}
      wide
      headActions={
        <>
          {onStatusChange && (
            <Select
              variant="badge"
              badgeTone={st.cls}
              value={o.status}
              onChange={onStatusChange}
              options={Object.entries(ORDER_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          )}
          {onDelete && <button className="btn btn-danger-outline btn-sm" onClick={onDelete}>🗑</button>}
          {onPrint && <button className="btn btn-ghost btn-sm" onClick={onPrint}>🖨️</button>}
          {onEdit && <button className="btn btn-primary btn-sm" onClick={onEdit}>Sửa</button>}
        </>
      }
    >
      <div className="od-head">
        <div className="od-id">
          <span className={`badge ${st.cls}`}>{st.label}</span>
          {o.isPreorder && <span className="badge badge-blue">Đặt trước</span>}
        </div>
        <div className="od-id-right">
          <span className={`badge ${ps.cls}`}>{ps.label}</span>
          <span className="badge badge-gray">{orderType}</span>
        </div>
      </div>

      <div className="od-grid">
        <div className="od-info od-info-customer">
          <div className="od-info-title">👤 Khách hàng</div>
          <div className="od-rows">
            <div className="od-row"><span>Tên</span><b>{o.customerName || 'Khách lẻ'}</b></div>
            <div className="od-row"><span>SĐT</span><b>{o.phone || '—'}</b></div>
            <div className="od-row"><span>Địa chỉ</span><b>{o.address || '—'}</b></div>
          </div>
        </div>
        <div className="od-info od-info-order">
          <div className="od-info-title">📦 Đơn hàng</div>
          <div className="od-rows">
            <div className="od-row"><span>Ngày tạo</span><b>{fmtDateTime(o.createdAt)}</b></div>
            <div className="od-row"><span>Giao hàng</span><b>{shipping}{o.carrier ? ` · ${o.carrier}` : ''}</b></div>
            <div className="od-row"><span>Ngày giao</span><b>{o.deliveryDate ? fmtDateTime(o.deliveryDate) : '—'}</b></div>
            <div className="od-row"><span>Nhân viên</span><b>{o.createdBy || '—'}</b></div>
            {o.note && <div className="od-row"><span>Ghi chú</span><b>{o.note}</b></div>}
          </div>
        </div>
      </div>

      <div className="od-items">
        <div className="od-items-head">🧾 Danh sách sản phẩm</div>
        <table className="data table-inline">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th className="right">SL</th>
              <th className="right">Đơn giá</th>
              <th className="right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, idx) => (
              <tr key={idx}>
                <td data-label="Sản phẩm" style={{ fontWeight: 600 }}>{it.productName}</td>
                <td data-label="SL" className="right">{fmtNumber(it.quantity)}</td>
                <td data-label="Đơn giá" className="right nowrap">{fmtMoney(it.price)}</td>
                <td data-label="Thành tiền" className="right nowrap money-primary" style={{ fontWeight: 700 }}>
                  {fmtMoney(it.quantity * it.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="od-costs">
        <div className="od-costs-cluster od-cluster-rev">
          <div className="od-cluster-title">💰 Doanh thu</div>
          <div className="od-cost-row"><span>Tạm tính</span><b>{fmtMoney(o.subtotal)}</b></div>
          {Number(o.discount) > 0 && (
            <div className="od-cost-row"><span>Chiết khấu</span><b className="money-out">-{fmtMoney(o.discount)}</b></div>
          )}
          {Number(o.pointsUsed) > 0 && (
            <div className="od-cost-row"><span>Điểm thưởng ({fmtNumber(o.pointsUsed)})</span><b className="money-out">-{fmtMoney(o.pointsValue)}</b></div>
          )}
          {Number(o.shippingFee) > 0 && (
            <div className="od-cost-row"><span>Phí vận chuyển</span><b>{fmtMoney(o.shippingFee)}</b></div>
          )}
          {Number(o.surcharge) > 0 && (
            <div className="od-cost-row"><span>Phụ thu</span><b>{fmtMoney(o.surcharge)}</b></div>
          )}
          {Number(o.taxAmount) > 0 && (
            <div className="od-cost-row"><span>VAT {fmtNumber(o.taxRate || 0)}%</span><b>{fmtMoney(o.taxAmount)}</b></div>
          )}
          <div className="od-cost-row od-cost-total"><span>Tổng thu</span><b className="money-primary">{fmtMoney(o.totalAmount)}</b></div>
        </div>

        <div className="od-costs-cluster od-cluster-profit">
          <div className="od-cluster-title">📊 Lợi nhuận đơn</div>
          <div className="od-cost-row"><span>Giá vốn hàng bán (COGS)</span><b className="money-out">{fmtMoney(cogs)}</b></div>
          <div className="od-cost-row od-profit">
            <span>Lợi nhuận gộp</span>
            <b className={grossProfit >= 0 ? 'money-in' : 'money-out'} style={{ fontSize: 16 }}>
              {grossProfit >= 0 ? '+' : ''}{fmtMoney(grossProfit)}
            </b>
          </div>
          {(Number(o.shippingFee) > 0 || Number(o.surcharge) > 0) && (
            <div className="od-cost-row">
              <span>Chi phí (ship + phụ thu)</span>
              <b className="money-out">-{fmtMoney(otherCosts)}</b>
            </div>
          )}
          <div className="od-cost-row od-profit" style={{ borderTop: '1px dashed var(--border-soft)', paddingTop: 10 }}>
            <span>Lợi nhuận thực tế</span>
            <b className={netProfit >= 0 ? 'money-in' : 'money-out'} style={{ fontSize: 17 }}>
              {netProfit >= 0 ? '+' : ''}{fmtMoney(netProfit)}
            </b>
          </div>
          <div className="od-cost-row"><span>Biên LN gộp</span><b>{margin.toFixed(1)}%</b></div>
          <div className="od-cost-row"><span>Biên LN thực tế</span><b>{netMargin.toFixed(1)}%</b></div>
        </div>
      </div>
    </Modal>
  );
}