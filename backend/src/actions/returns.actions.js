import { pool, query } from '../db.js';
import { ApiError, genId, nowLocal, num } from '../utils.js';
import { adjustStock, orderNeedsStock } from '../inventory.js';
import { logCash } from '../ledger.js';
import { addDebtEntry, recomputeCustomerDebt } from './debt.actions.js';

export async function getReturns(payload) {
  const [rows, details] = await Promise.all([
    query('SELECT * FROM returns ORDER BY created_at DESC'),
    query('SELECT * FROM return_details')
  ]);
  const map = {};
  details.forEach((r) => {
    if (!map[r.return_id]) map[r.return_id] = [];
    map[r.return_id].push({
      productId: r.product_id,
      sku: r.sku,
      productName: r.product_name,
      quantity: Number(r.quantity),
      price: Number(r.price),
      subtotal: Number(r.subtotal),
      costPrice: Number(r.cost_price)
    });
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    subtotal: Number(r.subtotal),
    refundAmount: Number(r.refund_amount),
    reason: r.reason,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    storeId: r.store_id,
    items: map[r.id] || []
  }));
}

export async function createReturn(payload) {
  const d = payload.returnData || {};
  if (!d.orderId) throw new ApiError(400, 'Thiếu mã đơn hàng.', 'BAD_REQUEST');
  const items = (d.items || []).filter((it) => it.productId && num(it.quantity) > 0);
  if (items.length === 0) throw new ApiError(400, 'Phiếu trả hàng phải có ít nhất 1 sản phẩm.', 'BAD_REQUEST');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [d.orderId]);
    const order = orderRows[0];
    if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng.', 'NOT_FOUND');

    // Số lượng đã trả trước đó cho từng sản phẩm của đơn
    const [prev] = await conn.query(
      `SELECT rd.product_id, COALESCE(SUM(rd.quantity), 0) AS qty
         FROM return_details rd JOIN returns r ON r.id = rd.return_id
        WHERE r.order_id = ? GROUP BY rd.product_id`,
      [d.orderId]
    );
    const prevMap = {};
    prev.forEach((r) => { prevMap[r.product_id] = Number(r.qty); });

    const [detailRows] = await conn.query(
      'SELECT * FROM order_details WHERE order_id = ?',
      [d.orderId]
    );
    const orderMap = {};
    detailRows.forEach((r) => { orderMap[r.product_id] = r; });

    let subtotal = 0;
    const validated = [];
    for (const it of items) {
      const o = orderMap[it.productId];
      const maxQty = (o ? Number(o.quantity) : 0) - (prevMap[it.productId] || 0);
      if (!o) throw new ApiError(400, `Sản phẩm không nằm trong đơn ${d.orderId}.`, 'BAD_REQUEST');
      const qty = Math.min(num(it.quantity), maxQty);
      if (qty <= 0) throw new ApiError(400, 'Số lượng trả vượt quá số lượng đã mua.', 'BAD_REQUEST');
      const price = num(it.price) || Number(o.price) || 0;
      const lineTotal = qty * price;
      subtotal += lineTotal;
      validated.push({
        product_id: it.productId,
        sku: o.sku,
        product_name: o.product_name,
        quantity: qty,
        price,
        subtotal: lineTotal,
        cost_price: Number(o.cost_price) || 0
      });
    }

    const refundAmount = Math.min(num(d.refundAmount, subtotal), subtotal);
    const returnId = genId('RET');
    const now = nowLocal();

    // Hoàn lại kho nếu đơn đã trừ kho
    if (orderNeedsStock(order)) {
      for (const it of validated) {
        await adjustStock(conn, it.product_id, Number(it.quantity));
      }
    }

    await conn.query(
      `INSERT INTO returns (id, order_id, customer_id, customer_name, subtotal, refund_amount, reason, note, created_by, created_at, store_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnId,
        d.orderId,
        order.customer_id || null,
        order.customer_name || '',
        subtotal,
        refundAmount,
        d.reason || null,
        d.note || null,
        payload.user?.id || null,
        now,
        order.store_id || null
      ]
    );
    if (validated.length > 0) {
      const cols = ['return_id', ...Object.keys(validated[0])];
      const placeholders = validated.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
      const values = validated.flatMap((r) => [returnId, ...Object.keys(validated[0]).map((c) => r[c])]);
      await conn.query(`INSERT INTO return_details (${cols.join(',')}) VALUES ${placeholders}`, values);
    }

    if (refundAmount > 0) {
      if (order.payment_status === 'paid') {
        await logCash(conn, {
          type: 'spend',
          category: 'return',
          amount: refundAmount,
          refId: returnId,
          note: `Hoàn tiền trả hàng ${returnId} (đơn ${d.orderId})`,
          createdBy: payload.user?.id || null
        });
      } else if (order.customer_id) {
        // Đơn chưa thanh toán: giảm công nợ
        await addDebtEntry(conn, {
          customerId: order.customer_id,
          type: 'refund',
          refType: 'return',
          refId: returnId,
          amount: -refundAmount,
          note: `Trả hàng ${returnId} giảm nợ đơn ${d.orderId}`,
          createdBy: payload.user?.id || null
        });
      }
    } else if (order.customer_id) {
      await recomputeCustomerDebt(conn, order.customer_id);
    }

    await conn.commit();
    return { returnId, subtotal, refundAmount };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}