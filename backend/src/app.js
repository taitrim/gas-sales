import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { verifyToken, authRequired, adminRequired } from './auth.js';
import { registry, PUBLIC_ACTIONS, ADMIN_ACTIONS } from './actions/index.js';
import { ApiError, toSqlDateTime } from './utils.js';
import { query } from './db.js';
import { hasPermission, ACTION_PERMISSION } from './permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Các action chỉ đọc / đăng nhập: không ghi nhật ký để tránh nhiễu
const NO_LOG_ACTIONS = new Set([
  'checkSystemStatus', 'loginUser', 'registerUser', 'getUsers', 'getProducts', 'getSuppliers',
  'getCustomers', 'getOrders', 'getImports', 'getCashFund', 'getFinancialReport', 'getSalesStats',
  'getCustomerPointsLedger',
  'getAlerts', 'getSalesByStaff', 'getSalesByCategory', 'getProfitReport', 'getPeriodComparison',
  'getDashboard', 'getPromotions', 'getStockAdjustments', 'getCustomerDebts', 'getReturns',
  'getAuditLogs', 'getImportConfig', 'checkImportData', 'getStores', 'getStoreInfo',
  'getSupplierTransactions', 'listProducts', 'listCustomers', 'listSuppliers', 'listUsers',
  'listOrders', 'listImports', 'listExpenses', 'getHealth', 'listBackups', 'getBackupConfig',
  'getInventoryReport', 'getStockTransfers', 'getProductVariants', 'getProductCombos',
  'getProductPriceHistory', 'getPermissionsList', 'getUserPermissions', 'getDebtOverview',
  'listCategories', 'recognizeMenuItems'
]);

async function writeAuditLog(req, action, content) {
  try {
    const sanitized = { ...content };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.action;
    await query(
      `INSERT INTO audit_logs (user_id, username, action, detail, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        req.user?.username || null,
        action,
        JSON.stringify(sanitized).slice(0, 2000),
        req.ip || null,
        toSqlDateTime(new Date())
      ]
    );
  } catch {
    // Nhật ký không được làm hỏng request chính
  }
}

export function createApp() {
  const app = express();
  // Tin tưởng nginx/caddy reverse proxy (local) để lấy X-Forwarded-Proto chính xác
  // (quan trọng cho việc phát hiện HTTPS / cookie secure về sau). Chỉ tin loopback.
  app.set('trust proxy', 'loopback');

  // CORS: warning nếu dùng wildcard trong production
  if (config.corsOrigin === '*' && process.env.NODE_ENV === 'production') {
    console.warn('⚠ CẢNH BÁO: CORS_ORIGIN=* đang mở API cho mọi origin. Nên set domain cụ thể trong production.');
  }
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()), maxAge: 86400 }));
  // Giới hạn body 25mb→10mb: ảnh menu/tải ảnh gửi base64 (~3-5MB/ảnh camera) vẫn hoạt động,
  // nhưng chặn request quá khổ lạm dụng.
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

  // Rate limiting — bảo vệ auth + API trước brute-force/abuse (mức mặc định cho mọi request)
  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, data: null, error: 'Quá nhiều request. Thử lại sau 1 phút.' }
  });
  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, data: null, error: 'Quá nhiều lần thử. Vui lòng chờ 1 phút.' }
  });

  app.use('/api', (req, res, next) => {
    // Nhận diện login/register để dùng mức chặt hơn
    const bodyAction = req.body?.action;
    if (bodyAction === 'loginUser' || bodyAction === 'registerUser') return authLimiter(req, res, next);
    return globalLimiter(req, res, next);
  });

  app.get('/api/health', async (req, res) => {
    try {
      await query('SELECT 1');
      res.json({ success: true, data: { status: 'ok', db: 'connected', service: 'gas-sales-backend', version: '2.6' } });
    } catch {
      res.status(503).json({ success: false, data: null, error: 'Database không khả dụng.' });
    }
  });

  app.get('/api', (req, res) => {
    res.json({ success: false, data: null, error: 'API chỉ nhận POST với body { action, ...payload }.' });
  });

  // Logo cửa hàng — dùng làm favicon + icon app (fallback về icon mặc định)
  app.get('/logo', async (req, res) => {
    try {
      const rows = await query("SELECT v FROM store_info WHERE k = 'logo'");
      const logo = rows[0]?.v || '';
      if (logo && logo.startsWith('data:')) {
        const comma = logo.indexOf(',');
        const meta = logo.slice(5, comma);
        const mime = (meta.split(';')[0] || 'image/png').trim();
        const isSvg = mime.includes('svg');
        const buf = isSvg
          ? Buffer.from(decodeURIComponent(logo.slice(comma + 1)), 'utf8')
          : Buffer.from(logo.slice(comma + 1), 'base64');
        res.set('Content-Type', mime);
        res.set('Cache-Control', 'no-cache');
        return res.send(buf);
      }
      const defaultIcon = path.join(__dirname, '..', '..', 'frontend', 'dist', 'icons', 'app-icon.svg');
      if (fs.existsSync(defaultIcon)) {
        return res.sendFile(defaultIcon);
      }
      res.status(404).json({ success: false, data: null, error: 'Chưa có logo.' });
    } catch {
      res.status(404).json({ success: false, data: null, error: 'Chưa có logo.' });
    }
  });

  // Manifest PWA động — icon cài đặt dùng logo cửa hàng nếu đã upload
  app.get('/manifest.webmanifest', async (req, res) => {
    try {
      const rows = await query("SELECT k, v FROM store_info WHERE k IN ('logo', 'store_name')");
      const logo = rows?.find((r) => r.k === 'logo')?.v || '';
      const name = rows?.find((r) => r.k === 'store_name')?.v || 'GAS Sales Pro';

      let icons;
      if (logo && logo.startsWith('data:')) {
        const meta = logo.slice(5, logo.indexOf(','));
        const mime = (meta.split(';')[0] || 'image/png').trim();
        const type = mime.includes('svg') ? 'image/svg+xml' : 'image/png';
        icons = [
          { src: '/logo', sizes: '192x192', type, purpose: 'any' },
          { src: '/logo', sizes: '512x512', type, purpose: 'any' },
          { src: '/logo', sizes: '512x512', type, purpose: 'maskable' }
        ];
      } else {
        icons = [
          { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/app-icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ];
      }

      res.set('Content-Type', 'application/manifest+json');
      res.json({
        name,
        short_name: name,
        description: 'Phần mềm quản lý bán hàng — đơn hàng, sản phẩm, nhập hàng, tài chính',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f6fb',
        theme_color: '#6366f1',
        icons
      });
    } catch {
      res.set('Content-Type', 'application/manifest+json');
      res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'public', 'manifest.webmanifest'));
    }
  });

  // Endpoint chính - giữ nguyên cấu trúc action của Google Apps Script:
  // POST /api  body: { action: "...", ...payload }
  app.post('/api', async (req, res) => {
    try {
      const content = req.body || {};
      const action = content.action;

      if (!action || !registry[action]) {
        throw new ApiError(404, `Action "${action || ''}" không tồn tại.`, 'UNKNOWN_ACTION');
      }

      if (!PUBLIC_ACTIONS.includes(action)) {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) throw new ApiError(401, 'Chưa đăng nhập.', 'UNAUTHORIZED');
        req.user = verifyToken(token);
      }

      if (ADMIN_ACTIONS.includes(action) && req.user?.role !== 'admin') {
        throw new ApiError(403, 'Chỉ quản trị viên mới được thực hiện thao tác này.', 'FORBIDDEN');
      }

      // Phân quyền chi tiết: nhân viên cần quyền màn hình tương ứng để gọi action
      // Dùng permissions đã cache trong JWT (đã có từ signToken) — không cần query DB mỗi request
      if (req.user?.role !== 'admin') {
        const requiredPerm = ACTION_PERMISSION[action];
        if (requiredPerm && !hasPermission(req.user, requiredPerm)) {
          throw new ApiError(403, 'Bạn không có quyền thực hiện thao tác này.', 'PERMISSION_DENIED');
        }
      }

      const payload = { ...content };
      delete payload.action;
      if (req.user) payload.user = req.user;

      const data = await registry[action](payload);
      if (!NO_LOG_ACTIONS.has(action)) {
        await writeAuditLog(req, action, content);
      }
      res.json({ success: true, data });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      if (status === 500) console.error(`[action:${req.body?.action}]`, err);
      res.status(status).json({
        success: false,
        data: null,
        error: err.message || 'Lỗi hệ thống'
      });
    }
  });

  // Tải file backup (yêu cầu admin)
  app.get('/api/backup/download/:fileName', authRequired, adminRequired, (req, res) => {
    const fileName = req.params.fileName || '';
    if (!fileName.endsWith('.sql') || fileName.includes('..')) {
      return res.status(400).json({ success: false, data: null, error: 'Tên file không hợp lệ.' });
    }
    const backupDir = path.join(__dirname, '..', 'backups');
    const filePath = path.join(backupDir, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, data: null, error: 'Không tìm thấy file.' });
    }
    res.download(filePath, fileName);
  });

  // Serve frontend build nếu có (deploy chung 1 server)
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api|\/uploads).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
  }

  // Error-handling middleware (bắt lỗi từ authRequired/adminRequired và các route khác)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err instanceof ApiError ? err.status : 500;
    if (status === 500) console.error('[route]', err);
    res.status(status).json({
      success: false,
      data: null,
      error: err.message || 'Lỗi hệ thống'
    });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, data: null, error: 'Không tìm thấy route.' });
  });

  return app;
}