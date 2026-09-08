# AGENTS.md — Hướng dẫn cho agent / AI khi làm việc trong repo này

Mục tiêu giúp AI (và lập trình viên) hiểu nhanh repo và không phá vỡ quy ước.

## Tổng quan

Monorepo hai phần, toàn bộ tiếng Việt:

- `backend/` — Node.js ≥18, **ES module**, Express, MySQL (`mysql2/promise`).
  Chạy trên `:4000`, tự serve `frontend/dist` khi đã build.
- `frontend/` — React 19 + TypeScript + Vite, chạy `:5173` (proxy `/api`, `/uploads`, `/logo`
  và `/manifest.webmanifest` → `http://127.0.0.1:4000`).

## Lệnh quan trọng

```bash
# Backend
cd backend
npm run db:setup            # tạo DB + bảng (idempotent, IF NOT EXISTS)
npm run db:seed             # tạo admin mặc định (admin/admin123) + cửa hàng mặc định
npm run dev                 # node --watch src/server.js

# Frontend — LUÔN chạy 2 lệnh này trước khi kết thúc, bắt buộc sạch:
cd frontend
npm run typecheck
npm run build
```

## Kiến trúc cốt lõi

- `POST /api` với body `{ action, ...payload }` — registry trong `backend/src/actions/index.js`.
- Auth: JWT (header `Authorization: Bearer <token>`); role admin bỏ qua phân quyền màn hình.
- Mỗi action: `backend/src/actions/<domain>.actions.js`. Muốn action mới phải:
  1. Tạo hàm trong file action.
  2. Đăng ký trong `index.js` (registry) — và cân nhắc `PUBLIC_ACTIONS`/`ADMIN_ACTIONS`.
  3. Nếu nhân viên cần phân quyền màn hình → thêm vào `ACTION_PERMISSION` (`permissions.js`).
  4. Action chỉ đọc → thêm `NO_LOG_ACTIONS` trong `app.js`.
- SQL: **bắt buộc tham số hóa** (`query(sql, [params])`) — cấm ghép chuỗi.
- Lỗi nghiệp vụ: `throw new ApiError(status, message, code)`.
- Nghiệp vụ tồn kho/đối soát nằm ở `inventory.js`, `ledger.js`, `pricing.js`, `promo.js`, `points.js`.

## Frontend

- Giao diện đã được đồng bộ theo **thiết kế thẻ đơn hàng**: `.order-cards`/`.order-card`,
  `form-stack` (2 cột) + `form-section`, input dùng class `field-input`.
  Tham chiếu `frontend/DESIGN_SYSTEM.md` trước khi thêm UI.
- Component dùng chung: `frontend/src/components/`. Gọi API qua `src/api.ts` (function theo từng nghiệp vụ).
- Có `frontend/dist/` được sinh ra bởi build — **không sửa tay**.

## Môi trường / Secrets

- `backend/.env` (bị gitignore) — mẫu tại `.env.example`. Không bao giờ commit giá trị thật.
- `backend/backups/*.sql` và `backend/public/uploads/*` bị gitignore.

## Convention code

- Backend: ES module, hàm mỗi action có tên khớp action.
- Frontend: TypeScript, không `any` lan tràn.
- Không thêm bình luận thừa.
- Commit: `feat:`, `fix:`, `docs:` — xem `CONTRIBUTING.md`.