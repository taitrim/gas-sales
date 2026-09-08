# Hướng dẫn đóng góp cho GAS Sales Pro

Cảm ơn bạn đã dành thời gian cải tiến dự án! Dưới đây là quy ước để mọi người
làm việc chung dễ dàng. Đọc hết mục này trước khi mở Pull Request.

## Mã nguồn & giấy phép

- Dự án phát hành theo **MIT License** (`LICENSE`). Mọi đóng góp được coi là đóng
  góp theo cùng giấy phép này.
- Trước khi đóng góp, hãy **không** commit bất kỳ bí mật nào: `.env`, file backup
  `.sql`, API key... (danh sách đầy đủ trong `.gitignore`).

## Môi trường phát triển

Yêu cầu: Node.js ≥ 18 (khuyến nghị 20+), MySQL 8+.

```bash
# Backend
cd backend
npm install
copy .env.example .env        # sửa DB_PASSWORD, JWT_SECRET, ...
npm run db:setup              # tạo database + bảng
npm run db:seed               # tạo admin mặc định (admin/admin123)
npm run dev                   # http://localhost:4000  (hoặc: node src/server.js)

# Frontend (shell khác)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxy /api -> :4000)
```

> Đổi mật khẩu `admin123` sau lần đăng nhập đầu tiên.

## Kiểm tra trước khi gửi (quan trọng)

Luôn chạy 2 lệnh sau ở `frontend` và đảm bảo **không lỗi**:

```bash
cd frontend
npm run typecheck             # tsc --noEmit
npm run build                 # tsc --noEmit && vite build
```

Backend không có test tự động; hãy tự kiểm tra nghiệp vụ bạn đụng tới
(bán hàng → tồn kho; nhập hàng → cộng tồn; đối soát NCC...) bằng cách gọi
`POST /api` hoặc thao tác trên giao diện.

## Quy ước code

- **Backend**: ES module (`"type": "module"`), cấu trúc action trong
  `backend/src/actions/*.actions.js`, đăng ký vào `actions/index.js`.
  Toàn bộ SQL dùng **tham số hóa** (`?` placeholders) — tuyệt đối không ghép chuỗi.
  Lỗi nghiệp vụ dùng `ApiError(status, message, code)`.
- **Frontend**: React + TypeScript, phong cách thẻ đơn hàng chuẩn (`.order-card`,
  `form-stack` 2 cột, `field-input`) — tham khảo `frontend/DESIGN_SYSTEM.md`.
  Thành phần dùng chung đặt trong `frontend/src/components/`.
- Các action **chỉ đọc** nên thêm vào `NO_LOG_ACTIONS` trong `app.js` để không nhiễu nhật ký.
- Action **mới** phải đánh giá thêm vào: `PUBLIC_ACTIONS` / `ADMIN_ACTIONS` /
  `ACTION_PERMISSION` (`permissions.js`) nếu cần phân quyền màn hình.
- Không thêm bình luận thừa; viết tên biến/hàm có nghĩa.

## Cách đóng góp

1. Fork repo → tạo nhánh từ `master`:
   ```bash
   git checkout -b feat/<tên-ngắn>
   ```
2. Commit gọn, message mô tả rõ thay đổi (style: `fix: ...`, `feat: ...`, `docs: ...`).
3. Push nhánh lên fork → mở **Pull Request** vào `master`.
4. Mô tả ngắn gọn: vấn đề, cách sửa, cách kiểm thử. Báo cáo kết quả
   `npm run typecheck` + `npm run build`.

## Báo cáo lỗi / đề xuất

Mở **GitHub Issue** với: bước tái hiện, log lỗi (che bí mật), phiên bản
(brand `backend/package.json`), môi trường (OS, Node, MySQL).

## An toàn bảo mật

Không đăng lỗi bảo mật công khai — làm theo `SECURITY.md`.

Cảm ơn bạn đã giúp dự án tốt hơn!