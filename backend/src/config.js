import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_JWT_SECRET = 'dev-secret-change-me';

function assertSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === DEFAULT_JWT_SECRET) {
    if (isProd) {
      throw new Error(
        'JWT_SECRET phải được đặt giá trị ngẫu nhiên an toàn trong production. ' +
          'Tạo bằng: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }
    console.warn('⚠ Cảnh báo: JWT_SECRET đang dùng giá trị mặc định (chỉ dùng cho dev).');
  }
}

assertSecret();

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_sales',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10
  },
  corsOrigin: process.env.CORS_ORIGIN || '*'
};