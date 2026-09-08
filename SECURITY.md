# Chính sách bảo mật

## Báo cáo lỗ hổng

Nếu bạn phát hiện lỗi bảo mật, **đừng mở Issue công khai**. Hãy gửi tới maintainer
qua email / tin nhắn riêng (hoặc GitHub Private Vulnerability Reporting nếu được bật).

Nội dung nên có:

- Vị trí lỗ hổng (file/lệnh liên quan) và cách tái hiện tối giản.
- Mức ảnh hưởng + khai thác thực tế nếu biết.

Chúng tôi cam kết:

- Phản hồi trong vòng 72 giờ.
- Không tiết lộ lỗ hổng với bên thứ ba trước khi bản vá được phát hành.

## Phạm vi

- `backend/src/**` — xác thực JWT, phân quyền, SQL injection, xử lý upload/backup.
- Cấu hình production (`deploy/`, `backend/.env.example`).

Hướng dẫn an toàn khi tự vận hành: xem mục "Ghi chú bảo mật" trong
`deploy/windows-tunnel/README.md`.