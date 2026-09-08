-- GAS Sales Pro - MySQL Schema v2.8
-- Port từ Google Apps Script (DB_SCHEMA) sang MySQL InnoDB, giữ nguyên định dạng ID gốc
-- Chạy: npm run db:setup

CREATE DATABASE IF NOT EXISTS gas_sales
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gas_sales;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         VARCHAR(40)  NOT NULL PRIMARY KEY,
  username   VARCHAR(100) NOT NULL,
  password   VARCHAR(255) NOT NULL,
  full_name  VARCHAR(150) NOT NULL DEFAULT '',
  role       VARCHAR(20)  NOT NULL DEFAULT 'staff',
  store_id   VARCHAR(40)  NULL,
  permissions JSON       NULL,
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL,
  approve    TINYINT(1)   NOT NULL DEFAULT 0,
  updated_at DATETIME     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_username (username),
  KEY idx_users_role (role),
  KEY idx_users_store (store_id)
) ENGINE=InnoDB;

-- ============================================================
-- STORE_INFO (key/value)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_info (
  k VARCHAR(100) NOT NULL PRIMARY KEY,
  v LONGTEXT NULL
) ENGINE=InnoDB;

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id        VARCHAR(40)  NOT NULL PRIMARY KEY,
  name      VARCHAR(200) NOT NULL,
  phone     VARCHAR(50)  NULL,
  email     VARCHAR(150) NULL,
  address   VARCHAR(255) NULL,
  tax_code  VARCHAR(50)  NULL,
  bank_info TEXT         NULL,
  note      TEXT         NULL,
  updated_at DATETIME    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id                 VARCHAR(40)  NOT NULL PRIMARY KEY,
  name               VARCHAR(200) NOT NULL,
  phone              VARCHAR(50)  NULL,
  address            VARCHAR(255) NULL,
  source             VARCHAR(50)  NULL,
  total_spent        DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_debt         DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit_limit       DECIMAL(14,2) NOT NULL DEFAULT 0,
  points             INT           NOT NULL DEFAULT 0,
  payment_terms_days INT           NOT NULL DEFAULT 0,
  last_purchase_date DATETIME     NULL,
  notes              TEXT         NULL,
  updated_at         DATETIME     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customers_phone (phone)
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id               VARCHAR(40)   NOT NULL PRIMARY KEY,
  sku              VARCHAR(100)  NULL,
  name             VARCHAR(255)  NOT NULL,
  image            TEXT          NULL,
  category         VARCHAR(100)  NULL,
  supplier_id      VARCHAR(40)   NULL,
  import_price     DECIMAL(14,2) NOT NULL DEFAULT 0,
  retail_price     DECIMAL(14,2) NOT NULL DEFAULT 0,
  wholesale_price  DECIMAL(14,2) NOT NULL DEFAULT 0,
  stock            DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit             VARCHAR(50)   NULL,
  pricing_tiers_json JSON        NULL,
  is_combo          TINYINT(1)    NOT NULL DEFAULT 0,
  updated_at       DATETIME      NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_sku (sku),
  KEY idx_products_category (category),
  KEY idx_products_supplier (supplier_id),
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- IMPORTS (phiếu nhập hàng)
-- ============================================================
CREATE TABLE IF NOT EXISTS imports (
  id             VARCHAR(40)   NOT NULL PRIMARY KEY,
  supplier_id    VARCHAR(40)   NULL,
  supplier_name  VARCHAR(200)  NULL,
  total_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by     VARCHAR(40)   NULL,
  created_at     DATETIME      NOT NULL,
  shipping_fee   DECIMAL(14,2) NOT NULL DEFAULT 0,
  carrier        VARCHAR(100)  NULL,
  payment_status VARCHAR(20)   NOT NULL DEFAULT 'unpaid',
  paid_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  store_id       VARCHAR(40)   NULL,
  updated_at     DATETIME      NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_imports_supplier (supplier_id),
  KEY idx_imports_store (store_id),
  CONSTRAINT fk_imports_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- IMPORT_DETAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS import_details (
  id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  import_id    VARCHAR(40)   NOT NULL,
  product_id   VARCHAR(40)   NULL,
  sku          VARCHAR(100)  NULL,
  product_name VARCHAR(255)  NULL,
  quantity     DECIMAL(14,3) NOT NULL DEFAULT 0,
  import_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  subtotal     DECIMAL(14,2) NOT NULL DEFAULT 0,
  KEY idx_import_details_import (import_id),
  KEY idx_import_details_product (product_id),
  CONSTRAINT fk_import_details_import FOREIGN KEY (import_id)
    REFERENCES imports(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                  VARCHAR(40)   NOT NULL PRIMARY KEY,
  customer_id         VARCHAR(40)   NULL,
  customer_name       VARCHAR(200)  NULL,
  phone               VARCHAR(50)   NULL,
  address             VARCHAR(255)  NULL,
  order_type          VARCHAR(30)   NULL,
  subtotal            DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount            DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_fee        DECIMAL(14,2) NOT NULL DEFAULT 0,
  surcharge           DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method      VARCHAR(30)   NULL,
  status              VARCHAR(30)   NOT NULL DEFAULT 'pending',
  payment_status      VARCHAR(30)   NULL,
  shipping_method     VARCHAR(30)   NULL,
  carrier             VARCHAR(100)  NULL,
  dropship_supplier_id VARCHAR(40)  NULL,
  created_by          VARCHAR(40)   NULL,
  created_at          DATETIME      NOT NULL,
  store_id            VARCHAR(40)   NULL,
  note                TEXT          NULL,
  delivery_date       DATETIME      NULL,
  tax_rate            DECIMAL(5,2)  NOT NULL DEFAULT 0,
  tax_amount          DECIMAL(14,2) NOT NULL DEFAULT 0,
  points_earned       INT           NOT NULL DEFAULT 0,
  points_used         INT           NOT NULL DEFAULT 0,
  points_value        DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_preorder         TINYINT(1)    NOT NULL DEFAULT 0,
  updated_at          DATETIME      NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_status (status),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_store (store_id),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- ORDER_DETAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_details (
  id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id     VARCHAR(40)   NOT NULL,
  product_id   VARCHAR(40)   NULL,
  variant_id   VARCHAR(40)   NULL,
  sku          VARCHAR(100)  NULL,
  product_name VARCHAR(255)  NULL,
  quantity     DECIMAL(14,3) NOT NULL DEFAULT 0,
  price        DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  subtotal     DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_price   DECIMAL(14,2) NOT NULL DEFAULT 0,
  KEY idx_order_details_order (order_id),
  KEY idx_order_details_product (product_id),
  CONSTRAINT fk_order_details_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- SUPPLIER_TRANSACTIONS (giao dịch thanh toán NCC)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_transactions (
  id          VARCHAR(40)   NOT NULL PRIMARY KEY,
  supplier_id VARCHAR(40)   NULL,
  type        VARCHAR(20)   NOT NULL DEFAULT 'payment',
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  note        TEXT          NULL,
  created_by  VARCHAR(40)   NULL,
  created_at  DATETIME      NOT NULL,
  KEY idx_supplier_tx_supplier (supplier_id),
  CONSTRAINT fk_supplier_tx_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
  id         VARCHAR(40)  NOT NULL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  address    VARCHAR(255) NULL,
  phone      VARCHAR(50)  NULL,
  manager_id VARCHAR(40)  NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at DATETIME     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- EXPENSES (phiếu chi)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id          VARCHAR(40)   NOT NULL PRIMARY KEY,
  category    VARCHAR(100)  NULL,
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  note        TEXT          NULL,
  created_by  VARCHAR(40)   NULL,
  created_at  DATETIME      NOT NULL,
  store_id    VARCHAR(40)   NULL,
  KEY idx_expenses_created (created_at),
  KEY idx_expenses_category (category)
) ENGINE=InnoDB;

-- ============================================================
-- CASH_LEDGER (sổ quỹ tiền mặt)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_ledger (
  id          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(20)   NOT NULL,                       -- receive | spend
  category    VARCHAR(30)   NOT NULL DEFAULT 'manual',      -- order|import|supplier|expense|manual
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  ref_id      VARCHAR(40)   NULL,
  note        TEXT          NULL,
  created_by  VARCHAR(40)   NULL,
  created_at  DATETIME      NOT NULL,
  KEY idx_cash_ledger_created (created_at),
  KEY idx_cash_ledger_ref (ref_id)
) ENGINE=InnoDB;

-- ============================================================
-- AUDIT_LOGS (nhật ký hoạt động)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(40)   NULL,
  username   VARCHAR(100)  NULL,
  action     VARCHAR(100)  NOT NULL,
  entity     VARCHAR(100)  NULL,
  entity_id  VARCHAR(100)  NULL,
  detail     TEXT          NULL,
  ip         VARCHAR(64)   NULL,
  created_at DATETIME      NOT NULL,
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_action (action),
  KEY idx_audit_logs_user (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- CUSTOMER_DEBT_LEDGER (sổ công nợ khách hàng)
-- amount: dương = phát sinh nợ, âm = trả nợ/trừ nợ
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_debt_ledger (
  id          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(40)   NOT NULL,
  type        VARCHAR(20)   NOT NULL,                       -- order | payment | refund | adjust
  ref_type    VARCHAR(30)   NULL,                           -- order | return | manual
  ref_id      VARCHAR(40)   NULL,
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  note        TEXT          NULL,
  created_by  VARCHAR(40)   NULL,
  created_at  DATETIME      NOT NULL,
  KEY idx_debt_customer (customer_id),
  KEY idx_debt_ref (ref_id),
  CONSTRAINT fk_debt_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- SỔ ĐIỂM TÍCH LŨY KHÁCH HÀNG
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_points_ledger (
  id          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(40)   NOT NULL,
  type        VARCHAR(20)   NOT NULL,                       -- earn | redeem | refund | adjust
  ref_type    VARCHAR(30)   NULL,                           -- order | manual
  ref_id      VARCHAR(40)   NULL,
  points      INT           NOT NULL DEFAULT 0,
  note        TEXT          NULL,
  created_by  VARCHAR(40)   NULL,
  created_at  DATETIME      NOT NULL,
  KEY idx_points_customer (customer_id),
  KEY idx_points_ref (ref_id),
  CONSTRAINT fk_points_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- RETURNS (trả hàng / hoàn tiền)
-- ============================================================
CREATE TABLE IF NOT EXISTS returns (
  id            VARCHAR(40)   NOT NULL PRIMARY KEY,
  order_id      VARCHAR(40)   NOT NULL,
  customer_id   VARCHAR(40)   NULL,
  customer_name VARCHAR(200)  NULL,
  subtotal      DECIMAL(14,2) NOT NULL DEFAULT 0,
  refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  reason        VARCHAR(255)  NULL,
  note          TEXT          NULL,
  created_by    VARCHAR(40)   NULL,
  created_at    DATETIME      NOT NULL,
  store_id      VARCHAR(40)   NULL,
  KEY idx_returns_order (order_id),
  KEY idx_returns_created (created_at),
  CONSTRAINT fk_returns_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS return_details (
  id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  return_id    VARCHAR(40)   NOT NULL,
  product_id   VARCHAR(40)   NULL,
  sku          VARCHAR(100)  NULL,
  product_name VARCHAR(255)  NULL,
  quantity     DECIMAL(14,3) NOT NULL DEFAULT 0,
  price        DECIMAL(14,2) NOT NULL DEFAULT 0,
  subtotal     DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_price   DECIMAL(14,2) NOT NULL DEFAULT 0,
  KEY idx_return_details_return (return_id),
  CONSTRAINT fk_return_details_return FOREIGN KEY (return_id)
    REFERENCES returns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- PROMOTIONS (khuyến mãi)
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
  id              VARCHAR(40)   NOT NULL PRIMARY KEY,
  code            VARCHAR(100)  NOT NULL,
  name            VARCHAR(255)  NOT NULL DEFAULT '',
  discount_type   VARCHAR(20)   NOT NULL DEFAULT 'percent', -- percent | amount
  discount_value  DECIMAL(14,2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_discount    DECIMAL(14,2) NOT NULL DEFAULT 0,         -- 0 = không giới hạn
  active          TINYINT(1)    NOT NULL DEFAULT 1,
  start_date      DATETIME      NULL,
  end_date        DATETIME      NULL,
  usage_limit     INT           NOT NULL DEFAULT 0,         -- 0 = không giới hạn
  used_count      INT           NOT NULL DEFAULT 0,
  created_by      VARCHAR(40)   NULL,
  created_at      DATETIME      NOT NULL,
  UNIQUE KEY uk_promotions_code (code)
) ENGINE=InnoDB;

-- ============================================================
-- STOCK_ADJUSTMENTS (kiểm kê / điều chỉnh tồn kho)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id           VARCHAR(40)   NOT NULL PRIMARY KEY,
  product_id   VARCHAR(40)   NOT NULL,
  sku          VARCHAR(100)  NULL,
  product_name VARCHAR(255)  NULL,
  old_stock    DECIMAL(14,3) NOT NULL DEFAULT 0,
  new_stock    DECIMAL(14,3) NOT NULL DEFAULT 0,
  change_qty   DECIMAL(14,3) NOT NULL DEFAULT 0,            -- new - old (dương/âm)
  reason       VARCHAR(255)  NULL,
  note         TEXT          NULL,
  created_by   VARCHAR(40)   NULL,
  created_at   DATETIME      NOT NULL,
  store_id     VARCHAR(40)   NULL,
  KEY idx_stock_adj_product (product_id),
  KEY idx_stock_adj_created (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCT_VARIANTS (biến thể sản phẩm: size, màu...)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id          VARCHAR(40)   NOT NULL PRIMARY KEY,
  product_id  VARCHAR(40)   NOT NULL,
  name        VARCHAR(150)  NOT NULL,
  sku         VARCHAR(100)  NULL,
  price       DECIMAL(14,2) NOT NULL DEFAULT 0,
  stock       DECIMAL(14,3) NOT NULL DEFAULT 0,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL,
  KEY idx_pv_product (product_id),
  CONSTRAINT fk_pv_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCT_COMBOS (combo: 1 combo gồm nhiều thành phần, bán combo trừ kho thành phần)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_combos (
  id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  combo_id     VARCHAR(40)   NOT NULL,
  product_id   VARCHAR(40)   NOT NULL,
  quantity     DECIMAL(14,3) NOT NULL DEFAULT 1,
  KEY idx_pc_combo (combo_id),
  KEY idx_pc_product (product_id),
  CONSTRAINT fk_pc_combo FOREIGN KEY (combo_id)
    REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pc_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- STORE_STOCK (tồn kho theo từng cửa hàng/chi nhánh)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_stock (
  product_id VARCHAR(40)   NOT NULL,
  store_id   VARCHAR(40)   NOT NULL,
  stock      DECIMAL(14,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, store_id),
  KEY idx_ss_store (store_id)
) ENGINE=InnoDB;

-- ============================================================
-- STOCK_TRANSFERS (phiếu chuyển kho giữa các chi nhánh)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfers (
  id             VARCHAR(40)   NOT NULL PRIMARY KEY,
  from_store_id  VARCHAR(40)   NULL,
  to_store_id    VARCHAR(40)   NULL,
  note           TEXT          NULL,
  created_by     VARCHAR(40)   NULL,
  created_at     DATETIME      NOT NULL,
  KEY idx_st_from (from_store_id),
  KEY idx_st_to (to_store_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_transfer_details (
  id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transfer_id  VARCHAR(40)   NOT NULL,
  product_id   VARCHAR(40)   NOT NULL,
  quantity     DECIMAL(14,3) NOT NULL DEFAULT 0,
  KEY idx_std_transfer (transfer_id),
  CONSTRAINT fk_std_transfer FOREIGN KEY (transfer_id)
    REFERENCES stock_transfers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCT_PRICE_HISTORY (lịch sử thay đổi giá)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_price_history (
  id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id   VARCHAR(40)   NOT NULL,
  field        VARCHAR(50)   NOT NULL,                      -- import_price | retail_price | wholesale_price
  old_value    DECIMAL(14,2) NULL,
  new_value    DECIMAL(14,2) NULL,
  changed_by   VARCHAR(40)   NULL,
  created_at   DATETIME      NOT NULL,
  KEY idx_pph_product (product_id),
  CONSTRAINT fk_pph_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- CATEGORIES (danh mục sản phẩm — dùng nhóm sản phẩm trên menu/trang SP)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id         VARCHAR(40)   NOT NULL PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  color      VARCHAR(20)   NULL,
  sort_order INT           NOT NULL DEFAULT 0,
  created_at DATETIME      NULL,
  KEY idx_categories_name (name)
) ENGINE=InnoDB;