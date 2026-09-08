# Ghi nhớ phong cách thiết kế — Dropdown & Form

> File này ghi lại **quy ước CSS** cho dropdown và biểu mẫu (form) đã thực hiện theo
> chuẩn của **form tạo/sửa đơn hàng** (`frontend/src/pages/Orders.tsx`).
> Khi làm form mới, hãy **làm theo đúng chuẩn này** để giao diện đồng bộ.

---

## 1. Dropdown (chọn lựa)

### Nguyên tắc chung
- **KHÔNG dùng `<select>` native** cho dropdown chọn lựa trong form/thanh lọc.
  Dùng component chung **`components/ui/Select.tsx`** (`<Select value onChange options />`).
- Mọi bảng chọn hiển thị qua **portal** (`ReactDOM.createPortal`) nên **luôn nổi trên mọi
  element**, có `z-index: 9999`, tự cập nhật vị trí khi scroll/resize.
- Chọn xong phải **đóng dropdown**; xử lý chọn bằng **`onMouseDown`** (không dùng `onClick`)
  để chắc chắn đóng trên mobile (tránh bị `preventDefault` chặn `click`).
- **Tự bật ngược lên**: nếu không đủ chỗ phía dưới trigger (`below < panel dự kiến`)
  thì panel mở **hướng lên** (`bottom` thay cho `top`) và giới hạn `maxHeight` theo khoảng trống
  → không bao giờ tràn khỏi màn hình (áp dụng ở `Select`, `DatePicker`, `CustomerSearch`, `ProductSearch`).
- **Click ra ngoài để đóng**: dùng `document.addEventListener('mousedown', fn, true)` — **pha capture**,
  vì nội dung modal có `onMouseDown={e => e.stopPropagation()}` (chặn sự kiện nổi tới `document`
  nên listener ở pha bubble sẽ không chạy). Bắt capture thì chạy trước khi tới root nơi React chặn.

### Các class CSS (định nghĩa trong `src/styles.css`)
| Class | Mục đích |
|---|---|
| `.dropdown` | Khung bảng chọn: nền `--card-bg`, viền `--border-strong`, bo 12px, bóng, cuộn 260px, hiệu ứng `dropdownIn`. |
| `.dropdown-item` | 1 dòng lựa chọn; `.selected` / `:hover` nền `--primary-soft` + chữ `--primary-dark`. |
| `.dropdown-item-name` / `.dropdown-item-phone` | Dòng chính / phụ (vd tên + SĐT khách hàng). |
| `.dropdown-empty` | Trạng thái "không có dữ liệu". |
| `.cust-dropdown` | Bảng chọn dùng cho CustomerSearch/ProductSearch (alias của `.dropdown`). |
| `.select-custom` | Khối bọc trigger; `width:100%; min-width:140px`. |
| `.select-custom-trigger` | Nút trigger: giống hệt ô nhập (viền, bo `--radius-sm`, nền `--input-bg`), có hover/focus ring. |
| `.select-custom-value` | Chữ giá trị đã chọn (ellipsis khi dài). |
| `.select-custom-chev` | Ký tự ▾; xoay 180° khi mở. |
| `.fl-*` | (xem mục Form) |

### Dropdown đặc biệt
- **Chọn khách hàng** → `components/CustomerSearch.tsx`: ô tìm kiếm + bảng chọn
  (tên + SĐT). Có chế độ **`collapsed`**: sau khi chọn thì thu gọn thành chip
  (avatar + tên + SĐT + ✏️), nhấp vào chip để đổi.
- **Chọn sản phẩm** → `components/ProductSearch.tsx`: tìm theo tên/SKU, mỗi dòng
  hiện giá + tồn kho; sản phẩm đã thêm có badge **✓ Đã thêm** và khóa (`.prod-item.added`).
- **Chọn ngày** → `components/ui/DatePicker.tsx`: nút trigger giống dropdown + lịch
  tùy chỉnh `.date-panel` gọn gàng hiển thị **đủ cả tháng trong 1 khối** (không cuộn);
  **hàng thứ có màu theo từng ngày** (T2–T6 xanh/lam/…, T7 tím, CN đỏ — dùng `data-wd`
  + biến theme), hôm nay viền `.today`, ngày chọn gradient `.selected`, nút ‹ › đổi tháng.
- **Màu theo tone** (trạng thái, thanh toán...): truyền `tone` trong options
  (`'badge-green' | 'badge-blue' | 'badge-red' | 'badge-yellow' | 'badge-amber' | 'badge-purple' | 'badge-gray'`),
  `Select` tự tô màu chữ giá trị đã chọn qua `TONE_COLOR`.

### Mobile
- Trigger dropdown trong modal/thanh lọc phải đủ chạm: `min-height: 48px; font-size: 16px`
  (đã có sẵn trong `@media (max-width: 640px)`).
- Bộ lọc trang danh sách: xếp **lưới 2 cột**, không cuộn ngang.

---

## 2. Form (biểu mẫu)

### Nguyên tắc chung
- Form chia theo **nhóm (section)**: `.form-section` + `.form-section-title` + `.form-section-body`.
- **Tiêu đề nhóm có icon** (🛍️ 👤 🧾 💳 💰 📝) trong ô nền màu `.form-section-ic`.
- **Tiêu đề ô nhập liệu KHÔNG có icon**, chỉ tô màu theo nhóm qua component
  `FieldLabel` (định nghĩa trong `components/ui/FieldLabel.tsx`, dùng chung cho mọi form —
  Orders, POS...): `tone` = `info | primary | success |
  warning | danger | violet | amber | muted`, tương ứng class `.fl-*`.
- Các section ngăn cách bằng đường đứt nét (`border-top: 1px dashed`) trên mobile.

### Các class CSS
| Class | Mục đích |
|---|---|
| `.form-stack` | Bọc toàn bộ form; mặc định 1 cột dọc. |
| `.form-section` | 1 nhóm; `.form-section + .form-section` = đường phân cách. |
| `.form-section-title` | Dòng tiêu đề nhóm (chữ đậm + icon). |
| `.form-section-ic` | Ô nền màu chứa icon của nhóm. |
| `.form-section-body` | Lưới bên trong nhóm: **2 cột** (`repeat(2, 1fr)`), `.full` trải hết hàng. |
| `.field` | 1 ô nhập: label + control, xếp dọc. |
| `.field-label` | Label tô màu (`fl-<tone>`); `.field-label-req` = dấu `*` đỏ bắt buộc. |
| `.field-input` | Control chuẩn (input/select/textarea): padding 11px 14px, viền `--border-strong`, focus ring `--ring`. |
| `.field-<tone>` | Tô màu **viền** ô nhập theo nhóm (vd `.field-shipping` hổ phách, `.field-discount` đỏ...). |
| `.preorder-toggle` | Checkbox tùy chỉnh: ô tick gradient `.preorder-box`, bật = `on` (nền `--primary-soft`). |
| `.items-box` | Khu danh sách sản phẩm (viền đứt nét); `.item-row` = 1 dòng sản phẩm. |
| `.prod-search` | Ô thêm sản phẩm (icon 🔍, padding trái 34px). |

### Desktop rộng (≥1100px) — form không cần cuộn dọc
- `.form-stack` chuyển thành **grid 2 cột**; mỗi `.form-section` thành **card**
  (nền `--card-bg`, viền, bo, bóng).
- Vị trí nhóm đặt bằng class: `.sec-products` (cột trái, cao), `.sec-note` (trái dưới),
  `.sec-customer` / `.sec-order` / `.sec-payment` / `.sec-costs` (cột phải).
- Danh sách sản phẩm tự cuộn nội bộ: `.sec-products .items-box { max-height: min(42vh, 400px); overflow: auto; }`.
- Modal rộng tối đa **1180px** (truyền `maxWidth={1180}` qua prop `maxWidth` của `Modal`).

### Ô nhập số
- Thêm `onFocus={(e) => e.target.select()}` để khi bấm vào là chọn hết số,
  gõ liền thay thế (áp dụng cho các ô chi phí: phí ship, giảm giá, VAT, phụ thu, điểm).

---

## 3. Nơi tham khảo
- Form mẫu chuẩn: `frontend/src/pages/Orders.tsx` (`OrderFormModal`) — form tạo/sửa đơn, form trả hàng.
- Áp dụng cùng chuẩn: giỏ hàng POS (`frontend/src/pages/Pos.tsx` — nhóm 👤 Khách hàng / 💳 Thanh toán).
- CSS: `frontend/src/styles.css` — khối "Order form: sections" + "Unified Dropdown System".
- Components dropdown: `frontend/src/components/ui/Select.tsx`, `CustomerSearch.tsx`,
  `ProductSearch.tsx`, `ui/DatePicker.tsx`, `ui/FieldLabel.tsx`.
- Phân trang có chọn số/trang: `frontend/src/components/Pagination.tsx` + `hooks/usePaginatedList.ts`.