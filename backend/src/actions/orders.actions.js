import { pool, query } from '../db.js';
import { adjustStock, adjustOrderStock, orderNeedsStock, replaceOrderDetails, replaceImportDetails } from '../inventory.js';
import { ApiError, genId, nowLocal, dateOrNull, num } from '../utils.js';
import { mapOrderRow, mapOrderDetailRow } from '../mappers.js';
import { logCash } from '../ledger.js';
import { resolveOrderItemPrices, sumItems } from '../pricing.js';
import { computePromoDiscount } from '../promo.js';
import { computePointsEarned, getPointValue, adjustCustomerPoints } from '../points.js';
import { addDebtEntry, recomputeCustomerDebt } from './debt.actions.js';

// Tự động tạo phiếu nhập cho đơn drop-ship "shop thu" (khách thanh toán đủ chuyển khoản/thẻ cho shop).
// Khi đó shop mua hàng từ NCC để giao => lập phiếu nhập tương ứng số lượng đơn, lợi nhuận tính như đơn thường.
// Trường hợp "NCC thu" (cash/COD): NCC giao + nhận tiền, KHÔNG tạo phiếu nhập, chỉ ghi có lợi nhuận ở NCC
// (xử lý ở báo cáo). Phiếu nhập tự động dùng id = 'DRP-ORD-<orderId>' để đảm bảo đơn nhất + dễ hoàn tác.
async function syncDropshipImport(conn, orderId, order) {
  const isShopDebtor =
    order.status === 'completed' &&
    order.shippingMethod === 'dropship' &&
    (order.paymentMethod === 'transfer' || order.paymentMethod === 'card') &&
    order.paymentStatus === 'paid';
  const importId = `DRP-ORD-${orderId}`;

  // Không còn áp dụng (hủy, đổi phương thức, giảm tiền) => xóa phiếu nhập tự động nếu có
  if (!isShopDebtor) {
    const [rows] = await conn.query('SELECT id FROM imports WHERE id = ?', [importId]);
    if (rows[0]) {
      const dRows = await conn.query('SELECT product_id, quantity FROM import_details WHERE import_id = ?', [importId]);
      for (const r of dRows[0]) await adjustStock(conn, r.product_id, -Number(r.quantity));
      await conn.query('DELETE FROM import_details WHERE import_id = ?', [importId]);
      await conn.query('DELETE FROM imports WHERE id = ?', [importId]);
    }
    return;
  }
  if (!order.dropshipSupplierId) return;

  const [supRows] = await conn.query('SELECT name FROM suppliers WHERE id = ?', [order.dropshipSupplierId]);
  const supplierName = supRows[0]?.name || '';

  const items = (order.items || []).map((it) => ({
    productId: it.productId ?? null,
    sku: it.sku ?? null,
    productName: it.productName ?? '',
    quantity: Number(it.quantity) || 0,
    importPrice: Number(it.costPrice) || 0
  }));
  const total = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.importPrice) || 0), 0);

  const [exists] = await conn.query('SELECT id FROM imports WHERE id = ?', [importId]);
  if (!exists[0]) {
    await conn.query(
      `INSERT INTO imports (id, supplier_id, supplier_name, total_amount, created_by, created_at, shipping_fee,
         carrier, payment_status, paid_amount, remaining_amount, store_id)
       VALUES (?, ?, ?, ?, ?, NOW(), 0, 'Dropship Auto - Shop Thu', 'unpaid', 0, ?, ?)`,
      [importId, order.dropshipSupplierId, supplierName, total, order.createdBy || null, total, order.storeId || null]
    );
    for (const it of items) if (it.productId && it.quantity) await adjustStock(conn, it.productId, it.quantity);
  } else {
    // Đồng bộ lại: hoàn kho cũ rồi cộng kho mới
    const dRows = await conn.query('SELECT product_id, quantity FROM import_details WHERE import_id = ?', [importId]);
    for (const r of dRows[0]) await adjustStock(conn, r.product_id, -Number(r.quantity));
    await conn.query(
      `UPDATE imports SET supplier_id = ?, supplier_name = ?, total_amount = ?, remaining_amount = ? WHERE id = ?`,
      [order.dropshipSupplierId, supplierName, total, total, importId]
    );
    for (const it of items) if (it.productId && it.quantity) await adjustStock(conn, it.productId, it.quantity);
  }
  await replaceImportDetails(conn, importId, items);
}

export async function getOrders() {
  // Giới hạn an toàn để tránh memory exhaustion với dataset lớn.
  // Dùng listOrders (paginated) cho frontend khi cần phân trang.
  const LIMIT = 1000;
  const [orders, details] = await Promise.all([
    query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ${LIMIT}`),
    query('SELECT * FROM order_details')
  ]);
  const orderIds = new Set(orders.map((r) => r.id));
  const map = {};
  details.forEach((r) => {
    if (orderIds.has(r.order_id)) {
      if (!map[r.order_id]) map[r.order_id] = [];
      map[r.order_id].push(mapOrderDetailRow(r));
    }
  });
  return orders.map((r) => ({ ...mapOrderRow(r), items: map[r.id] || [] }));
}

// Tính VAT: thuế trên (subtotal - discount), lưu tax_rate + tax_amount
function computeVat(subtotal, discount, taxRate) {
  const rate = num(taxRate);
  if (rate <= 0) return { taxRate: 0, taxAmount: 0 };
  const base = Math.max(0, subtotal - discount);
  return { taxRate: rate, taxAmount: Math.round(base * (rate / 100)) };
}

// Tính điểm tích lũy được hưởng khi khách thanh toán
async function computePointsDiscount(conn, pointsUsed, customer) {
  const used = num(pointsUsed);
  if (used <= 0 || !customer) return { pointsUsed: 0, pointsValue: 0 };
  const available = num(customer.points);
  const actual = Math.min(used, available);
  const pointValue = await getPointValue(conn);
  return { pointsUsed: actual, pointsValue: actual * pointValue };
}

export async function createOrder(payload) {
  const data = payload.orderData || {};
  if (!data.items || data.items.length === 0) {
    throw new ApiError(400, 'Đơn hàng phải có ít nhất 1 sản phẩm.', 'BAD_REQUEST');
  }
  const orderId = data.id || genId('ORD');
  const now = nowLocal();
  const decrement = orderNeedsStock(data);
  const storeId = data.storeId || payload.user?.storeId || null;
  const isPreorder = data.isPreorder === true || data.orderType === 'preorder';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Kiểm tra công nợ / hạn mức khi chưa thanh toán
    let customer = null;
    if (data.customerId) {
      const [custRows] = await conn.query('SELECT * FROM customers WHERE id = ?', [data.customerId]);
      customer = custRows[0] || null;
    }

    const items = await resolveOrderItemPrices(conn, data.items, {
      wholesale: data.orderType === 'wholesale'
    });
    const computedSubtotal = sumItems(items);
    let discount = Number(data.discount) || 0;
    if (data.promoCode) {
      const res = await computePromoDiscount(conn, data.promoCode, computedSubtotal);
      if (res.error) throw new ApiError(400, res.error, 'PROMO_INVALID');
      if (res.promo) {
        discount = res.discount;
        await conn.query('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [res.promo.id]);
      }
    }

    // Điểm tích lũy dùng làm chiết khấu
    const { pointsUsed, pointsValue } = await computePointsDiscount(conn, data.pointsUsed, customer);

    const { taxRate, taxAmount } = computeVat(computedSubtotal, discount, data.taxRate);

    const totalAmount = Math.max(
      0,
      computedSubtotal -
        discount -
        pointsValue +
        taxAmount +
        (Number(data.shippingFee) || 0) +
        (Number(data.surcharge) || 0)
    );

    // Kiểm tra hạn mức công nợ khi chưa thanh toán đủ
    if (customer && data.paymentStatus !== 'paid' && data.status !== 'cancelled') {
      const creditLimit = num(customer.credit_limit);
      const currentDebt = num(customer.total_debt);
      if (creditLimit > 0 && currentDebt + totalAmount > creditLimit) {
        throw new ApiError(
          400,
          `Vượt hạn mức công nợ (${creditLimit.toLocaleString('vi-VN')}đ). Khách còn nợ ${currentDebt.toLocaleString('vi-VN')}đ.`,
          'CREDIT_LIMIT_EXCEEDED'
        );
      }
    }

    for (const item of items) {
      if (decrement) await adjustOrderStock(conn, [item], storeId, -1);
    }

    const pointsEarned = decrement && data.paymentStatus === 'paid' && customer
      ? await computePointsEarned(conn, totalAmount)
      : 0;

    await conn.query(
      `INSERT INTO orders (id, customer_id, customer_name, phone, address, order_type, subtotal, discount,
         shipping_fee, surcharge, total_amount, tax_rate, tax_amount, points_earned, points_used, points_value,
         is_preorder, payment_method, status, payment_status, shipping_method,
         carrier, dropship_supplier_id, created_by, created_at, store_id, note, delivery_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        data.customerId || null,
        data.customerName || '',
        data.phone || null,
        data.address || null,
        data.orderType || null,
        computedSubtotal,
        discount,
        Number(data.shippingFee) || 0,
        Number(data.surcharge) || 0,
        totalAmount,
        taxRate,
        taxAmount,
        pointsEarned,
        pointsUsed,
        pointsValue,
        isPreorder ? 1 : 0,
        data.paymentMethod || null,
        data.status || 'pending',
        data.paymentStatus || null,
        data.shippingMethod || null,
        data.carrier || null,
        data.dropshipSupplierId || null,
        data.createdBy || payload.user?.id || null,
        now,
        storeId,
        data.note || null,
        dateOrNull(data.deliveryDate)
      ]
    );
    await replaceOrderDetails(conn, orderId, items);
    // Tự động lập phiếu nhập nếu đơn drop-ship shop thu (khách trả đủ chuyển khoản/thẻ)
    await syncDropshipImport(conn, orderId, {
      status: data.status,
      shippingMethod: data.shippingMethod,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      dropshipSupplierId: data.dropshipSupplierId,
      storeId,
      createdBy: data.createdBy || payload.user?.id || null,
      items
    });
    if (data.paymentStatus === 'paid' && data.paymentMethod === 'cash' && data.status !== 'cancelled') {
      await logCash(conn, {
        type: 'receive',
        category: 'order',
        amount: totalAmount,
        refId: orderId,
        note: `Thu tiền đơn ${orderId}`,
        createdBy: data.createdBy || payload.user?.id || null
      });
    }
    if (data.customerId && data.paymentStatus !== 'paid' && data.status !== 'cancelled') {
      await addDebtEntry(conn, {
        customerId: data.customerId,
        type: 'order',
        refType: 'order',
        refId: orderId,
        amount: totalAmount,
        note: `Nợ đơn ${orderId}`,
        createdBy: data.createdBy || payload.user?.id || null
      });
    }
    // Trừ điểm khách đã dùng + cộng điểm tích lũy (ghi sổ điểm)
    if (customer) {
      if (pointsUsed > 0) {
        await adjustCustomerPoints(conn, customer.id, -pointsUsed, {
          type: 'redeem',
          refType: 'order',
          refId: orderId,
          note: `Dùng điểm đơn ${orderId}`,
          createdBy: data.createdBy || payload.user?.id || null
        });
      }
      if (pointsEarned > 0) {
        await adjustCustomerPoints(conn, customer.id, pointsEarned, {
          type: 'earn',
          refType: 'order',
          refId: orderId,
          note: `Tích điểm đơn ${orderId}`,
          createdBy: data.createdBy || payload.user?.id || null
        });
      }
    }
    if (customer && data.paymentStatus === 'paid') {
      await conn.query('UPDATE customers SET last_purchase_date = NOW() WHERE id = ?', [customer.id]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { orderId, createdAt: now };
}

export async function updateOrder(payload) {
  const d = payload.orderData || {};
  if (!d.id) throw new ApiError(400, 'Thiếu ID đơn hàng.', 'BAD_REQUEST');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [d.id]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy đơn hàng.', 'NOT_FOUND');

    const oldDecremented = old.status === 'completed' && old.shipping_method !== 'dropship';
    const newDecrements = orderNeedsStock(d);

    const storeId = d.storeId || old.store_id || payload.user?.storeId || null;
    const isPreorder = d.isPreorder === true || d.orderType === 'preorder' || Boolean(old.is_preorder);

    const items = await resolveOrderItemPrices(conn, d.items || [], {
      wholesale: d.orderType === 'wholesale'
    });
    const computedSubtotal = sumItems(items);
    let discount = Number(d.discount) || 0;
    if (d.promoCode) {
      const res = await computePromoDiscount(conn, d.promoCode, computedSubtotal);
      if (res.error) throw new ApiError(400, res.error, 'PROMO_INVALID');
      if (res.promo) {
        discount = res.discount;
        await conn.query('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [res.promo.id]);
      }
    }

    let customer = null;
    const finalCustomerId = d.customerId || old.customer_id || null;
    if (finalCustomerId) {
      const [custRows] = await conn.query('SELECT * FROM customers WHERE id = ?', [finalCustomerId]);
      customer = custRows[0] || null;
    }
    const { pointsUsed, pointsValue } = await computePointsDiscount(conn, d.pointsUsed, customer);

    const { taxRate, taxAmount } = computeVat(computedSubtotal, discount, d.taxRate);

    const totalAmount = Math.max(
      0,
      computedSubtotal -
        discount -
        pointsValue +
        taxAmount +
        (Number(d.shippingFee) || 0) +
        (Number(d.surcharge) || 0)
    );

    const finalPaymentStatus = d.paymentStatus || old.payment_status;
    const finalStatus = d.status || old.status;
    if (customer && finalPaymentStatus !== 'paid' && finalStatus !== 'cancelled') {
      const creditLimit = num(customer.credit_limit);
      const currentDebt = num(customer.total_debt);
      if (creditLimit > 0 && currentDebt + totalAmount > creditLimit) {
        throw new ApiError(
          400,
          `Vượt hạn mức công nợ (${creditLimit.toLocaleString('vi-VN')}đ).`,
          'CREDIT_LIMIT_EXCEEDED'
        );
      }
    }

    if (oldDecremented) {
      const oldDetails = await conn.query(
        'SELECT product_id, quantity FROM order_details WHERE order_id = ?',
        [d.id]
      );
      for (const r of oldDetails[0]) {
        await adjustOrderStock(conn, [{ productId: r.product_id, quantity: r.quantity }], old.store_id, 1);
      }
    }

    await conn.query(
      `UPDATE orders SET customer_id = ?, customer_name = ?, phone = ?, address = ?, order_type = ?, subtotal = ?,
         discount = ?, shipping_fee = ?, surcharge = ?, total_amount = ?, tax_rate = ?, tax_amount = ?,
         points_used = ?, points_value = ?, is_preorder = ?, payment_method = ?, status = ?,
         payment_status = ?, shipping_method = ?, carrier = ?, dropship_supplier_id = ?, note = ?, delivery_date = ?
       WHERE id = ?`,
      [
        d.customerId || null,
        d.customerName || '',
        d.phone || null,
        d.address || null,
        d.orderType || null,
        computedSubtotal,
        discount,
        Number(d.shippingFee) || 0,
        Number(d.surcharge) || 0,
        totalAmount,
        taxRate,
        taxAmount,
        pointsUsed,
        pointsValue,
        isPreorder ? 1 : 0,
        d.paymentMethod || null,
        d.status || 'pending',
        d.paymentStatus || null,
        d.shippingMethod || null,
        d.carrier || null,
        d.dropshipSupplierId || null,
        d.note || null,
        dateOrNull(d.deliveryDate),
        d.id
      ]
    );

    await replaceOrderDetails(conn, d.id, items);

    for (const item of items) {
      if (newDecrements) await adjustOrderStock(conn, [item], storeId, -1);
    }

    // Đồng bộ phiếu nhập tự động theo phương thức thanh toán drop-ship
    await syncDropshipImport(conn, d.id, {
      status: finalStatus,
      shippingMethod: d.shippingMethod || old.shipping_method,
      paymentMethod: d.paymentMethod || old.payment_method,
      paymentStatus: finalPaymentStatus,
      dropshipSupplierId: d.dropshipSupplierId || old.dropship_supplier_id,
      storeId,
      createdBy: payload.user?.id || null,
      items
    });

    // Cộng/trừ lại điểm đã dùng khi khách thay đổi (ghi sổ điểm)
    if (old.points_used > 0 && old.customer_id) {
      await adjustCustomerPoints(conn, old.customer_id, old.points_used, {
        type: 'refund',
        refType: 'order',
        refId: d.id,
        note: `Hoàn điểm đơn cũ ${d.id}`,
        createdBy: payload.user?.id || null
      });
    }
    if (pointsUsed > 0 && finalCustomerId) {
      await adjustCustomerPoints(conn, finalCustomerId, -pointsUsed, {
        type: 'redeem',
        refType: 'order',
        refId: d.id,
        note: `Dùng điểm đơn ${d.id}`,
        createdBy: payload.user?.id || null
      });
    }

    // Đồng bộ công nợ: bỏ sổ nợ cũ của đơn rồi ghi lại theo trạng thái mới
    if (finalCustomerId) {
      await conn.query('DELETE FROM customer_debt_ledger WHERE ref_id = ?', [d.id]);
      if (finalPaymentStatus !== 'paid' && finalStatus !== 'cancelled') {
        await addDebtEntry(conn, {
          customerId: finalCustomerId,
          type: 'order',
          refType: 'order',
          refId: d.id,
          amount: totalAmount,
          note: `Nợ đơn ${d.id}`,
          createdBy: payload.user?.id || null
        });
      } else {
        await recomputeCustomerDebt(conn, finalCustomerId);
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return 'OK';
}

export async function updateOrderStatus(payload) {
  const { orderId, status, paymentStatus } = payload;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy đơn hàng.', 'NOT_FOUND');

    const isDropship = old.shipping_method === 'dropship';
    const oldCompleted = old.status === 'completed';
    const newCompleted = status === 'completed';

    if (!isDropship && oldCompleted !== newCompleted) {
      const details = await conn.query(
        'SELECT product_id, quantity FROM order_details WHERE order_id = ?',
        [orderId]
      );
      const items = details[0].map((r) => ({ productId: r.product_id, quantity: r.quantity }));
      await adjustOrderStock(conn, items, old.store_id, oldCompleted ? 1 : -1);
    }

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    if (paymentStatus) {
      await conn.query('UPDATE orders SET payment_status = ? WHERE id = ?', [paymentStatus, orderId]);
    }

    // Đồng bộ phiếu nhập tự động khi trạng thái/phương thức thanh toán của đơn drop-ship thay đổi
    {
      const [detRows] = await conn.query('SELECT * FROM order_details WHERE order_id = ?', [orderId]);
      const items = detRows.map((r) => ({
        productId: r.product_id,
        sku: r.sku,
        productName: r.product_name,
        quantity: r.quantity,
        costPrice: r.cost_price
      }));
      await syncDropshipImport(conn, orderId, {
        status: status || old.status,
        shippingMethod: old.shipping_method,
        paymentMethod: old.payment_method,
        paymentStatus: paymentStatus || old.payment_status,
        dropshipSupplierId: old.dropship_supplier_id,
        storeId: old.store_id,
        createdBy: payload.user?.id || null,
        items
      });
    }

    // Cộng/trừ điểm tích lũy khi chuyển trạng thái thanh toán
    if (old.customer_id) {
      const finalPaymentStatus = paymentStatus || old.payment_status;
      const finalStatus = status || old.status;
      const alreadyPaid = old.payment_status === 'paid';
      const nowPaid = finalPaymentStatus === 'paid';
      const cancelled = finalStatus === 'cancelled';

      if (nowPaid && !alreadyPaid && !cancelled && old.points_earned === 0) {
        const earned = await computePointsEarned(conn, Number(old.total_amount) || 0);
        if (earned > 0) {
          await conn.query('UPDATE orders SET points_earned = ? WHERE id = ?', [earned, orderId]);
          await adjustCustomerPoints(conn, old.customer_id, earned, {
            type: 'earn',
            refType: 'order',
            refId: orderId,
            note: `Tích điểm đơn ${orderId}`,
            createdBy: payload.user?.id || null
          });
        }
      }
      if ((!nowPaid || cancelled) && old.points_earned > 0) {
        await adjustCustomerPoints(conn, old.customer_id, -old.points_earned, {
          type: 'refund',
          refType: 'order',
          refId: orderId,
          note: `Thu hồi điểm đơn ${orderId}`,
          createdBy: payload.user?.id || null
        });
        await conn.query('UPDATE orders SET points_earned = 0 WHERE id = ?', [orderId]);
      }
    }

    // Đồng bộ công nợ + sổ quỹ theo trạng thái thanh toán cuối
    if (old.customer_id) {
      const [payRows] = await conn.query(
        "SELECT COALESCE(SUM(ABS(amount)),0) s FROM customer_debt_ledger WHERE ref_id = ? AND type = 'payment'",
        [orderId]
      );
      const [refRows] = await conn.query(
        'SELECT COALESCE(SUM(refund_amount),0) s FROM returns WHERE order_id = ? AND customer_id = ?',
        [orderId, old.customer_id]
      );
      const alreadyPaid = Number(payRows[0].s) || 0;
      const alreadyRefunded = Number(refRows[0].s) || 0;
      const remaining = Math.max(0, Number(old.total_amount) || 0 - alreadyPaid - alreadyRefunded);

      await conn.query('DELETE FROM customer_debt_ledger WHERE ref_id = ?', [orderId]);

      const finalPaymentStatus2 = paymentStatus || old.payment_status;
      const finalStatus2 = status || old.status;

      if (finalPaymentStatus2 !== 'paid' && finalStatus2 !== 'cancelled') {
        await addDebtEntry(conn, {
          customerId: old.customer_id,
          type: 'order',
          refType: 'order',
          refId: orderId,
          amount: Number(old.total_amount) || 0,
          note: `Nợ đơn ${orderId}`,
          createdBy: payload.user?.id || null
        });
      } else {
        await recomputeCustomerDebt(conn, old.customer_id);
      }

      // Hoàn tiền quỹ khi hủy đơn đã thanh toán
      if (finalStatus2 === 'cancelled' && old.payment_method === 'cash' && old.payment_status === 'paid') {
        await logCash(conn, {
          type: 'spend',
          category: 'order',
          amount: Number(old.total_amount) || 0,
          refId: orderId,
          note: `Hoàn tiền đơn ${orderId} (hủy)`,
          createdBy: payload.user?.id || null
        });
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return 'OK';
}

export async function deleteOrder(payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [payload.orderId]);
    const old = rows[0];
    if (!old) throw new ApiError(404, 'Không tìm thấy đơn hàng.', 'NOT_FOUND');

    if (old.status === 'completed' && old.shipping_method !== 'dropship') {
      const details = await conn.query(
        'SELECT product_id, quantity FROM order_details WHERE order_id = ?',
        [old.id]
      );
      const items = details[0].map((r) => ({ productId: r.product_id, quantity: r.quantity }));
      await adjustOrderStock(conn, items, old.store_id, 1);
    }
    // Xóa phiếu nhập tự động (DRP-ORD-...) nếu có
    await syncDropshipImport(conn, old.id, {
      status: 'cancelled',
      shippingMethod: old.shipping_method,
      paymentMethod: old.payment_method,
      paymentStatus: old.payment_status,
      dropshipSupplierId: old.dropship_supplier_id,
      storeId: old.store_id,
      items: []
    });
    await conn.query('DELETE FROM order_details WHERE order_id = ?', [old.id]);
    await conn.query('DELETE FROM orders WHERE id = ?', [old.id]);
    if (old.customer_id) {
      await conn.query('DELETE FROM customer_debt_ledger WHERE ref_id = ?', [old.id]);
      await recomputeCustomerDebt(conn, old.customer_id);
      // Hoàn tiền quỹ khi xóa đơn đã thanh toán
      if (old.payment_method === 'cash' && old.payment_status === 'paid') {
        await logCash(conn, {
          type: 'spend',
          category: 'order',
          amount: Number(old.total_amount) || 0,
          refId: old.id,
          note: `Hoàn tiền đơn ${old.id} (xóa)`,
          createdBy: payload.user?.id || null
        });
      }
      // Hoàn điểm đã dùng, trừ điểm đã tích (ghi sổ điểm)
      if (old.points_used > 0) {
        await adjustCustomerPoints(conn, old.customer_id, old.points_used, {
          type: 'refund',
          refType: 'order',
          refId: old.id,
          note: `Hoàn điểm do xóa đơn ${old.id}`,
          createdBy: payload.user?.id || null
        });
      }
      if (old.points_earned > 0) {
        await adjustCustomerPoints(conn, old.customer_id, -old.points_earned, {
          type: 'refund',
          refType: 'order',
          refId: old.id,
          note: `Thu hồi điểm do xóa đơn ${old.id}`,
          createdBy: payload.user?.id || null
        });
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return 'OK';
}