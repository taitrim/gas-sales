export function fmtMoney(n: number | string | null | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(num);
}

export function fmtNumber(n: number | string | null | undefined, digits = 0): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('vi-VN', { maximumFractionDigits: digits });
}

export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtBytes(n: number | string | null | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = num;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function today(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function monthStart(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
}

export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ xử lý', cls: 'badge-yellow' },
  processing: { label: 'Đang xử lý', cls: 'badge-blue' },
  waiting_payment: { label: 'Chờ thanh toán', cls: 'badge-amber' },
  completed: { label: 'Hoàn thành', cls: 'badge-green' },
  cancelled: { label: 'Đã hủy', cls: 'badge-gray' }
};

export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'Chưa thanh toán', cls: 'badge-red' },
  partial: { label: 'Thanh toán một phần', cls: 'badge-yellow' },
  paid: { label: 'Đã thanh toán', cls: 'badge-green' }
};

export const IMPORT_STATUS: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'Chưa trả NCC', cls: 'badge-red' },
  partial: { label: 'Trả một phần', cls: 'badge-yellow' },
  paid: { label: 'Đã trả NCC', cls: 'badge-green' }
};

export const SHIPPING_METHOD: Record<string, string> = {
  delivery: 'Giao hàng',
  courier: 'Shipper',
  dropship: 'Drop-ship',
  pickUp: 'Khách tự lấy'
};

export const PAYMENT_METHOD: Record<string, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  cod: 'COD',
  card: 'Thẻ'
};

export const ORDER_TYPE: Record<string, string> = {
  online: 'Online',
  retail: 'Bán lẻ',
  wholesale: 'Bán sỉ'
};