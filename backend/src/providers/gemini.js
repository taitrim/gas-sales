import { ApiError } from '../utils.js';

// Provider Gemini Vision — nhận diện thực đơn từ ảnh (OCR + hiểu ngữ cảnh)
// Nguyên tắc: chỉ expose một hàm duy nhất `recognizeMenu`, mọi lỗi từ provider
// đều được map về ApiError trước khi lan ra business logic (ACL).

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function apiKey() {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    throw new ApiError(400, 'Chưa cấu hình GEMINI_API_KEY trong backend/.env.', 'GEMINI_NOT_CONFIGURED');
  }
  return key;
}

function model() {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

function buildPrompt() {
  return [
    'Bạn là trợ lý nhận diện thực đơn nhà hàng. Hãy đọc kỹ ảnh thực đơn/menu được cung cấp.',
    'Trích xuất từng món ăn/đồ uống cùng giá tiền.',
    'Chỉ trả về JSON hợp lệ, không kèm bất kỳ giải thích hay markdown nào. Cấu trúc:',
    '{"items": [{"name": "tên món", "price": 45000, "unit": "đĩa"}]}',
    'Quy tắc:',
    '- name: tên món rõ ràng, bỏ số thứ tự, dấu chấm hay dấu phẩy đầu dòng.',
    '- price: số nguyên VNĐ, nếu không thấy giá thì để 0.',
    '- unit: đơn vị phổ biến (đĩa, tô, phần, ly, chai, lon...) hoặc bỏ trống.',
    '- Nếu ảnh không phải thực đơn hoặc không đọc được gì, trả {"items": []}.'
  ].join('\n');
}

async function callGemini(base64Image, mimeType) {
  const key = apiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let res;
  try {
    res = await fetch(`${API_BASE}/models/${model()}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildPrompt() },
              { inline_data: { mime_type: mimeType || 'image/png', data: base64Image } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096
        }
      })
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(504, 'Nhận diện quá lâu, xin thử lại.', 'GEMINI_TIMEOUT');
    }
    throw new ApiError(502, `Không kết nối được Gemini: ${err.message}`, 'GEMINI_NETWORK');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || '';
    } catch {
      detail = '';
    }
    if (res.status === 429) {
      throw new ApiError(429, 'Gemini đang giới hạn lượt gọi, chờ vài giây rồi thử lại.', 'GEMINI_RATE_LIMIT');
    }
    if (res.status >= 500) {
      throw new ApiError(502, `Lỗi máy chủ Gemini (${res.status}).`, 'GEMINI_SERVER');
    }
    throw new ApiError(400, `Gemini từ chối yêu cầu (${res.status}): ${detail}`, 'GEMINI_BAD_REQUEST');
  }

  const data = await res.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
  const blocked = data?.promptFeedback?.blockReason || '';
  if (blocked) {
    throw new ApiError(400, `Ảnh bị chặn (${blocked}). Vui lòng thử ảnh khác.`, 'GEMINI_BLOCKED');
  }
  if (!text) {
    throw new ApiError(422, 'Gemini không trả về nội dung, xin thử lại.', 'GEMINI_EMPTY');
  }
  return text;
}

function extractJson(text) {
  // Bỏ markdown code fence nếu có
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  // Lấy từ dấu { đầu tiên đến } cuối cùng
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new ApiError(422, 'Gemini trả về dữ liệu không phải JSON.', 'GEMINI_BAD_JSON');
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new ApiError(422, 'Gemini trả về JSON không hợp lệ.', 'GEMINI_BAD_JSON');
  }
}

// ACL: map response của Gemini về kiểu domain { items: [{name, price, unit}] }
export async function recognizeMenu(base64Image, mimeType) {
  const raw = await callGemini(base64Image, mimeType);
  const parsed = extractJson(raw);

  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return {
    items: items
      .map((it) => ({
        name: String(it?.name || '').trim(),
        price: Math.max(0, Math.round(Number(it?.price) || 0)),
        unit: it?.unit ? String(it.unit).trim() : ''
      }))
      .filter((it) => it.name)
  };
}