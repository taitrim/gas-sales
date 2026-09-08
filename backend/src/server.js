import { createApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './migrations.js';
import { closePool } from './db.js';

// Tạo bảng/cột mới nếu DB cũ chưa có (an toàn khi chạy lại).
// Trong production, migration lỗi phải dừng app để không chạy với schema sai.
try {
  await runMigrations();
} catch (err) {
  console.error('✘ Migration lỗi:', err.message);
  if (process.env.NODE_ENV === 'production') {
    console.error('✘ Dừng app vì migration thất bại trong production.');
    process.exit(1);
  }
}

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`✔ GAS Sales backend đang chạy tại http://localhost:${config.port}`);
  console.log(`  Health check: http://localhost:${config.port}/api/health`);
});

// Graceful shutdown: đóng server + pool DB sạch sẽ
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n✋ Nhận ${signal}, đang tắt server...`);
  server.close(async () => {
    await closePool();
    console.log('✔ Đã đóng server và kết nối DB.');
    process.exit(0);
  });
  // Nếu không tắt được trong 10s, ép thoát
  setTimeout(() => {
    console.error('✘ Force shutdown sau 10s.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});