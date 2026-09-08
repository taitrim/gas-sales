import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

export async function uploadImage(payload) {
  const { base64, mimeType, fileName } = payload;
  if (!base64) throw new ApiError(400, 'Thiếu dữ liệu ảnh (base64).', 'BAD_REQUEST');

  const extMap = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
  };
  const ext = extMap[mimeType] || 'png';
  const name = (fileName || `img-${Date.now()}.${ext}`)
    .replace(/[^\w.\-]+/g, '_')
    .toLowerCase();

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const finalPath = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(finalPath, Buffer.from(base64, 'base64'));
  return `/uploads/${name}`;
}