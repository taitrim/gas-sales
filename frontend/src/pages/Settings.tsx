import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { StoreInfo } from '../types';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

const FIELDS: { key: string; label: string }[] = [
  { key: 'storeName', label: 'Tên cửa hàng' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'email', label: 'Email' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'bankAccount', label: 'Số tài khoản' },
  { key: 'bankName', label: 'Ngân hàng' },
  { key: 'hotline', label: 'Hotline' },
  { key: 'note', label: 'Ghi chú' }
];

const MAX_LOGO = 512;

function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_LOGO / Math.max(img.width, img.height));
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
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh.'));
    };
    img.src = url;
  });
}

export default function Settings() {
  const { toast } = useToast();
  const [info, setInfo] = useState<StoreInfo>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getStoreInfo()
      .then((data) => {
        const merged: StoreInfo = {};
        for (const f of FIELDS) merged[f.key] = data[f.key] || '';
        merged['logo'] = data['logo'] || '';
        merged['pointsRate'] = data['pointsRate'] || '1';
        merged['pointValue'] = data['pointValue'] || '1000';
        setInfo(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handlePickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeLogo(file);
      setInfo((prev) => ({ ...prev, logo: dataUrl }));
      toast('Đã chọn logo. Nhấn "Lưu thay đổi" để áp dụng.');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.saveStoreInfo(info);
      toast('Đã lưu thông tin cửa hàng.');
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty">Đang tải...</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Cài đặt</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 640, padding: 20 }}>
        <p className="muted mb">
          Thông tin này hiển thị trên trang tổng quan và dùng cho các mục đích quản lý.
        </p>

        <div className="form-stack form-stack-single">
          <div className="form-section">
            <div className="form-section-title">
              <span className="form-section-ic">🏪</span>
              Thông tin cửa hàng
            </div>
            <div className="form-section-body">
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <FieldLabel tone="primary">{f.label}</FieldLabel>
                  <input
                    className="field-input"
                    value={info[f.key] || ''}
                    onChange={(e) => setInfo({ ...info, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">
              <span className="form-section-ic">🖼️</span>
              Logo cửa hàng
            </div>
            <div className="field">
              <div className="logo-picker">
                {info['logo'] ? (
                  <img className="logo-preview" src={info['logo']} alt="Logo" />
                ) : (
                  <div className="logo-placeholder">Chưa có logo</div>
                )}
                <div className="logo-actions">
                  <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                    {info['logo'] ? 'Đổi logo' : 'Chọn ảnh'}
                  </button>
                  {info['logo'] && (
                    <button
                      className="btn btn-danger-outline"
                      onClick={() => setInfo((prev) => ({ ...prev, logo: '' }))}
                    >
                      Xóa logo
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePickLogo}
              />
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Logo sẽ hiển thị chìm trên hóa đơn và dùng làm icon ứng dụng. Nên dùng ảnh vuông, nền trong suốt.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640, padding: 20, marginTop: 16 }}>
        <p className="muted mb">
          Quy tắc tích điểm áp dụng khi đơn hàng được thanh toán. Khách dùng điểm để giảm tiền
          khi mua hàng (POS và tạo đơn).
        </p>
        <div className="form-stack form-stack-single">
          <div className="form-section">
            <div className="form-section-title">
              <span className="form-section-ic">⭐</span>
              Tích lũy &amp; quy đổi điểm
            </div>
            <div className="form-section-body">
              <div className="field">
                <FieldLabel tone="success">Số điểm nhận / mỗi 1.000đ</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step="1"
                  className="field-input"
                  value={info['pointsRate'] || '1'}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setInfo({ ...info, pointsRate: e.target.value })}
                />
                <div className="hint">
                  Ví dụ: nhập 1 → mua 50.000đ được 50 điểm; nhập 2 → được 100 điểm.
                </div>
              </div>
              <div className="field">
                <FieldLabel tone="amber">Giá trị quy đổi 1 điểm (VNĐ)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step="100"
                  className="field-input"
                  value={info['pointValue'] || '1000'}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setInfo({ ...info, pointValue: e.target.value })}
                />
                <div className="hint">
                  Ví dụ: 1 điểm = 1.000đ → dùng 10 điểm giảm 10.000đ tiền hàng.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}