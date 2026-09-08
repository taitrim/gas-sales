# GAS Sales Pro

> Sales management software for gas, beverage and grocery stores: point of sale (POS),
> orders, purchase (imports), automatic inventory, supplier reconciliation, finance,
> debts, promotions and multi-branch — running on your own server.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933)](https://nodejs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8%2B-4479A1)](https://www.mysql.com)
[![Version](https://img.shields.io/badge/version-2.6.0-blue)](backend/package.json)

- **Backend**: Node.js + Express + MySQL (ported from Google Apps Script, business logic 2.6 preserved)
- **Frontend**: React + TypeScript + Vite (proxy `/api` → backend)
- **Your data stays yours**: self-hosted, exportable, one-command backups.

**Language:** 🇻🇳 [Tiếng Việt](README.md) · 🇬🇧 English

## Features

- 🛒 **Selling**: POS + order creation, invoice printing, returns/refunds
- 📦 **Products**: variants, combos, wholesale/retail pricing, **automatic stock** (add/sync)
- 🚚 **Purchases (imports)**: supplier import slips, supplier debt reconciliation
- 👥 **Customers**: loyalty points, point redemption, debts
- 💰 **Finance**: daily reports, revenue by staff/category, period comparison
- 🏷️ **Promotions**: discount campaigns, stock taking, branch transfers → stores
- 🔐 **Permissions**: screen-level roles for staff, activity log
- 💾 **Backup**: one-click backup/restore + daily scheduler (Windows Task Scheduler / cron)
- 📤 **Google Sheets import**: keeps original IDs, upsert, dry-run (no coding needed)
- 🧠 **Menu recognition from photos** (Gemini)

## Quick start (dev machine)

```bash
# Backend (:4000)
cd backend
npm install
copy .env.example .env        # set DB_PASSWORD, JWT_SECRET, ...
npm run db:setup && npm run db:seed
npm run dev

# Frontend (:5173) — open a second terminal
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, log in with `admin / admin123`, and change the password right away.

## Contributing & Security

See [`CONTRIBUTING.md`](CONTRIBUTING.md) (code conventions, how to open a PR) and
[`SECURITY.md`](SECURITY.md) (vulnerability reporting). Licensed under **MIT**.

## Project structure

```
CHINCHINSHOP/
├── backend/
│   ├── db/
│   │   ├── schema.sql            # MySQL schema (11 tables, ported from original DB_SCHEMA)
│   │   ├── setup.js              # npm run db:setup
│   │   └── seed.js               # npm run db:seed  (creates default admin + store)
│   ├── scripts/
│   │   └── import-from-sheets.mjs  # npm run import:sheets — import from Google Sheets
│   ├── public/uploads/           # Uploaded product images
│   └── src/
│       ├── server.js             # Entry point (port 4000)
│       ├── app.js                # Express app + action dispatcher
│       ├── auth.js               # JWT + bcrypt
│       ├── inventory.js          # Stock logic (shared by orders & imports)
│       ├── mappers.js            # DB columns → API shape (AppScript-compatible)
│       └── actions/              # Business-logic actions
└── frontend/                     # Vite + React + TypeScript
    └── src/pages/                # Login, Dashboard, Orders, Products, Imports,
                                  #   Suppliers, Customers, Finance, Stores, Users, Settings...
```

## Requirements

- Node.js ≥ 18 (20+ recommended)
- MySQL 8+ (tested on MySQL 9.6 as well)

## 1. Backend setup

```bash
cd backend
npm install
copy .env.example .env     # set DB_PASSWORD, JWT_SECRET, ...
npm run db:setup           # creates database gas_sales + tables
npm run db:seed            # creates default admin (admin / admin123) + default store
npm run dev                # runs at http://localhost:4000
```

Health check: `http://localhost:4000/api/health`

> ⚠️ Change the `admin123` password right after your first login (Users → Reset password).

## 2. Importing data from Google Sheets

### Method A — via the web UI (recommended, no commands)

Log in as **admin** → menu **"Import dữ liệu"** (📤) → 3 steps:

1. **Connection config**: enter the Spreadsheet ID + choose the connection method → **Save**.
   - **Public sheet** *(recommended if you own the sheet — nothing to create in Google Cloud)*:
     in Google Sheets click **Share** → switch to **"Anyone with the link"** → role **"Viewer"**.
   - **API Key** (public sheet): create an API key in Google Cloud Console.
   - **Service Account**: create a service account + share the sheet with its email.
2. **Check data**: click **"Kiểm tra dữ liệu"** to compare **rows on the sheet vs rows in the DB**
   per table, plus orphan-check (order without customer, details without parent order...).
   A table shown as **"Chưa đồng bộ"** is not imported yet or out of sync.
3. **Run import**: select the tables to import, optionally enable **Dry-run** to preview (no DB writes),
   then click **Import**. Data is **upserted** (original IDs kept, running again never duplicates).

> "Public sheet" mode downloads the workbook (XLSX) from Google directly, so **no**
> API key / service account / Google Cloud Console is needed.

### Method B — via CLI

The script reads tabs named after the AppScript tables (`Users`, `StoreInfo`, `Suppliers`,
`Customers`, `Products`, `Imports`, `ImportDetails`, `Orders`, `OrderDetails`,
`SupplierTransactions`, `Stores`), **keeps original IDs**, hashes passwords with bcrypt, and uses
`INSERT ... ON DUPLICATE KEY UPDATE`, so re-runs never duplicate data.

#### Step 1: Sheet access

**Option A — Service Account (recommended):**
1. Go to https://console.cloud.google.com → create a project → APIs & Services → Library → enable **Google Sheets API**.
2. Credentials → Create Credentials → **Service Account** → create a JSON key and download it.
3. Open the original Google Sheet → **Share** → add the service account email (role **Viewer**).

**Option B — Public sheet + API key:**
1. Share the sheet with "Anyone with the link" (view).
2. Get an API key from Google Cloud Console.

#### Step 2: Configure & run

Edit `backend/.env`:

```
GOOGLE_CREDENTIALS_JSON=C:\path\to\service-account.json   # or GOOGLE_API_KEY=...
GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvXyZ...
```

Dry run (no DB writes):

```bash
cd backend
npm run import:sheets -- --sheetId=<SPREADSHEET_ID> --dry-run
```

Run for real:

```bash
npm run import:sheets -- --sheetId=<SPREADSHEET_ID>
```

Import only some tables: `npm run import:sheets -- --sheetId=<id> --only Products,Orders,OrderDetails`

Public sheet without a key: `npm run import:sheets -- --sheetId=<id> --mode public --check`

Completeness check via CLI: `npm run import:sheets -- --sheetId=<id> --check`

> Old passwords (plaintext in the sheet) are bcrypt-hashed on import; accounts keep logging in as before.
> If a row has no `CreatedAt`, the script uses the current time.

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev                # runs at http://localhost:5173 (proxy /api → :4000)
```

Build for production (backend serves `frontend/dist` automatically):

```bash
npm run build
```

After building, running only the backend gives you the full web app at `http://localhost:4000`.

## API (AppScript action structure preserved)

`POST /api` — body: `{ "action": "...", ...payload }` — response: `{ success, data, error }`

| Group | Actions |
|---|---|
| System | `checkSystemStatus`, `loginUser`, `registerUser` |
| Users | `getUsers`, `approveUser`, `updateUser`, `deleteUser`, `resetPassword` |
| Products | `getProducts`, `addProduct`, `updateProduct`, `deleteProduct` |
| Suppliers | `getSuppliers`, `addSupplier`, `updateSupplier`, `deleteSupplier`, `getSupplierTransactions`, `createSupplierPayment` |
| Customers | `getCustomers`, `addCustomer`, `updateCustomer`, `deleteCustomer` |
| Orders | `getOrders`, `createOrder`, `updateOrder`, `updateOrderStatus`, `deleteOrder` |
| Imports | `getImports`, `createImport`, `updateImport`, `deleteImport` |
| Stores | `getStores`, `addStore`, `updateStore`, `deleteStore`, `getStoreInfo`, `saveStoreInfo` |
| Finance | `getFinancialReport` |
| Upload | `uploadImage` (base64 → `/uploads/...`) |

Except for `checkSystemStatus`, `loginUser`, `registerUser`, all actions require the header
`Authorization: Bearer <token>` (token from `loginUser`).

## Business logic notes (kept from AppScript)

- **Inventory**: a `completed` order (not drop-ship) **decreases** stock; moving the status away
  from `completed` **restores** it. Deleting a completed order restores stock.
- **Imports**: creating an import slip **increases** stock; editing/deleting updates stock accordingly.
- **Supplier reconciliation**: unpaid balance = `totalAmount − paidAmount`; supplier profit is
  calculated from completed drop-ship orders.
- **Finance**: reports are day-based and only count `completed` orders.

## Deploy (production)

Full instructions for real servers: security + automatic backup. Template config files live in `deploy/`.

> **Deploying on Windows + Cloudflare Tunnel (custom domain)?** → see the dedicated runbook:
> [`deploy/windows-tunnel/README.md`](deploy/windows-tunnel/README.md) — the scripts
> `configure-env.ps1`, `setup-db.ps1`, `setup-backend-service.ps1`, `setup-tunnel.ps1`,
> `check-prod.ps1` do almost everything for you.

### Step 0 — Prep

- Node.js ≥ 20, MySQL 8+ and (recommended) a domain pointing to your server.
- Build the frontend so the backend can serve the static files:
  ```bash
  cd frontend && npm run build
  ```

### Step 1 — Backend `.env` (security)

Edit `backend/.env`:

```ini
NODE_ENV=production
# JWT_SECRET MUST be a random string ≥64 chars. Generate with:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<random-string>
# Use a dedicated DB user (NOT root). Run deploy/mysql-user.sql once:
DB_USER=gas
DB_PASSWORD=<strong-password>
```

> ⚠️ `backend/.env` is already in `.gitignore` — never commit it.

### Step 2 — Dedicated MySQL user + firewall

1. Create a non-root `gas` user:
   ```bash
   mysql -u root -p < deploy/mysql-user.sql
   ```
2. **Do NOT expose port 4000 to the internet.** Keep MySQL bound to `127.0.0.1` and let nginx (443) be the only entry.

### Step 3 — HTTPS + reverse proxy (nginx)

The backend listens on `0.0.0.0:4000` by default; use nginx as the 443 gateway:

```bash
sudo cp deploy/nginx-gas-sales.conf.example /etc/nginx/conf.d/gas-sales.conf
# edit server_name to your real domain, then:
sudo certbot --nginx -d shop.example.com   # Let's Encrypt auto-HTTPS
sudo nginx -t && sudo systemctl reload nginx
```

Once HTTPS is up, set `CORS_ORIGIN` in `.env` to your real domain:

```ini
CORS_ORIGIN=https://shop.example.com
```

### Step 4 — Process manager (auto-start + auto-restart)

**Option A — systemd (Linux):**

```bash
sudo cp deploy/gas-sales.service.example /etc/systemd/system/gas-sales.service
# fix WorkingDirectory/ExecStart paths
sudo systemctl daemon-reload && sudo systemctl enable --now gas-sales
```

**Option B — PM2:**

```bash
npm i -g pm2
cp deploy/ecosystem.config.cjs.example /srv/gas-sales-backend/ecosystem.config.cjs
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

### Step 5 — Automatic backup

**Windows (Task Scheduler):** run once as admin:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\setup-backup-task.ps1
```

**Linux (cron):**

```bash
# daily 02:00, keep 14 days
crontab -e
#  0 2 * * *  cd /srv/gas-sales-backend && node scripts/auto-backup.mjs
```

Backups are stored in `backend/backups/*.sql`. **Copy backups off the server** (e.g. cloud/storage)
to protect against disk failure.

### Health check

```bash
curl https://shop.example.com/api/health   # {"status":"ok","db":"connected"}
```

## Changelog

### 2.6.6 (08/2026) — Customer source & customer page in order-card style

- **Customers page now 100% matches the Orders design language**: two-line `.orders-toolbar`
  toolbar, customer cards using the `order-card`/`oc-*` system (initial-letter avatar with per-name
  hashed color, name + phone, red debt badge, icon-based meta row, `oc-addr` address bar, footer
  actions), 2-column desktop grid, page-size select (10/20/50/100, default 12).
- **Customer source field**: Facebook, TikTok, Zalo, Instagram, YouTube, Shopee, Website,
  Referral, Offline, Other. Select dropdown with per-channel icons in add/edit form (default
  "Unclassified"); CSV export adds a Source column; `listCustomers` supports `source` filtering;
  backend adds `customers.source` via a light migration at startup.
- **Order-form style synced across all forms**: Customers, Import slips, Suppliers, Promotions,
  Products, Stock adjustments, Transfers, Cash, Expenses, Debt payments, Users, Stores, Settings
  and the Google Sheets import config — all using `.form-section` icons, toned `FieldLabel`s,
  portal `Select` dropdowns, and click-to-select number inputs.
- **Fixed Vietnamese font**: **Be Vietnam Pro** was used in CSS but never loaded → fell back to
  a wrong font on POS cards. Google Fonts (weights 400–800, `display=swap`) added to `index.html`.
- **All pages' toolbars** now use the standard `.orders-toolbar` (Products, Imports, Suppliers,
  Expenses, Users, Audit, Transfers); lists converted to `order-card` cards (Suppliers, Customer
  debts, Import slips, Promotions, Stores).
- **Fix POS "Out of stock"**: the `::before` pseudo-element `content` had a corrupt byte (`\xa0`)
  → Vietnamese diacritics rendered wrong. Moved to real text in JSX, dropped `text-transform`.
- **Cancel paid order → refund cash fund + deduct customer debt**: previously `updateOrderStatus`
  only removed the debt ledger without logging the cash refund. Now a `spend` cash log is written
  when cancelling/deleting a paid cash order → fund & debts always stay in sync.

### 2.6.5 (08/2026) — POS card & customer card redesign

**POS product card (new design)**
- Rounded image inset inside the card (4:3, padded) instead of full-bleed; subtle zoom on hover.
- Top color bar removed → category is now a colored-dot + uppercase-text line at the top of the body.
- Big price left + "From X" milestone-price badge (soft red) right.
- Stock as a colored pill (green ok / yellow low / red out); "+ Add" hint on hover (desktop).
- Out-of-stock: dimmed overlay + **OUT OF STOCK** pill border on the image.
- In-cart: gradient "3×" pill on image corner + category-color tint/border.
- Mobile ≤980px/≤640px: compact 3-column grid, tier/hint hidden to maximize space.

**Customers page — table → card grid**
- Each customer is a card: initial-letter avatar (hashed name color), name + phone, one-line
  address, red debt badge when balance owed.
- Stats row with 3 cells: **Spent | Points | Last purchase**; Points cell (blue when points exist)
  opens the points ledger directly.
- Footer actions: History · Edit · Delete; cards with debt get a soft red border.
- Pagination synced with Orders: page-size select (10/20/50/100, default **12**) + x–y/total info;
  one column on mobile.

### 2.6.4 (08/2026) — Points configuration & customer points ledger

**Settings → Points (new)**
- New **⭐ Points** card in Settings with 2 parameters:
  - **Points earned / per 1,000₫** (`pointsRate`, default 1) — buying 50,000₫ earns 50 points.
  - **Value per point** (`pointValue`, default 1,000₫) — 10 points discount 10,000₫.
- Saved with store info (`store_info`), applied to new orders immediately.

**Applied to orders**
- Backend computes **earned points** on payment from `pointsRate` (already present) and the
  **points redemption value** via `pointValue` (new — previously hardcoded to 1,000₫) in every
  flow: create/edit order, POS.
- POS + order form read the config: "1 point = X₫" hint, points usage limit, discount line.

**Customer points ledger**
- New table `customer_points_ledger` (auto-created at server startup — no manual migration):
  customer_id, type (earn/redeem/refund/adjust), ref_type/ref_id, points, note, created_by, created_at.
- Every point change is **logged automatically**: earn on `paid`, deduct on redemption, refund/
  recall when the order is edited, cancelled or deleted, or payment status changes.
- New action `getCustomerPointsLedger` + **Customers** page: **Points** column (click to open the
  ledger) and a **History** button — the ledger modal shows the current balance + a change table
  (time, typed badge, order reference, note, ±points).

### 2.6.3 (08/2026) — Order form & order list redesign

**Order create/edit form design**
- Form split into **sections with icon + title**: 🛍️ Products, 👤 Customer, 🧾 Order,
  💳 Payment & status, 💰 Costs, 📝 Notes.
- **Input labels** are tone-colored by group (blue/red/yellow/purple/green), no icons — icons only
  on section titles.
- **Products section on top** (easy on mobile); product picker via the custom `ProductSearch`
  dropdown (name + price + stock, in-cart items show a ✓ badge and are locked).
- Every dropdown uses the shared `Select` component (trigger + `.dropdown` panel, selected value
  **tone-colored**, auto-close on select using `onMouseDown` for reliable mobile behavior).
- **Correct dropdown direction**: if there is not enough space below, panels **flip upward**
  (applied to `Select`, `DatePicker`, `CustomerSearch`, `ProductSearch`).
- Outside-click closes dropdowns at **capture phase** on `document` (not blocked by modal
  `stopPropagation`).
- **Delivery date**: custom `DatePicker` calendar styled like the dropdowns (month ‹ ›,
  Mon–Sun, today outline, selected gradient). Only shown when **Preorder** is ticked and required.
- **Preorder toggle**: custom checkbox (gradient tick + shadow).
- **Customer**: after selection, collapsed into a chip (avatar + name + phone + ✏️), click to change;
  duplicated name/phone/address fields removed. Cost fields select-all on focus for quick typing.
- **Desktop ≥1100px**: modal up to **1180px**, form in a **2-column section grid** (left: tall
  Products + Notes; right: Customer, Order, Payment, Costs), each group a **card** with border/
  shadow, product list scrolls internally.
- **Mobile**: one column, each group keeps 2-col filters/row.

**Order list: search, filters & pagination**
- Two-row toolbar: top = **search** + order count + ⬇ CSV button; bottom = **filter set**
  (status, payment, order type, preorder) as compact dropdowns + **✕ Clear filters** button.
- **Mobile**: no horizontal scroll — full-width search, filters in a **2-column grid**, 46px touch
  targets.
- **Pagination**: page-size option (10/20/50/100, default **10**) next to "x–y / total".

**Order return form**
- Redesigned in the order-form language: icon sections (📦 Products to return, 💰 Refund & reason),
  tone-colored `FieldLabel`s, **Reason** via toned `Select` instead of native `<select>`,
  select-all-on-focus refund amount, full-width note, **single-column** layout on desktop
  (modal 760px, class `.form-stack-single`).

**POS page**
- The cart is now a standalone flex block (`.pos-cart-inner`): many items **scroll inside their own
  area** (min ~140px), while **payment (customer, discount, VAT, totals, pay button) stays fixed** —
  both desktop (right cart frame) and mobile (bottom sheet).
- POS payment form now follows the order-form language: **icon sections** (👤 Customer,
  💳 Payment), `FieldLabel` toned labels, payment method via **toned `Select`**
  (💵 Cash / 🏦 Transfer / 💳 Card / 🚚 COD), gradient `.preorder-toggle` checkbox, select-all
  number inputs. `FieldLabel` extracted into `components/ui/FieldLabel.tsx`.

### 2.6.2 (08/2026) — Product management & POS

**Products (redesigned)**
- Category filter as chips (`.cat-filter`, `.chip`); category management via modal
  (add/edit/delete, per-category color, product counts).
- Compact product card (`.product-card`): image + name + colored category badge + price + stock +
  **Low-stock** badge when stock ≤ 5.
- Product detail popup (`.od-head`, `.od-costs` — 3 colored blocks: cost / retail price / profit)
  with 3 tabs **Variants / Combos / Price history**.
- Inline product image upload (auto-resized to ≤1024px, `uploadImage` → `/uploads/...`).
- **Create products from a menu photo**: pick image → preview → AI vision recognition
  (Google Gemini, provider `backend/src/providers/gemini.js`) → review/edit name/price/unit →
  bulk-create.
- Backend: new `categories` table; actions `listCategories` / `addCategory` / `updateCategory` /
  `deleteCategory` / `recognizeMenuItems` (permission `products`); `listProducts` filters by `category`.
- Config: add `GEMINI_API_KEY` and `GEMINI_MODEL` to `backend/.env` (default `gemini-1.5-flash`).

**POS**
- Product cards redesigned: square image + name + price + stock status color by remaining qty:
  - **Out of stock** (qty = 0): dimmed, gray, locked.
  - **Low stock** (qty ≤ 10): yellow warning text.
  - **In stock**: green text.
- Added to cart: accent border + quantity badge on the image (`.pos-in-cart`).
- Hover lifts the card with a slight image zoom; compact 3-column grid on mobile, category tag hidden.

### 2.6.1 (08/2026) — UI, invoice & logo

**Dashboard & navigation**
- Dashboard tidier on mobile (`.mini-grid`, `.mini-card`, `.mini-rows`, `.mini-row`), details only
  from ≥641px (`.dash-detailed`).
- Clicking a status card / recent order row / low-stock product jumps to the matching page with the
  filter pre-applied:
  - `GET /orders` supports comma-separated `status` (e.g. `status=processing,waiting_payment`).
  - `GET /products` supports `stock=low` (qty 1–5) and `stock=out` (out of stock).
- Recent orders on the Dashboard open the detail modal directly (no page switch); status changes
  in the modal update the list instantly.

**Order detail modal (shared)**
- Extracted as the shared `frontend/src/components/OrderDetailModal.tsx`, used by both the Orders
  page and the Dashboard.
- Product table shows only Product / Qty / Unit price / Line total (per-line profit removed);
  profit only in the totals cluster (💰 Revenue green, 📊 Order profit purple).
- Customer + order info side-by-side (2 columns kept on mobile); product table rows on mobile with
  horizontal scroll when too wide.
- Action buttons (status change, 🗑 delete, 🖨️ print, ✏️ edit) grouped into the modal title bar via
  the `headActions` prop of `Modal.tsx`.

**Invoice printing & capture**
- `PrintInvoice.tsx` adds an A4 / 58mm size selector and a **📸 Capture** button
  (uses `html-to-image`), preview then **⬇ Save image** or **📤 Share** (`navigator.share`,
  download fallback; HTTPS required on iOS).

**Store logo**
- **Settings** page: upload a logo (auto-resized to ≤512px → PNG), preview, change/remove.
- The logo shows **watermark on invoices** (`.print-watermark`), as the **browser tab icon**, and as
  the **top-left brand** in the app (sidebar + topbar + drawer).
- Backend adds `GET /logo` (returns the stored logo from `store_info` key `logo`; falls back to
  `frontend/dist/icons/app-icon.svg`).
- `index.html` (favicon, apple-touch-icon) and `manifest.webmanifest` point icons to `/logo`.
- Service worker never caches `/logo`.

**Fixes & infra**
- Fixed **"Data too long for column 'v'"** when saving the logo: `store_info.v` upgraded from
  `TEXT` to `LONGTEXT` (both `db/schema.sql` and the running DB).
- `saveStoreInfo` now **upserts per key** (`ON DUPLICATE KEY UPDATE`) — no more delete-and-reinsert,
  preserving other configs (points, import...).
- `vite.config.ts` adds the `/logo` proxy for the dev server.