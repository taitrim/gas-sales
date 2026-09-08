# GAS Sales Pro — Rebuild (MySQL Backend)

Phần mềm quản lý bán hàng được **rebuild lại từ Google Apps Script sang Node.js + Express + MySQL**.
Giữ nguyên toàn bộ nghiệp vụ của AppScript bản 2.6 (đơn hàng, nhập hàng, tồn kho, đối soát NCC, tài chính)
và **cấu trúc API action giống hệt bản cũ** để có thể port lại frontend gốc nếu tìm thấy source.

## Cấu trúc dự án

```
CHINCHINSHOP/
├── backend/
│   ├── db/
│   │   ├── schema.sql            # Schema MySQL (11 bảng theo DB_SCHEMA gốc)
│   │   ├── setup.js              # npm run db:setup
│   │   └── seed.js               # npm run db:seed  (tạo admin + cửa hàng mặc định)
│   ├── scripts/
│   │   └── import-from-sheets.mjs  # npm run import:sheets — import dữ liệu từ Google Sheets
│   ├── public/uploads/           # Ảnh sản phẩm upload
│   └── src/
│       ├── server.js             # Entry point (port 4000)
│       ├── app.js                # Express app + dispatch action
│       ├── auth.js               # JWT + bcrypt
│       ├── inventory.js          # Logic tồn kho (dùng chung đơn hàng & nhập hàng)
│       ├── mappers.js            # Chuyển cột DB → shape API (giống AppScript)
│       └── actions/              # Từng action nghiệp vụ
└── frontend/                     # Vite + React + TypeScript
    └── src/pages/                # 11 trang: Login, Dashboard, Orders, Products, Imports,
                                  #   Suppliers, Customers, Finance, Stores, Users, Settings
```

## Yêu cầu

- Node.js ≥ 18 (khuyến nghị 20+)
- MySQL 8+ (đã test trên MySQL 9.6)

## 1. Cài đặt Backend

```bash
cd backend
npm install
copy .env.example .env     # sửa DB_PASSWORD, JWT_SECRET, ...
npm run db:setup           # tạo database gas_sales + các bảng
npm run db:seed            # tạo tài khoản admin (mặc định: admin / admin123) + cửa hàng mặc định
npm run dev                # chạy tại http://localhost:4000
```

Kiểm tra: `http://localhost:4000/api/health`

> ⚠️ Đổi mật khẩu `admin123` ngay sau lần đăng nhập đầu tiên (trang **Người dùng → Đặt lại MK**).

## 2. Import dữ liệu từ Google Sheets

### Cách A — Import qua giao diện web (khuyến nghị, không cần gõ lệnh)

Đăng nhập bằng tài khoản **admin** → menu **"Import dữ liệu"** (📤) → thực hiện 3 bước:

1. **Cấu hình kết nối**: nhập Spreadsheet ID + chọn cách kết nối → **Lưu cấu hình**.
   - **Sheet công khai** *(khuyên dùng nếu bạn là chủ sheet — không cần tạo gì trên Google Cloud)*:
     trong Google Sheets bấm **Chia sẻ** → đổi thành **"Bất kỳ ai có liên kết"** → quyền **"Người xem"**.
   - **API Key** (sheet public): cần tạo API key ở Google Cloud Console.
   - **Service Account**: cần tạo service account + chia sẻ sheet cho email của nó.
2. **Kiểm tra dữ liệu**: bấm **"Kiểm tra dữ liệu"** để xem bảng so sánh **số dòng trên Sheet vs số dòng trong DB**
   từng bảng, kèm kiểm tra "bản ghi mồ côi" (đơn không có khách, chi tiết không có đơn cha,...).
   Bảng nào hiện **"Chưa đồng bộ"** là chưa import hoặc bị lệch.
3. **Chạy import**: chọn các bảng cần import, có thể bật **Dry-run** để xem trước (không ghi DB),
   rồi bấm **Import**. Dữ liệu được **upsert** (giữ nguyên ID gốc, chạy lại không bị trùng).

> Chế độ "Sheet công khai" tải workbook (XLSX) trực tiếp từ Google nên **không cần**
> API key/service account/Google Cloud Console.

### Cách B — Import bằng CLI

Script đọc các tab đúng tên bảng của AppScript (`Users`, `StoreInfo`, `Suppliers`, `Customers`,
`Products`, `Imports`, `ImportDetails`, `Orders`, `OrderDetails`, `SupplierTransactions`, `Stores`),
**giữ nguyên ID gốc**, băm mật khẩu bằng bcrypt, và dùng `INSERT ... ON DUPLICATE KEY UPDATE`
nên chạy lại nhiều lần không bị trùng.

### Bước 1: Chuẩn bị quyền truy cập Sheet

**Cách A — Service Account (khuyến nghị):**
1. Lên https://console.cloud.google.com → tạo project → APIs & Services → Library → bật **Google Sheets API**.
2. Credentials → Create Credentials → **Service Account** → tạo key kiểu JSON → tải file về.
3. Mở Google Sheet gốc → **Share** → thêm email của service account (quyền **Viewer**).

**Cách B — Sheet public + API key:**
1. Chia sẻ Google Sheet chế độ "Bất kỳ ai có liên kết" (xem được).
2. Lấy API key từ Google Cloud Console.

### Bước 2: Cấu hình & chạy

Sửa `backend/.env`:

```
GOOGLE_CREDENTIALS_JSON=C:\path\to\service-account.json   # hoặc GOOGLE_API_KEY=...
GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvXyZ...
```

Chạy thử (không ghi DB):

```bash
cd backend
npm run import:sheets -- --sheetId=<SPREADSHEET_ID> --dry-run
```

Chạy thật:

```bash
npm run import:sheets -- --sheetId=<SPREADSHEET_ID>
```

Chỉ import một số bảng: `npm run import:sheets -- --sheetId=<id> --only Products,Orders,OrderDetails`

Sheet công khai, không cần key: `npm run import:sheets -- --sheetId=<id> --mode public --check`

Kiểm tra tính đầy đủ bằng CLI: `npm run import:sheets -- --sheetId=<id> --check`

> Mật khẩu cũ (plaintext trong sheet) sẽ được băm bcrypt khi import, tài khoản vẫn đăng nhập bình thường.
> Nếu dữ liệu không có `CreatedAt`, script tự dùng thời gian hiện tại.

## 3. Cài đặt Frontend

```bash
cd frontend
npm install
npm run dev                # chạy tại http://localhost:5173 (proxy /api → :4000)
```

Build cho production (backend sẽ tự serve `frontend/dist`):

```bash
npm run build
```

Sau khi build, chỉ cần chạy backend là truy cập được web đầy đủ tại `http://localhost:4000`.

## API (giữ nguyên cấu trúc action của AppScript)

`POST /api` — body: `{ "action": "...", ...payload }` — response: `{ success, data, error }`

| Nhóm | Action |
|---|---|
| Hệ thống | `checkSystemStatus`, `loginUser`, `registerUser` |
| Người dùng | `getUsers`, `approveUser`, `updateUser`, `deleteUser`, `resetPassword` |
| Sản phẩm | `getProducts`, `addProduct`, `updateProduct`, `deleteProduct` |
| NCC | `getSuppliers`, `addSupplier`, `updateSupplier`, `deleteSupplier`, `getSupplierTransactions`, `createSupplierPayment` |
| Khách hàng | `getCustomers`, `addCustomer`, `updateCustomer`, `deleteCustomer` |
| Đơn hàng | `getOrders`, `createOrder`, `updateOrder`, `updateOrderStatus`, `deleteOrder` |
| Nhập hàng | `getImports`, `createImport`, `updateImport`, `deleteImport` |
| Cửa hàng | `getStores`, `addStore`, `updateStore`, `deleteStore`, `getStoreInfo`, `saveStoreInfo` |
| Tài chính | `getFinancialReport` |
| Upload | `uploadImage` (base64 → `/uploads/...`) |

Trừ `checkSystemStatus`, `loginUser`, `registerUser`, các action khác cần header `Authorization: Bearer <token>` (token lấy từ `loginUser`).

## Ghi chú nghiệp vụ (giữ logic AppScript)

- **Tồn kho**: đơn hàng `completed` (không phải drop-ship) sẽ **trừ** tồn kho; chuyển trạng thái ra khỏi `completed` sẽ **cộng lại**. Xóa đơn hoàn thành sẽ hoàn tồn kho.
- **Nhập hàng**: tạo phiếu nhập **cộng** tồn kho; sửa/xóa phiếu sẽ cập nhật tồn kho tương ứng.
- **Đối soát NCC**: phiếu nhập còn nợ = `totalAmount − paidAmount`; lợi nhuận giữ ở NCC tính từ đơn drop-ship hoàn thành.
- **Tài chính**: báo cáo theo ngày, chỉ tính đơn `completed`.

## Deploy (production)

Hướng dẫn đưa lên server thật, bảo mật + tự động backup. Các file cấu hình mẫu nằm trong `deploy/`.

> **Đang dùng Windows + Cloudflare Tunnel (tên miền riêng)?** → xem runbook riêng:
> [`deploy/windows-tunnel/README.md`](deploy/windows-tunnel/README.md) — các script `configure-env.ps1`,
> `setup-db.ps1`, `setup-backend-service.ps1`, `setup-tunnel.ps1`, `check-prod.ps1` làm thay bạn gần hết các bước.

### Bước 0 — Chuẩn bị

- Node.js ≥ 20, MySQL 8+, và (khuyến nghị) một domain trỏ về server.
- Build frontend để backend tự serve tĩnh:
  ```bash
  cd frontend && npm run build
  ```

### Bước 1 — Backend `.env` (bảo mật)

Sửa `backend/.env`:

```ini
NODE_ENV=production
# JWT_SECRET PHẢI là chuỗi ngẫu nhiên ≥64 ký tự. Tạo bằng:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<chuỗi-ngẫu-nhiên>
# Dùng user riêng (KHÔNG root). Chạy deploy/mysql-user.sql 1 lần:
DB_USER=gas
DB_PASSWORD=<mat-khau-manh>
```

> ⚠️ `backend/.env` đã nằm trong `.gitignore` — không bao giờ commit.

### Bước 2 — User MySQL riêng + Firewall

1. Tạo user `gas` không phải root:
   ```bash
   mysql -u root -p < deploy/mysql-user.sql
   ```
2. **KHÔNG mở port 4000 ra internet.** Chỉ để MySQL bound `127.0.0.1` và để nginx (443) là cửa duy nhất vào.

### Bước 3 — HTTPS + Reverse proxy (nginx)

Backend chạy trên `0.0.0.0:4000` mặc định; dùng nginx làm cửa ngõ 443 →

```bash
sudo cp deploy/nginx-gas-sales.conf.example /etc/nginx/conf.d/gas-sales.conf
# sửa server_name thành domain thật, rồi:
sudo certbot --nginx -d shop.example.com   # Let's Encrypt tự động HTTPS
sudo nginx -t && sudo systemctl reload nginx
```

Sau khi có HTTPS, set `CORS_ORIGIN` trong `.env` về domain thật:

```ini
CORS_ORIGIN=https://shop.example.com
```

### Bước 4 — Process manager (tự khởi động + auto-restart)

**Option A — systemd (Linux):**

```bash
sudo cp deploy/gas-sales.service.example /etc/systemd/system/gas-sales.service
# sửa WorkingDirectory/ExecStart cho đúng đường dẫn
sudo systemctl daemon-reload && sudo systemctl enable --now gas-sales
```

**Option B — PM2:**

```bash
npm i -g pm2
cp deploy/ecosystem.config.cjs.example /srv/gas-sales-backend/ecosystem.config.cjs
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

### Bước 5 — Backup tự động

**Windows (Task Scheduler):** chạy 1 lần với admin:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\setup-backup-task.ps1
```

**Linux (cron):**

```bash
# chạy mỗi ngày 02:00, giữ 14 ngày
crontab -e
#  0 2 * * *  cd /srv/gas-sales-backend && node scripts/auto-backup.mjs
```

Backup được lưu trong `backend/backups/*.sql`. **Nên copy backup ra ngoài server** (ví dụ upload lên cloud/storage) để phòng mất ổ.

### Kiểm tra health

```bash
curl https://shop.example.com/api/health   # {"status":"ok","db":"connected"}
```

## Nhật ký thay đổi

### 2.6.6 (08/2026) — Nguồn khách & trang khách hàng theo phong cách đơn hàng

- **Trang Khách hàng đồng bộ 100% ngôn ngữ thiết kế trang Đơn hàng**:
  - Toolbar 2 dòng `.orders-toolbar` giống hệt: dòng tìm kiếm + "N khách" + ⬇ CSV; dòng bộ lọc dropdown **nguồn khách** (icon từng kênh) + nút **✕ Bỏ lọc** khi đang lọc.
  - Card khách dùng đúng hệ thống `order-card` / `oc-*`: avatar chữ cái đầu (màu hash riêng), tên + SĐT, badge **"Nợ Xđ"** đỏ góc phải; hàng meta dạng ô icon (🛒 Chi tiêu · ⭐ Điểm bấm được mở sổ · 🕒 Mua gần nhất · 🏷️ Nguồn tô màu nền tảng); footer hành động như order-card.
  - Địa chỉ hiển thị dải mềm `.oc-addr` dưới header card.
  - Grid **2 cột/1 hàng** desktop, mobile 1 cột; phân trang chọn số dòng (10/20/50/100, mặc định 12).
- **Nguồn khách (loại khách)**: trường `source` — Facebook, TikTok, Zalo, Instagram, YouTube, Shopee, Website, Giới thiệu, Offline, Khác.
  - Form thêm/sửa khách: dropdown `Select` chuẩn portal kèm icon từng kênh; mặc định "Chưa phân loại".
  - Xuất CSV thêm cột Nguồn; `listCustomers` hỗ trợ lọc `source`.
  - Backend: cột `customers.source` tự thêm khi khởi động server (migration nhẹ qua INFORMATION_SCHEMA).
- **Card khách hàng**: desktop xếp tự động theo chiều rộng (`auto-fill`), **mobile 2 cột/1 hàng** với phiên bản thu gọn (avatar/tên/meta/hành động nhỏ gọn, badge nợ co lại).
- **Đồng bộ phong cách form đơn hàng cho 3 form**:
  - *Khách hàng*: 👤 Thông tin khách → 💰 Công nợ & điểm thưởng (hạn mức / điểm / hạn thanh toán) → 📝 Ghi chú.
  - *Phiếu nhập hàng*: 🏪 Nhà cung cấp & vận chuyển (chọn NCC bằng `Select` portal) → 📦 Sản phẩm nhập (thêm SP bằng `Select`, hint còn nợ NCC trực tiếp trên ô tiền đã trả) .
  - *Nhà cung cấp*: 🏪 Thông tin NCC → 🏦 Hóa đơn & thanh toán (mã số thuế / ngân hàng) → 📝 Ghi chú.
  - Tất cả dùng `FieldLabel` màu tone + section icon như form tạo đơn.
- **Toàn bộ form còn lại trong ứng dụng đồng bộ theo chuẩn này**:
  - *Khuyến mãi*: 🎟️ Thông tin mã (mã/tên/loại/giá trị/giảm tối đa/đơn tối thiểu) → 📅 Thời hạn & giới hạn; chọn "Loại giảm giá" bằng `Select` portal.
  - *Sản phẩm*: 🖼️ Hình ảnh & định danh → 💰 Giá bán → 📦 Kho hàng → 🏪 Giá bán theo mốc; chọn NCC bằng `Select`; kèm modal biến thể 🧬, combo 🧩, danh mục 🗂️ và điều chỉnh kho ⚡ cùng phong cách.
  - *Điều chỉnh tồn kho* / *Chuyển kho*: 📦 Sản phẩm + ⚠️ Lý do / 🚚 Tuyến chuyển + 📦 Danh sách SP + 📝 Ghi chú.
  - *Quỹ* (💵 nạp/rút), *Chi phí* (🧾 phiếu chi — danh mục bằng `Select`), *Thu nợ* (💰), *Nhà cung cấp — thanh toán* (💳).
  - *Người dùng* (👤 tài khoản — vai trò bằng `Select`, 🔑 đặt lại mật khẩu), *Cửa hàng* (🏪), *Cài đặt* (🏪 thông tin cửa hàng, 🖼️ logo, ⭐ tích lũy điểm), *Import Google Sheets* (🔗 cấu hình kết nối).
  - Modal "+ Thêm khách hàng nhanh" ở POS và trang Đơn hàng dùng chung bố cục section 👤; màn Đăng nhập dùng `FieldLabel`.
  - Các ô số áp dụng chuẩn **bấm vào chọn hết giá trị** (`onFocus select`) như form đơn.
- **Fix lỗi font tiếng Việt**: font **Be Vietnam Pro** được dùng trong CSS nhưng chưa hề được nạp → card POS và nhiều chỗ rơi về fallback hiển thị lệch dấu. Đã thêm Google Fonts (weights 400–800, `display=swap`) vào `index.html`.
- **Đồng bộ giao diện các trang theo phong cách trang Đơn hàng**:
  - Toàn bộ toolbar cũ `.toolbar` → `.orders-toolbar` chuẩn (Sản phẩm, Nhập hàng, Nhà cung cấp, Chi phí, Người dùng, Nhật ký, Chuyển kho); bộ lọc nhật ký đổi sang `Select` portal.
  - Danh sách dạng card chuyển hết sang hệ thống `order-card` / `oc-*`: **Nhà cung cấp** (avatar hash màu + meta icon + hành động), **Công nợ khách hàng** (card viền đỏ khi còn nợ, badge "Nợ" góc phải), **Phiếu nhập hàng** (badge trạng thái, meta tổng tiền/đã trả/còn nợ, mở rộng chi tiết SP), **Khuyến mãi** (🎁 + badge hoạt động), **Cửa hàng** (badge bật/tắt bấm được, card mờ khi khóa).
  - Tách `avatarTone` thành util dùng chung (`src/utils/avatar.ts`); thêm biến thể avatar emoji `.oc-avatar-flat`.
- **Fix "Hết hàng" POS**: pseudo-element `::before` có `content` bị corrupt byte (`\xa0`) → hiển thị lệch dấu tiếng Việt. Đã chuyển sang text thật trong JSX, bỏ `text-transform: uppercase`.
- **Hủy đơn đã thanh toán → hoàn tiền quỹ + trừ nợ khách**: trước đây `updateOrderStatus` khi hủy đơn paid chỉ xóa debt ledger mà **không ghi nhận hoàn tiền quỹ** (cash ledger). Đã sửa: thêm `logCash` type `spend` khi hủy/xóa đơn đã thanh toán tiền mặt → sổ quỹ và công nợ luôn đồng bộ.

### 2.6.5 (08/2026) — Thiết kế lại card POS & card khách hàng

**Card sản phẩm POS (thiết kế mới)**
- Ảnh **bo tròn riêng bên trong card** (tỉ lệ 4:3, padding quanh ảnh) thay vì full-bleed — nhìn gọn, nhẹ nhàng hơn; hover phóng ảnh nhẹ.
- Bỏ thanh màu đỉnh card → danh mục chuyển thành dòng **chấm màu + chữ in hoa** đặt trên cùng body, làm điểm nhận diện màu từng nhóm.
- Giá chính to bên trái + badge giá mốc "Từ X" (đỏ mềm) bên phải.
- Tồn kho thành **pill nền màu** (xanh đủ / vàng sắp hết / đỏ hết); thêm hint "**+ Thêm**" hiện khi hover (desktop).
- Sản phẩm hết hàng: overlay mờ giữa ảnh với nhãn **HẾT HÀNG** viền pill đỏ.
- Đang có trong giỏ: pill gradient "**3×**" góc phải ảnh + viền/tint theo màu danh mục.
- Mobile ≤980px/≤640px: grid 3 cột co giãn gọn, bỏ tier/hint để tối đa diện tích.

**Trang Khách hàng — chuyển bảng sang grid card**
- Mỗi khách là 1 **card**: avatar chữ cái đầu (màu theo hash tên), tên + SĐT, địa chỉ 1 dòng, badge công nợ đỏ khi còn nợ.
- Hàng stats 3 ô: **Chi tiêu | Điểm | Mua gần nhất**; ô Điểm bấm được (nền xanh khi có điểm) mở thẳng sổ điểm.
- Footer hành động: Lịch sử · Sửa · Xóa; khách còn nợ có viền đỏ mềm.
- Phân trang đồng bộ trang Orders: **chọn số khách mỗi trang** (10/20/50/100, mặc định **12**) + thông tin hiển thị x–y/tổng; mobile grid 1 cột.

### 2.6.4 (08/2026) — Cấu hình tích lũy điểm & sổ điểm khách hàng

**Cài đặt → Tích lũy điểm (mới)**
- Thêm card **⭐ Tích lũy điểm** trong trang Cài đặt với 2 thông số:
  - **Số điểm nhận / mỗi 1.000đ** (`pointsRate`, mặc định 1) — mua 50.000đ được 50 điểm.
  - **Giá trị quy đổi 1 điểm** (`pointValue`, mặc định 1.000đ) — dùng 10 điểm giảm 10.000đ.
- Lưu chung với thông tin cửa hàng (`store_info`), áp dụng ngay cho đơn mới.

**Áp dụng vào đơn hàng**
- Backend tính **điểm tích lũy** khi thanh toán theo `pointsRate` (đã có) và **giá trị điểm quy đổi** khi dùng điểm theo `pointValue` (mới — trước đây cứng 1000đ) ở mọi luồng: tạo đơn, sửa đơn, POS.
- Frontend POS + form tạo/sửa đơn đọc cấu hình: hint "1 điểm = Xđ", giới hạn dùng điểm, dòng giảm tiền quy đổi.
- Form đơn hiển thị dự kiến tích điểm ("⭐ Tích N điểm") ở footer khi thanh toán đã trả đủ.

**Sổ điểm khách hàng (lịch sử biến động)**
- Bảng mới `customer_points_ledger` (tự tạo khi khởi động server — không cần migrate tay): customer_id, type (earn/redeem/refund/adjust), ref_type/ref_id, points, note, created_by, created_at.
- Mọi cộng/trừ điểm đều **ghi sổ tự động**: tích điểm khi đơn `paid`, trừ khi dùng điểm, hoàn/thu hồi khi sửa đơn, hủy đơn, xóa đơn, đổi trạng thái thanh toán.
- Action mới `getCustomerPointsLedger` + trang **Khách hàng**: thêm cột **Điểm** (nhấp vào mở sổ) và nút **Lịch sử** — modal sổ điểm hiển thị số dư hiện có + bảng biến động (thời điểm, loại badge màu, tham chiếu đơn, ghi chú, ± điểm).

### 2.6.3 (08/2026) — Form đơn hàng & danh sách đơn (thiết kế lại)

**Phong cách thiết kế form tạo/sửa đơn hàng**
- Form chia theo **nhóm section** có icon + tiêu đề: 🛍️ Sản phẩm, 👤 Khách hàng, 🧾 Đơn hàng, 💳 Thanh toán & trạng thái, 💰 Chi phí, 📝 Ghi chú.
- **Tiêu đề ô nhập liệu**: chỉ tô màu theo nhóm (xanh dương/đỏ/vàng/tím/xanh lá), không dùng icon — tránh rối mắt. Icon chỉ dùng ở tiêu đề nhóm.
- Mục **Sản phẩm** đặt lên đầu form (dễ thao tác trên mobile); chọn sản phẩm bằng dropdown tùy chỉnh `ProductSearch` (tên + giá + tồn kho, sản phẩm đã thêm hiện badge ✓ và khóa, dropdown tự đóng sau khi chọn).
- Mọi dropdown (loại đơn, phương thức giao, NCC drop-ship, trạng thái, thanh toán, phương thức TT) dùng component `Select` thống nhất: nút trigger + bảng chọn `.dropdown`, giá trị đã chọn **tô màu theo tone**, dropdown tự đóng khi chọn (dùng `onMouseDown` để chắc chắn trên mobile).
- **Dropdown mở đúng hướng**: nếu không đủ chỗ bên dưới thì tự **bật ngược lên** (áp dụng cho `Select`, `DatePicker`, `CustomerSearch`, `ProductSearch`) → không bị tràn khỏi màn hình.
- Click-ra-ngoài để đóng dropdown bắt ở **pha capture** trên `document` (không bị `stopPropagation` của modal chặn).
- **Ngày giao**: component `DatePicker` lịch tùy chỉnh giống hệt dropdown (tháng ‹ ›, thứ T2–CN, hôm nay viền, ngày chọn gradient). Chỉ hiển thị khi tick **Đặt trước** và bắt buộc chọn.
- **Toggle Đặt trước**: checkbox tùy chỉnh (ô tick gradient + bóng) thay cho checkbox mặc định.
- **Khách hàng**: sau khi chọn, thu gọn thành chip (avatar + tên + SĐT + ✏️), nhấp vào để đổi; bỏ các trường Tên/SĐT/Địa chỉ trùng lặp. Trường chi phí bấm vào là chọn hết số để gõ thay thế (`onFocus select`).
- **Desktop ≥1100px**: modal mở rộng tối đa **1180px**, form xếp **2 cột theo nhóm** (trái: Sản phẩm cao + Ghi chú; phải: Khách hàng, Đơn hàng, Thanh toán, Chi phí), mỗi nhóm là **card** có viền/bóng, danh sách sản phẩm tự cuộn nội bộ → không phải cuộn dọc.
- **Mobile**: xếp 1 cột, mỗi nhóm vẫn giữ bộ lọc 2 cột/hàng.

**Danh sách đơn hàng: tìm kiếm, lọc & phân trang**
- Thanh công cụ tách 2 dòng: dòng trên là ô **tìm kiếm** + số đơn + nút ⬇ CSV; dòng dưới là cụm **bộ lọc** (trạng thái, thanh toán, loại đơn, đặt trước) dạng dropdown gọn + nút **✕ Bỏ lọc** khi có bộ lọc.
- **Mobile**: không còn cuộn ngang — ô tìm kiếm full-width, bộ lọc xếp **lưới 2 cột**, touch target 46px.
- **Phân trang**: thêm tùy chọn **số đơn mỗi trang** (10/20/50/100, mặc định **10**) bên cạnh thông tin "Hiển thị x–y / tổng".

**Form trả hàng (đơn hàng)**
- Thiết kế lại theo đúng ngôn ngữ form tạo đơn: nhóm section có icon (📦 Sản phẩm trả lại, 💰 Hoàn tiền & lý do), label tô màu (`FieldLabel`), dropdown **Lý do** dùng `Select` tone màu thay cho `<select>` native, ô **Số tiền hoàn lại** bấm vào chọn hết số, Ghi chú full-width, bố cục **1 cột** trên desktop (modal 760px, class `.form-stack-single`).

**Trang POS (bán hàng)**
- Giỏ hàng giờ là khối flex độc lập (`.pos-cart-inner`): khi thêm nhiều sản phẩm, **danh sách sản phẩm tự cuộn** trong vùng riêng (tối thiểu ~140px — luôn thấy sản phẩm), phần **thanh toán (khách hàng, giảm giá, VAT, tổng, nút thanh toán) luôn cố định hiển thị** — cả trên desktop (khung giỏ bên phải) lẫn mobile (sheet đáy màn hình).
- Form thanh toán POS giờ theo đúng phong cách form tạo đơn: chia **nhóm section có icon** (👤 Khách hàng, 💳 Thanh toán) giống `.form-section`, label dùng `FieldLabel` tô màu (Khách hàng lam, Tên khách primary, SĐT xanh lá, Giảm giá đỏ, VAT xanh lá, Thanh toán tím), **phương thức thanh toán dùng `Select` tone màu** (💵 Tiền mặt / 🏦 Chuyển khoản / 💳 Thẻ / 🚚 COD) thay cho `<select>` native, **toggle Đặt trước** dùng checkbox gradient `.preorder-toggle`, ô số bấm vào chọn hết (`onFocus select`). `FieldLabel` đã tách thành component dùng chung `components/ui/FieldLabel.tsx`.

### 2.6.2 (08/2026) — Quản lý sản phẩm & POS

**Sản phẩm (thiết kế lại)**
- Bộ lọc danh mục dạng chip (`.cat-filter`, `.chip`) thay cho select; quản lý danh mục qua modal (thêm/sửa/xóa, chọn màu sắc cho từng danh mục, đếm số sản phẩm).
- Card sản phẩm gọn (`.product-card`): ảnh + tên + badge danh mục màu + giá + tồn kho + badge **Sắp hết** khi tồn ≤ 5.
- Popup chi tiết sản phẩm (`.od-head`, `.od-costs` 3 cụm màu: giá mua / giá bán / lợi nhuận) với 3 tab **Biến thể / Combo / Lịch sử giá**.
- Upload ảnh sản phẩm ngay trong form (tự co về tối đa 1024px, dùng `uploadImage` → `/uploads/...`).
- **Tạo sản phẩm từ ảnh menu**: chọn ảnh → xem trước → nhận diện bằng AI vision (Google Gemini, provider `backend/src/providers/gemini.js`) → bảng duyệt sửa tên/giá/đơn vị rồi tạo hàng loạt.
- Backend: bảng `categories` mới; actions `listCategories` / `addCategory` / `updateCategory` / `deleteCategory` / `recognizeMenuItems` (quyền `products`); `listProducts` lọc theo `category`.
- Cấu hình: thêm `GEMINI_API_KEY` và `GEMINI_MODEL` vào `backend/.env` (mặc định `gemini-1.5-flash`).

**POS bán hàng**
- Card sản phẩm thiết kế lại: ảnh sản phẩm vuông + tên + giá + trạng thái tồn kho thay đổi theo số lượng còn lại:
  - **Hết hàng** (tồn = 0): card mờ, xám, khóa không bấm được.
  - **Sắp hết** (tồn ≤ 10): chữ vàng cảnh báo.
  - **Còn đủ**: chữ xanh.
- Đã chọn vào giỏ: viền nổi màu chủ đạo + badge số lượng đang chọn trên ảnh (`.pos-in-cart`), nhận biết ngay sản phẩm nào đã có trong đơn.
- Hover nhấc card kèm phóng nhẹ ảnh; mobile 3 cột gọn gàng, ẩn tag danh mục để tiết kiệm chỗ.

### 2.6.1 (08/2026) — Giao diện, hóa đơn & logo

**Dashboard & điều hướng**
- Dashboard gọn gàng hơn trên mobile (`.mini-grid`, `.mini-card`, `.mini-rows`, `.mini-row`), chi tiết chỉ hiển thị từ ≥ 641px (`.dash-detailed`).
- Bấm vào card trạng thái đơn / dòng đơn gần đây / kho chuyển sang trang tương ứng kèm bộ lọc sẵn:
  - `GET /orders` hỗ trợ `status` cách dấu phẩy (vd `status=processing,waiting_payment`).
  - `GET /products` hỗ trợ `stock=low` (tồn 1–5) và `stock=out` (hết hàng).
- Đơn gần đây trên Dashboard mở thẳng modal chi tiết (không cần sang trang Đơn hàng); đổi trạng thái trong modal cập nhật ngay danh sách.

**Modal chi tiết đơn (dùng chung)**
- Tách thành component chung `frontend/src/components/OrderDetailModal.tsx` dùng cho cả trang Đơn hàng và Dashboard.
- Bảng sản phẩm chỉ hiện Sản phẩm / SL / Đơn giá / Thành tiền (bỏ lợi nhuận từng dòng); lợi nhuận chỉ hiện ở cụm tổng đơn (💰 Doanh thu xanh, 📊 Lợi nhuận đơn tím).
- Thông tin khách hàng + đơn hàng nằm 1 hàng 2 cột (giữ 2 cột cả trên mobile); bảng sản phẩm giữ dạng dòng trên mobile, cuộn ngang khi quá rộng.
- Nút chức năng (đổi trạng thái, 🗑 xóa, 🖨️ in, ✏️ sửa) dồn lên tiêu đề modal qua prop `headActions` của `Modal.tsx`.

**In hóa đơn & chụp ảnh**
- `PrintInvoice.tsx` thêm nút chọn khổ A4 / 58mm, nút **📸 Chụp ảnh** chụp toàn hóa đơn (dùng `html-to-image`), xem trước rồi **⬇ Lưu ảnh** hoặc **📤 Chia sẻ** (`navigator.share`, fallback tải về; cần HTTPS trên iOS).

**Logo cửa hàng**
- Trang **Cài đặt** cho upload logo (tự co về tối đa 512px → PNG), xem trước, đổi/xóa.
- Logo hiển thị **chìm trên hóa đơn** (`.print-watermark`), làm **icon trên tab trình duyệt**, và **logo góc trái** trong app (sidebar + topbar + drawer).
- Backend thêm route `GET /logo`: trả logo đã lưu từ `store_info` (key `logo`), chưa có thì fallback về `frontend/dist/icons/app-icon.svg`.
- `index.html` (favicon, apple-touch-icon) và `manifest.webmanifest` trỏ icon về `/logo`.
- Service worker không cache `/logo` (luôn lấy mới để đổi icon kịp thời).

**Sửa lỗi & hạ tầng**
- Sửa lỗi **"Data too long for column 'v'"** khi lưu logo: cột `store_info.v` nâng từ `TEXT` lên `LONGTEXT` (áp dụng cả `db/schema.sql` lẫn DB đang chạy).
- `saveStoreInfo` đổi sang **upsert từng key** (`ON DUPLICATE KEY UPDATE`) — không còn xóa hết rồi chèn lại, giữ nguyên các cấu hình khác (điểm tích lũy, import...).
- `vite.config.ts` thêm proxy `/logo` cho dev server.