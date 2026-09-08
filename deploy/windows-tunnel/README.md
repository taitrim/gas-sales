# Deploy GAS Sales Pro — Windows + Cloudflare Tunnel (tên miền riêng)

Kiến trúc: **một cổng duy nhất `:4000`**. Backend Express tự serve `frontend/dist` (đã build)
nên toàn bộ web + API nằm trên `http://localhost:4000`. Cloudflare Tunnel cầu từ
`https://<tên-miền>` (443) về `localhost:4000`. Không cần Vite dev server, không cần nginx.

```
Internet → Cloudflare (HTTPS, CDN, bảo vệ DDoS)
        → cloudflared (service chạy trên máy, kết nối ra Cloudflare)
        → http://localhost:4000 (backend + frontend dist)
```

Mã nguồn đích cần copy: toàn bộ repo (KHÔNG copy `node_modules`, `dist`, `.env`, `backups`).
Bên dưới là runbook từng bước trên máy Windows đích (chạy PowerShell **Administrator**).

---

## 0. Kiến trúc & chuẩn bị trước

| Thứ | Nội dung |
|---|---|
| Node.js | ≥ 20 LTS |
| MySQL | 8.x (cài kèm mysqldump — yêu cầu cho backup) |
| cloudflared | bản Windows amd64 (có thể chạy `tunnel.bat` để tự tải) |
| Domain | Phải nằm trong Cloudflare (nameservers = Cloudflare), ví dụ `shop.example.com` |
| Dữ liệu | Muốn giữ dữ liệu từ máy cũ → export `dump.sql` (xem bước 3b) |

Nếu domain CHƯA trên Cloudflare: đăng ký account Cloudflare → **Add a site** → nhập domain →
Cloudflare gán 2 nameserver → vào máy đăng ký domain trỏ NS về 2 nameserver đó → chờ
vài giờ (check bằng `https://https://www.whatsmydns.net` hoặc Dash). (Bước 8 trong runbook.)

---

## 1. Cài môi trường (Node + MySQL + cloudflared)

Mở PowerShell Administrator, chạy:

```powershell
cd D:\deploy\gas-sales        # thư mục chứa mã nguồn & deploy
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\windows-tunnel\install-requirements.ps1
```

Script kiểm tra và (nếu có winget) tự cài: node LTS, MySQL 8, cloudflared.
Nếu winget không có hoặc cài lỗi: cài thủ công theo link in ra rồi chạy lại.

> MySQL cài xong cần nhớ mật khẩu **root**. Sau khi cài, mở "MySQL Command Line
> Client" và nhập root password để xác nhận.

## 2. Copy mã nguồn + cài dependencies + build frontend

Từ máy cũ, copy thư mục dự án sang máy đích. Bỏ `node_modules`, `dist`, `backend/.env`, `backend/backups`.

Trên máy đích:

```powershell
cd D:\deploy\gas-sales\backend
npm ci
cd ..\frontend
npm ci
npm run build        # sinh frontend\dist → backend sẽ self-serve
```

## 3. Database

### 3a. Cấu hình `.env` production (sinh JWT secret ngẫu nhiên + tạo trước DB user)

```powershell
cd D:\deploy\gas-sales
.\deploy\windows-tunnel\configure-env.ps1 -Domain shop.example.com
```

Script này:
- Đọc `.env` cũ nếu có (giữ lại GEMINI_API_KEY, cấu hình import Google Sheets...).
- Sinh **JWT_SECRET** ngẫu nhiên 64 hex + **DB_PASSWORD** ngẫu nhiên.
- Ghi `backend/.env` mới: `NODE_ENV=production`, `CORS_ORIGIN=https://shop.example.com`, `DB_USER=gas`.

### 3b. Tạo DB + import dữ liệu

Có 2 tình huống:

**Giữ dữ liệu máy cũ** (khuyến nghị — bạn đang có dữ liệu thật):
Trên MÁY CŨ, export trước:
```powershell
mysqldump --host=127.0.0.1 --user=root --password --default-character-set=utf8mb4 --single-transaction --routines gas_sales > dump.sql
```
Copy `dump.sql` sang máy đích rồi chạy:
```powershell
.\deploy\windows-tunnel\setup-db.ps1 -DumpPath D:\deploy\dump.sql -RootPassword "my-root-pw" -AdminPassword "MatKhauAdm!n@2026"
```
`-AdminPassword` bắt buộc đưa ra → script đổi mật khẩu tài khoản admin thành mật khẩu mới ngay (kết thúc vấn đề `admin123`).

**Máy mới trắng (không import)**:
```powershell
.\deploy\windows-tunnel\setup-db.ps1 -RootPassword "my-root-pw" -AdminPassword "MatKhauAdm!n@2026"
```
Script sẽ: chạy `node db/setup.js` (tạo schema), `db/seed.js` (tạo admin mặc định `admin/admin123`), rồi đổi admin password thành `-AdminPassword`.

> `setup-db.ps1` + `configure-env.ps1` tự tạo user `gas` trong MySQL (không phải root) và
> cập nhật `DB_USER/DB_PASSWORD` trong `.env`.

## 4. Chạy thử backend (trước khi mở tunnel)

```powershell
cd D:\deploy\gas-sales\backend
node src/server.js
```

Kiểm tra ngay trên máy đó: mở `http://localhost:4000` — phải ra giao diện đăng nhập.
Đăng nhập bằng admin + mật khẩu vừa đặt. Xong bấm Ctrl+C.

## 5. Cài backend chạy tự động (Windows Service / Task Scheduler)

```powershell
.\deploy\windows-tunnel\setup-backend-service.ps1
```

Tạo Scheduled Task **"GAS Sales Backend"**: chạy khi khởi động Windows + tự restart
khi crash mỗi 1 phút. Kiểm tra:

```powershell
Get-Service | ? Name -like "*Gas*"
# Hoặc: Get-ScheduledTask -TaskName "GAS Sales Backend"
Start-Service "GAS Sales Backend"  # như bắt đầu ngay
```

## 6. Cloudflare: trỏ domain (1 lần, nếu chưa)

1. Tạo tài khoản [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → nhập domain.
2. Cloudflare đưa 2 nameserver (kiểu `xxx.ns.cloudflare.com`).
3. Vào bảng điều khiển của bên đăng ký domain, đổi NS → 2 nameserver đó.
4. Chờ DNS propagate (vài phút → vài giờ). Trên Dash, trạng thái site thành **Active**.

> Túy `trycloudflare.com` (tunnel.bat) không cần domain — nhưng tên miền riêng + NS là bắt buộc ở đây.

## 7. Tạo Cloudflare Tunnel + cài cloudflared service

```powershell
.\deploy\windows-tunnel\setup-tunnel.ps1 -Domain shop.example.com
```

Script:
1. `cloudflared tunnel login` → mở trình duyệt đăng nhập Cloudflare, chọn domain → tự lưu `cert.pem`.
   (Bước này có 2 phút để user hoàn tất.)
2. `cloudflared tunnel create gas-sales` → tạo tunnel + credentials JSON.
3. `cloudflared tunnel route dns gas-sales shop.example.com` → tạo bản ghi CNAME tự động.
4. Ghi `config.yml` vào `%USERPROFILE%\.cloudflared\config.yml` (ingress: hostname → `http://localhost:4000`).
5. `cloudflared service install` + `Start-Service cloudflared`.

Kiểm tra:

```powershell
cloudflared tunnel info gas-sales
Get-Service cloudflared
```

## 8. Backup tự động (Task Scheduler 02:00 hằng ngày)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\setup-backup-task.ps1
```

Backup lưu `backend/backups/backup-*.sql`, tự xóa bản cũ hơn 14 ngày (sửa `-KeepDays`).
**Nên copy backup ra ngoài** (OneDrive/Cloud) để phòng hỏng ổ.

## 9. Kiểm tra toàn diện trước khi công khai

```powershell
.\deploy\windows-tunnel\check-prod.ps1 -Domain shop.example.com
```

Script kiểm tra: health local + qua HTTPS, login admin, backup thử, đảm bảo `admin123`
không còn là mật khẩu. Đúng mọi bước → bật domain trong Cloudflare (DNS đã tạo sẵn) →
mọi người truy cập `https://shop.example.com`.

## 10. Vận hành & rollback

| Tình huống | Lệnh / việc làm |
|---|---|
| Xem backend log | Task Scheduler → bật log chuẩn; hoặc chạy thủ công `node src/server.js` trên console |
| Restart backend | `Restart-Service "GAS Sales Backend"` |
| Restart tunnel | `Restart-Service cloudflared` |
| Cập nhật code | `git pull` (sau khi có remote) → `cd frontend; npm run build` → `clear-service?` không cần, chỉ `Restart-Service "GAS Sales Backend"` |
| Báo lỗi | `POST /api` trả `{success:false,error}` hệ thống; check `config.js` **JWT_SECRET** phải đổi mỗi khi set lại từ đầu |
| Mất toàn bộ máy | Khôi phục bằng `backend/backups/*.sql` (import lại sau khi setup) |

## Ghi chú bảo mật

- `backend/.env` và `backend/backups/` **KHÔNG được commit** (đã trong `.gitignore`).
- MySQL chỉ bind `127.0.0.1` (mặc định) — tunnel là cửa vào duy nhất, không mở port 4000 ra internet.
- Đổi mật khẩu admin ngay (bước 3) — không bao giờ để mặc định `admin123`.
- rate-limit/auth/phân quyền màn hình đã bật sẵn ở backend; CORS chỉ nhận domain của bạn.