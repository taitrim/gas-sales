import { useState } from 'react';
import { toPng } from 'html-to-image';
import type { ImportRecord, Order, StoreInfo } from '../types';
import { fmtDateTime, fmtMoney, fmtNumber, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_METHOD } from '../format';

export type PrintFormat = 'a4' | 'thermal';

interface PrintInvoiceProps {
  kind: 'order' | 'import';
  data: Order | ImportRecord;
  store: StoreInfo;
  onClose: () => void;
}

function StoreHead({ store }: { store: StoreInfo }) {
  const name = store['storeName'] || 'Cửa hàng';
  const address = store['address'];
  const phone = store['phone'];
  const tax = store['taxCode'];
  return (
    <div className="invoice-head">
      <div className="invoice-store">{name}</div>
      {(address || phone || tax) && (
        <div className="invoice-store-meta">
          {address && <span>Đ/c: {address}</span>}
          {phone && <span>SĐT: {phone}</span>}
          {tax && <span>MST: {tax}</span>}
        </div>
      )}
    </div>
  );
}

export default function PrintInvoice({ kind, data, store, onClose }: PrintInvoiceProps) {
  const [format, setFormat] = useState<PrintFormat>('a4');
  const [capturing, setCapturing] = useState(false);
  const [snapPreview, setSnapPreview] = useState<string | null>(null);
  const isOrder = kind === 'order';
  const o = data as Order;

  const lines = isOrder ? o.items.map((it) => [it.productName, it.quantity, it.price, it.quantity * it.price]) : (data as ImportRecord).items.map((it) => [it.productName, it.quantity, it.importPrice, it.quantity * it.importPrice]);

  const fileName = `bill-${data.id}.png`;

  async function captureBill(): Promise<string | null> {
    const node = document.querySelector<HTMLElement>('.print-area');
    if (!node) return null;
    try {
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio,
        cacheBust: true
      });
      return dataUrl;
    } catch {
      return null;
    }
  }

  async function handleScreenshot() {
    setCapturing(true);
    const dataUrl = await captureBill();
    setCapturing(false);
    if (!dataUrl) return;
    setSnapPreview(dataUrl);
  }

  // Chuyển dataURL -> File không cần fetch (tránh lỗi CORS/lớn trên iOS)
  function dataUrlToFile(dataUrl: string): File {
    const [head, body] = dataUrl.split(',');
    const mime = head.match(/:(.*?);/)?.[1] || 'image/png';
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], fileName, { type: mime });
  }

  const share = typeof navigator !== 'undefined' ? navigator.share : undefined;
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.png', { type: 'image/png' })] });

  // iOS PWA standalone (WKWebView) KHÔNG mở được native share cho file ảnh
  // => chuyển sang chế độ "giữ ảnh để lưu vào thư viện"
  const isIosStandalone =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent || '') &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  // Lưu ảnh / chia sẻ: mở native share sheet -> vừa lưu được vào thư viện ảnh, vừa chọn được app gửi
  // (Zalo, Messenger...). iOS PWA standalone thì chuyển sang hướng dẫn giữ ảnh để lưu vào Photos.
  async function shareSnap() {
    if (!snapPreview) return;

    if (isIosStandalone) {
      // iOS standalone không share file được: hiện ảnh to để người dùng giữ -> Save Image
      const preview = document.querySelector<HTMLImageElement>('.snap-body img');
      preview?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const file = dataUrlToFile(snapPreview);
    if (share && canShareFiles) {
      try {
        await share({ files: [file], title: `Hóa đơn ${data.id}` });
        return;
      } catch (e) {
        if (e && (e as DOMException).name === 'NotAllowedError') {
          try {
            await share({ files: [file], title: `Hóa đơn ${data.id}` });
            return;
          } catch {
            /* still failed */
          }
        }
      }
    }
    const a = document.createElement('a');
    a.href = snapPreview;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="print-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-toolbar">
        <div className="print-toolbar-group">
          <button
            className={`print-fmt ${format === 'a4' ? 'active' : ''}`}
            onClick={() => setFormat('a4')}
          >
            A4
          </button>
          <button
            className={`print-fmt ${format === 'thermal' ? 'active' : ''}`}
            onClick={() => setFormat('thermal')}
          >
            58mm
          </button>
        </div>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={handleScreenshot} disabled={capturing}>
          {capturing ? 'Đang chụp…' : '📸 Chụp ảnh'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 In
        </button>
      </div>

      <div className={`print-area ${format === 'thermal' ? 'thermal' : ''}`}>
        {store['logo'] ? (
          <img
            className="print-watermark"
            src={store['logo']}
            alt=""
            aria-hidden="true"
          />
        ) : null}
        <StoreHead store={store} />
        <div className="invoice-title">{isOrder ? 'HÓA ĐƠN BÁN HÀNG' : 'PHIẾU NHẬP HÀNG'}</div>
        <div className="invoice-meta">
          <div>Mã: <strong>{data.id}</strong></div>
          <div>Ngày: {fmtDateTime(data.createdAt)}</div>
          {isOrder && (
            <>
              <div>Khách hàng: {o.customerName || '—'}</div>
              <div>SĐT: {o.phone || '—'}</div>
              <div>Địa chỉ: {o.address || '—'}</div>
              <div>Giao hàng: {SHIPPING_METHOD[o.shippingMethod] || o.shippingMethod || '—'}</div>
              {o.deliveryDate && <div>Ngày giao: {o.deliveryDate}</div>}
            </>
          )}
          {!isOrder && (
            <>
              <div>Nhà cung cấp: {(data as ImportRecord).supplierName || '—'}</div>
              <div>Vận chuyển: {(data as ImportRecord).carrier || '—'}</div>
            </>
          )}
        </div>

        <table className="invoice-items">
          <thead>
            <tr>
              <th>STT</th>
              <th>Sản phẩm</th>
              <th className="right">SL</th>
              <th className="right">Đơn giá</th>
              <th className="right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{row[0]}</td>
                <td className="right">{fmtNumber(Number(row[1]))}</td>
                <td className="right">{fmtMoney(Number(row[2]))}</td>
                <td className="right">{fmtMoney(Number(row[3]))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          {isOrder && (
            <>
              <div><span>Tạm tính</span><b>{fmtMoney(o.subtotal)}</b></div>
              <div><span>Giảm giá</span><b>-{fmtMoney(o.discount)}</b></div>
              {Number(o.pointsValue) > 0 && <div><span>Điểm tích lũy</span><b>-{fmtMoney(o.pointsValue)}</b></div>}
              {Number(o.taxAmount) > 0 && <div><span>Thuế VAT ({o.taxRate}%)</span><b>+{fmtMoney(o.taxAmount)}</b></div>}
              <div><span>Phí vận chuyển</span><b>{fmtMoney(o.shippingFee)}</b></div>
              <div><span>Phụ thu</span><b>{fmtMoney(o.surcharge)}</b></div>
            </>
          )}
          {!isOrder && (
            <>
              <div><span>Tổng tiền hàng</span><b>{fmtMoney((data as ImportRecord).totalAmount - (data as ImportRecord).shippingFee)}</b></div>
              <div><span>Phí vận chuyển</span><b>{fmtMoney((data as ImportRecord).shippingFee)}</b></div>
            </>
          )}
          <div className="invoice-grand">
            <span>{isOrder ? 'TỔNG CỘNG' : 'TỔNG TIỀN'}</span>
            <b>{fmtMoney(isOrder ? o.totalAmount : (data as ImportRecord).totalAmount)}</b>
          </div>
          {isOrder ? (
            <>
              <div><span>Phương thức thanh toán</span><b>{PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod || '—'}</b></div>
              <div><span>Tình trạng</span><b>{PAYMENT_STATUS[o.paymentStatus]?.label || o.paymentStatus || '—'}</b></div>
            </>
          ) : (
            <>
              <div><span>Đã trả</span><b>{fmtMoney((data as ImportRecord).paidAmount)}</b></div>
              <div><span>Còn nợ</span><b>{fmtMoney((data as ImportRecord).remainingAmount)}</b></div>
            </>
          )}
          {isOrder && o.note && <div className="invoice-note">Ghi chú: {o.note}</div>}
        </div>

        <div className="invoice-foot">
          {isOrder && (
            <>
              <div>
                <span>{ORDER_STATUS[o.status]?.label || o.status}</span>
              </div>
              <div className="invoice-sign">
                <div>Người bán</div>
                <div>Khách hàng</div>
              </div>
            </>
          )}
          <div className="invoice-thanks">Cảm ơn quý khách! Hẹn gặp lại.</div>
        </div>
      </div>

      {snapPreview && (
        <div className="snap-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSnapPreview(null); }}>
          <div className="snap-card">
            <div className="snap-head">
              <h3>📸 Ảnh hóa đơn</h3>
              <button className="close-btn" onClick={() => setSnapPreview(null)}>✕</button>
            </div>
            <div className="snap-body">
              <img src={snapPreview} alt="Hóa đơn" />
            </div>
            {isIosStandalone && (
              <div className="snap-hint">
                💡 Giữ ngón tay lên ảnh trên, chọn <b>Lưu Hình Ảnh</b> để lưu vào thư viện ảnh.
              </div>
            )}
            <div className="snap-foot">
              <button className="btn btn-ghost" onClick={() => setSnapPreview(null)}>Đóng</button>
              <button className="btn btn-primary" onClick={shareSnap}>
                {isIosStandalone ? '🖼 Xem ảnh để lưu' : '📤 Lưu / Chia sẻ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}