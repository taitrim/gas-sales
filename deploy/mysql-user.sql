-- ============================================================
-- Tạo user MySQL riêng (KHÔNG dùng root trong production)
-- Cách chạy (1 lần khi setup server):
--   mysql -u root -p < deploy/mysql-user.sql
-- Sau đó cập nhật backend/.env: DB_USER=gas, DB_PASSWORD=<mat-khau-da-set>
-- ============================================================

CREATE USER IF NOT EXISTS 'gas'@'localhost' IDENTIFIED BY 'MAT_KHAU_MANH_HAY_DOI';
GRANT ALL PRIVILEGES ON gas_sales.* TO 'gas'@'localhost';
GRANT SELECT, RELOAD, LOCK TABLES, REPLICATION CLIENT ON *.* TO 'gas'@'localhost';
FLUSH PRIVILEGES;

-- Ghi chú bảo mật:
--  - "ALL PRIVILEGES ON gas_sales.*" đủ cho ứng dụng đọc/ghi.
--  - Hai GRANT *.* dành cho mysqldump (backup) và process list.
--  - Nếu không cần backup qua user này, có thể bỏ 2 dòng GRANT trên và
--    dùng user/admin root riêng để chạy backup (xem deploy/auto-backup.ps1).
