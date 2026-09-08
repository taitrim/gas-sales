import { recognizeMenu } from '../providers/gemini.js';
import { ApiError } from '../utils.js';

// Nhận diện thực đơn từ ảnh → danh sách { name, price, unit } để người dùng duyệt
export async function recognizeMenuItems(payload) {
  const { base64, mimeType } = payload;
  if (!base64) throw new ApiError(400, 'Thiếu dữ liệu ảnh (base64).', 'BAD_REQUEST');
  // Giới hạn kích thước tránh gửi file quá nặng
  if (base64.length > 15 * 1024 * 1024) {
    throw new ApiError(400, 'Ảnh quá lớn (tối đa ~15MB).', 'BAD_REQUEST');
  }
  return recognizeMenu(base64, mimeType || 'image/png');
}