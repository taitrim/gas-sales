import { query } from '../db.js';
import { num } from '../utils.js';
import { mapOrderRow, mapOrderDetailRow } from '../mappers.js';

// Báo cáo tồn kho: giá trị kho, hàng tồn theo danh mục, tồn chậm bán, tồn chết
export async function getInventoryReport() {
  const [products, categoryRows, salesRows, variantRows] = await Promise.all([
    query('SELECT id, sku, name, category, unit, import_price, retail_price, stock FROM products'),
    query('SELECT category, COUNT(*) cnt, SUM(stock) stock, SUM(stock * import_price) cost_value, SUM(stock * retail_price) retail_value FROM products GROUP BY category'),
    query(
      `SELECT od.product_id, SUM(od.quantity) qty, MAX(o.created_at) last_sale
         FROM order_details od JOIN orders o ON o.id = od.order_id
        WHERE o.status = 'completed'
        GROUP BY od.product_id`
    ),
    query('SELECT product_id, SUM(stock) stock FROM product_variants WHERE is_active = 1 GROUP BY product_id')
  ]);

  const salesMap = {};
  salesRows.forEach((r) => { salesMap[r.product_id] = { qty: Number(r.qty) || 0, lastSale: r.last_sale }; });
  const variantMap = {};
  variantRows.forEach((r) => { variantMap[r.product_id] = Number(r.stock) || 0; });

  const now = new Date();
  const daysSince = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return Math.max(0, Math.floor((now.getTime() - dt.getTime()) / 86400000));
  };

  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalStock = 0;

  const productsReport = products.map((p) => {
    const stock = (Number(p.stock) || 0) + (variantMap[p.id] || 0);
    const costValue = stock * (Number(p.import_price) || 0);
    const retailValue = stock * (Number(p.retail_price) || 0);
    totalCostValue += costValue;
    totalRetailValue += retailValue;
    totalStock += stock;
    const sold = salesMap[p.id]?.qty || 0;
    const lastSaleDays = daysSince(salesMap[p.id]?.lastSale);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category || '—',
      unit: p.unit || '',
      stock,
      importPrice: Number(p.import_price),
      retailPrice: Number(p.retail_price),
      costValue,
      retailValue,
      soldQty: sold,
      lastSaleDays
    };
  });

  // Tồn chậm bán: có tồn nhưng không bán 60+ ngày; tồn chết: tồn nhưng không bán 120+ ngày
  const slowMoving = productsReport.filter((p) => p.stock > 0 && p.lastSaleDays !== null && p.lastSaleDays >= 60 && p.lastSaleDays < 120);
  const deadStock = productsReport.filter((p) => p.stock > 0 && (p.lastSaleDays === null || p.lastSaleDays >= 120));
  const lowStock = productsReport.filter((p) => p.stock <= 5);

  return {
    totalProducts: products.length,
    totalStock,
    totalCostValue,
    totalRetailValue,
    byCategory: categoryRows.map((r) => ({
      category: r.category || '—',
      count: Number(r.cnt),
      stock: Number(r.stock) || 0,
      costValue: Number(r.cost_value) || 0,
      retailValue: Number(r.retail_value) || 0
    })),
    lowStock: lowStock.sort((a, b) => a.stock - b.stock).slice(0, 30),
    slowMoving: slowMoving.sort((a, b) => b.costValue - a.costValue),
    deadStock: deadStock.sort((a, b) => b.costValue - a.costValue),
    topProducts: [...productsReport].sort((a, b) => b.soldQty - a.soldQty).slice(0, 20)
  };
}

export async function getSalesStats(payload) {
  const start = payload.startDate || '1970-01-01';
  const end = payload.endDate || '2099-12-31';
  const params = [`${start} 00:00:00`, `${end} 23:59:59`];

  const [daily, dailyCost, topProducts, paymentMethods, statuses] = await Promise.all([
    query(
      `SELECT DATE(created_at) d, COUNT(*) orders, SUM(total_amount) revenue,
              SUM(shipping_fee) shipping, SUM(discount) discount, SUM(surcharge) surcharge
       FROM orders WHERE status = 'completed' AND created_at BETWEEN ? AND ?
       GROUP BY DATE(created_at) ORDER BY d`,
      params
    ),
    query(
      `SELECT DATE(o.created_at) d, SUM(od.quantity * od.cost_price) cost
       FROM order_details od
       JOIN orders o ON o.id = od.order_id
       WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?
       GROUP BY DATE(o.created_at)`,
      params
    ),
    query(
      `SELECT od.product_id, od.product_name, SUM(od.quantity) qty,
              SUM(od.quantity * od.price) revenue, SUM(od.quantity * od.cost_price) cost
       FROM order_details od
       JOIN orders o ON o.id = od.order_id
       WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?
       GROUP BY od.product_id, od.product_name ORDER BY revenue DESC LIMIT 10`,
      params
    ),
    query(
      `SELECT COALESCE(NULLIF(payment_method, ''), 'other') method, COUNT(*) orders, SUM(total_amount) revenue
       FROM orders WHERE status = 'completed' AND created_at BETWEEN ? AND ?
       GROUP BY method`,
      params
    ),
    query(
      `SELECT status, COUNT(*) orders, SUM(total_amount) revenue
       FROM orders WHERE created_at BETWEEN ? AND ?
       GROUP BY status`,
      params
    )
  ]);

  const costMap = {};
  dailyCost.forEach((r) => (costMap[r.d] = Number(r.cost) || 0));

  return {
    start,
    end,
    daily: daily.map((r) => {
      const revenue = Number(r.revenue) || 0;
      const cost = costMap[r.d] || 0;
      return {
        date: r.d,
        orders: Number(r.orders),
        revenue,
        shipping: Number(r.shipping) || 0,
        discount: Number(r.discount) || 0,
        surcharge: Number(r.surcharge) || 0,
        cost,
        profit: revenue - cost
      };
    }),
    topProducts: topProducts.map((r) => {
      const revenue = Number(r.revenue) || 0;
      const cost = Number(r.cost) || 0;
      return {
        productId: r.product_id,
        productName: r.product_name,
        qty: Number(r.qty),
        revenue,
        cost,
        profit: revenue - cost
      };
    }),
    paymentMethods: paymentMethods.map((r) => ({
      method: r.method,
      orders: Number(r.orders),
      revenue: Number(r.revenue) || 0
    })),
    statuses: statuses.map((r) => ({
      status: r.status,
      orders: Number(r.orders),
      revenue: Number(r.revenue) || 0
    }))
  };
}

export async function getAlerts() {
  const [lowStock, pendingOrders, supplierDebt, customerDebt, overdue] = await Promise.all([
    query(
      "SELECT id, sku, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC LIMIT 20"
    ),
    query("SELECT COUNT(*) c FROM orders WHERE status = 'pending'"),
    query(
      `SELECT id, supplier_name, remaining_amount, payment_status
       FROM imports WHERE remaining_amount > 0
       ORDER BY remaining_amount DESC LIMIT 10`
    ),
    query(
      `SELECT o.customer_id id, o.customer_name, o.phone, SUM(o.total_amount) debt
       FROM orders o
       WHERE o.customer_id IS NOT NULL AND o.customer_id <> ''
         AND o.status = 'completed' AND o.payment_status IN ('unpaid','partial')
       GROUP BY o.customer_id, o.customer_name, o.phone
       ORDER BY debt DESC LIMIT 10`
    ),
    query(
      `SELECT o.customer_id id, o.customer_name, o.phone,
              COALESCE(c.payment_terms_days, 0) payment_terms_days,
              DATEDIFF(NOW(), DATE_ADD(o.created_at, INTERVAL COALESCE(c.payment_terms_days, 0) DAY)) overdue_days,
              o.total_amount debt
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.customer_id IS NOT NULL AND o.customer_id <> ''
         AND o.status <> 'cancelled' AND o.payment_status IN ('unpaid','partial')
         AND o.created_at < DATE_SUB(NOW(), INTERVAL COALESCE(c.payment_terms_days, 0) DAY)
       ORDER BY overdue_days DESC LIMIT 10`
    )
  ]);

  return {
    lowStock: lowStock.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      stock: Number(r.stock)
    })),
    pendingOrders: Number(pendingOrders[0].c) || 0,
    supplierDebt: supplierDebt.map((r) => ({
      id: r.id,
      supplierName: r.supplier_name,
      remainingAmount: Number(r.remaining_amount),
      paymentStatus: r.payment_status
    })),
    customerDebt: customerDebt.map((r) => ({
      customerId: r.id,
      customerName: r.customer_name,
      phone: r.phone,
      debt: Number(r.debt)
    })),
    overdueDebt: overdue.map((r) => ({
      customerId: r.id,
      customerName: r.customer_name,
      phone: r.phone,
      debt: Number(r.debt),
      days: Number(r.overdue_days) || 0
    }))
  };
}

export async function getFinancialReport(payload) {
  // Dùng SQL aggregation thay vì load toàn bộ orders/imports vào RAM (tránh OOM với dữ liệu lớn)
  const s = payload.startDate || '1970-01-01';
  const e = payload.endDate || '2099-12-31';
  const start = `${s} 00:00:00`;
  const end = `${e} 23:59:59`;

  // 1. Revenue, discount, surcharge, shipCost từ orders
  const [orderAgg] = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.discount ELSE 0 END), 0) AS discount,
       COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.surcharge ELSE 0 END), 0) AS surcharge,
       COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.shipping_method = 'courier' THEN o.shipping_fee ELSE 0 END), 0) AS ship_cost
     FROM orders o
     WHERE o.created_at BETWEEN ? AND ?`,
    [start, end]
  );
  const revenue = num(orderAgg.revenue);
  const discount = num(orderAgg.discount);
  const surcharge = num(orderAgg.surcharge);
  const shipCost = num(orderAgg.ship_cost);

  // 2. Giá vốn — JOIN order_details (cost = quantity * cost_price)
  const [costAgg] = await query(
    `SELECT COALESCE(SUM(od.quantity * od.cost_price), 0) AS cost
     FROM orders o
     JOIN order_details od ON od.order_id = o.id
     WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?`,
    [start, end]
  );
  const cost = num(costAgg.cost);

  // 3. Lợi nhuận dropship theo PM (ORDER đang hoàn thành + shipping_method = dropship)
  const dropshipProfit = { cash: 0, cod: 0, transfer: 0, card: 0, other: 0 };
  const dropshipAgg = await query(
    `SELECT
       CASE WHEN o.payment_method IN ('cash','transfer','cod','card') THEN o.payment_method ELSE 'other' END AS pm,
       COALESCE(SUM(o.total_amount - od.quantity * od.cost_price), 0) AS profit
     FROM orders o
     JOIN order_details od ON od.order_id = o.id
     WHERE o.status = 'completed' AND o.shipping_method = 'dropship'
       AND o.created_at BETWEEN ? AND ?
     GROUP BY pm`,
    [start, end]
  );
  for (const r of dropshipAgg) if (r.pm && r.pm in dropshipProfit) dropshipProfit[r.pm] = num(r.profit);

  // 4. Tổng đơn dropship
  const [dropshipCount] = await query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE status = 'completed' AND shipping_method = 'dropship' AND created_at BETWEEN ? AND ?`,
    [start, end]
  );

  // 5. Lợi nhuận giữ ở NCC (chỉ cash/cod dropship có supplier)
  const supplierProfit = await query(
    `SELECT o.dropship_supplier_id AS sid,
            COALESCE(SUM(o.total_amount - od.quantity * od.cost_price), 0) AS profit
     FROM orders o
     JOIN order_details od ON od.order_id = o.id
     WHERE o.status = 'completed' AND o.shipping_method = 'dropship'
       AND o.payment_method IN ('cash','cod') AND o.dropship_supplier_id IS NOT NULL
       AND o.created_at BETWEEN ? AND ?
     GROUP BY o.dropship_supplier_id`,
    [start, end]
  );
  const supplierProfitMap = {};
  for (const r of supplierProfit) if (r.sid) supplierProfitMap[r.sid] = num(r.profit);

  // 6. Tổng nhập/trả theo NCC
  const importAgg = await query(
    `SELECT supplier_id AS sid,
            COALESCE(SUM(total_amount), 0) AS imp_total,
            COALESCE(SUM(paid_amount), 0) AS paid_total
     FROM imports
     WHERE created_at BETWEEN ? AND ?
     GROUP BY supplier_id`,
    [start, end]
  );
  const importMap = {};
  for (const r of importAgg) if (r.sid) importMap[r.sid] = { importTotal: num(r.imp_total), paidTotal: num(r.paid_total) };

  // 7. Danh sách NCC để hiển thị chi tiết
  const supplierRows = await query('SELECT id, name FROM suppliers ORDER BY name');

  // 8. Chi phí
  const [expRows] = await query(
    'SELECT COALESCE(SUM(amount), 0) s FROM expenses WHERE created_at BETWEEN ? AND ?',
    [start, end]
  );
  const totalExpenses = num(expRows.s);

  const supplierDetails = supplierRows.map((s) => {
    const imp = importMap[s.id] || { importTotal: 0, paidTotal: 0 };
    const profitHeld = supplierProfitMap[s.id] || 0;
    return {
      supplierId: s.id,
      supplierName: s.name,
      totalImportDebt: imp.importTotal,
      totalPaid: imp.paidTotal,
      profitHeldBySupplier: profitHeld,
      finalSettlement: imp.importTotal - imp.paidTotal - profitHeld
    };
  });

  const dropshipTotal = num(dropshipCount.cnt);

  return {
    revenue,
    costOfGoods: cost,
    grossProfit: revenue - cost,
    netProfit: revenue - cost - shipCost - discount + surcharge - totalExpenses,
    totalExpenses,
    totalShippingCost: shipCost,
    totalSurcharge: surcharge,
    dropshipStats: {
      totalOrders: dropshipTotal,
      profit: dropshipProfit,
      profitHeldBySupplier: Object.values(supplierProfitMap).reduce((a, b) => a + b, 0),
      transferFulfilledOrders: dropshipProfit.transfer + dropshipProfit.card
    },
    supplierDetails
  };
}

// ============================================================
// Báo cáo nâng cao
// ============================================================
export async function getSalesByStaff(payload) {
  const s = payload.from || '1970-01-01';
  const e = payload.to || '2099-12-31';
  const rows = await query(
    `SELECT COALESCE(o.created_by, '') created_by, COALESCE(u.full_name, o.created_by, '—') staff_name,
            COUNT(*) orders, SUM(o.total_amount) revenue
       FROM orders o
       LEFT JOIN users u ON u.id = o.created_by
      WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?
      GROUP BY o.created_by, u.full_name ORDER BY revenue DESC`,
    [`${s} 00:00:00`, `${e} 23:59:59`]
  );
  return rows.map((r) => ({
    createdBy: r.created_by,
    staffName: r.staff_name,
    orders: Number(r.orders),
    revenue: Number(r.revenue) || 0
  }));
}

export async function getSalesByCategory(payload) {
  const s = payload.from || '1970-01-01';
  const e = payload.to || '2099-12-31';
  const rows = await query(
    `SELECT COALESCE(NULLIF(p.category, ''), 'Khác') category,
            SUM(od.quantity) qty,
            SUM(od.quantity * od.price) revenue,
            SUM(od.quantity * od.cost_price) cost
       FROM order_details od
       JOIN orders o ON o.id = od.order_id
       LEFT JOIN products p ON p.id = od.product_id
      WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?
      GROUP BY category ORDER BY revenue DESC`,
    [`${s} 00:00:00`, `${e} 23:59:59`]
  );
  return rows.map((r) => {
    const revenue = Number(r.revenue) || 0;
    const cost = Number(r.cost) || 0;
    return {
      category: r.category,
      qty: Number(r.qty),
      revenue,
      cost,
      profit: revenue - cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0
    };
  });
}

export async function getProfitReport(payload) {
  const s = payload.from || '1970-01-01';
  const e = payload.to || '2099-12-31';
  const groupBy = payload.groupBy || 'day';
  const expr =
    groupBy === 'month'
      ? 'DATE_FORMAT(o.created_at, "%Y-%m")'
      : groupBy === 'week'
        ? 'DATE_FORMAT(DATE_SUB(o.created_at, INTERVAL WEEKDAY(o.created_at) DAY), "%Y-%m-%d")'
        : 'DATE(o.created_at)';
  const rows = await query(
    `SELECT ${expr} period, COUNT(DISTINCT o.id) orders,
            SUM(o.total_amount) revenue,
            SUM(od.quantity * od.cost_price) cost,
            SUM(o.discount) discount
       FROM orders o
       JOIN order_details od ON od.order_id = o.id
      WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?
      GROUP BY period ORDER BY period`,
    [`${s} 00:00:00`, `${e} 23:59:59`]
  );
  return rows.map((r) => {
    const revenue = Number(r.revenue) || 0;
    const cost = Number(r.cost) || 0;
    return {
      period: r.period,
      orders: Number(r.orders),
      revenue,
      cost,
      discount: Number(r.discount) || 0,
      profit: revenue - cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0
    };
  });
}

export async function getPeriodComparison(payload) {
  const from = new Date(payload.from);
  const to = new Date(payload.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Thiếu khoảng thời gian hợp lệ.');
  }
  to.setHours(23, 59, 59);
  from.setHours(0, 0, 0);
  const lengthMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

  const [cur, prev] = await Promise.all([
    query(
      `SELECT COUNT(*) orders, COALESCE(SUM(total_amount),0) revenue, COALESCE(SUM(discount),0) discount
         FROM orders WHERE status = 'completed' AND created_at BETWEEN ? AND ?`,
      [fmt(from), fmt(to)]
    ),
    query(
      `SELECT COUNT(*) orders, COALESCE(SUM(total_amount),0) revenue, COALESCE(SUM(discount),0) discount
         FROM orders WHERE status = 'completed' AND created_at BETWEEN ? AND ?`,
      [fmt(prevFrom), fmt(prevTo)]
    )
  ]);
  const c = cur[0];
  const p = prev[0];
  const diff = (v, base) => (base ? ((v - base) / base) * 100 : v > 0 ? 100 : 0);
  return {
    current: { from: from.toISOString(), to: to.toISOString(), orders: Number(c.orders), revenue: Number(c.revenue), discount: Number(c.discount) },
    previous: { from: prevFrom.toISOString(), to: prevTo.toISOString(), orders: Number(p.orders), revenue: Number(p.revenue), discount: Number(p.discount) },
    revenueChangePct: diff(Number(c.revenue), Number(p.revenue)),
    ordersChangePct: diff(Number(c.orders), Number(p.orders))
  };
}

export async function getDashboard() {
  const today = new Date();
  const dayStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekStart = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  const [todayRow, weekRow, monthRow, lowStock, topProducts, newCustomers, pending, statusRows, monthCost, trendRows, recentOrders] =
    await Promise.all([
      query(
        "SELECT COUNT(*) orders, COALESCE(SUM(total_amount),0) revenue FROM orders WHERE status = 'completed' AND created_at >= ?",
        [`${dayStart} 00:00:00`]
      ),
      query(
        "SELECT COUNT(*) orders, COALESCE(SUM(total_amount),0) revenue FROM orders WHERE status = 'completed' AND created_at >= ?",
        [`${weekStart} 00:00:00`]
      ),
      query(
        "SELECT COUNT(*) orders, COALESCE(SUM(total_amount),0) revenue FROM orders WHERE status = 'completed' AND created_at >= ?",
        [`${monthStart} 00:00:00`]
      ),
      query('SELECT COUNT(*) c FROM products WHERE stock <= 5'),
      query(
        `SELECT od.product_id, od.product_name, SUM(od.quantity) qty, SUM(od.quantity * od.price) revenue
           FROM order_details od JOIN orders o ON o.id = od.order_id
          WHERE o.status = 'completed' AND o.created_at >= ?
          GROUP BY od.product_id, od.product_name ORDER BY qty DESC LIMIT 5`,
        [`${monthStart} 00:00:00`]
      ),
      query('SELECT COUNT(*) c FROM customers WHERE last_purchase_date >= ?', [
        `${monthStart} 00:00:00`
      ]),
      query("SELECT COUNT(*) c FROM orders WHERE status = 'pending'"),
      // Số đơn theo trạng thái (thay cho việc frontend tải toàn bộ orders)
      query('SELECT status, COUNT(*) c FROM orders GROUP BY status'),
      // Giá vốn tháng để tính lợi nhuận gộp
      query(
        `SELECT COALESCE(SUM(od.quantity * od.cost_price), 0) c
           FROM orders o JOIN order_details od ON od.order_id = o.id
          WHERE o.status = 'completed' AND o.created_at >= ?`,
        [`${monthStart} 00:00:00`]
      ),
      // Doanh thu 7 ngày gần nhất
      query(
        `SELECT DATE(created_at) d, COALESCE(SUM(total_amount), 0) revenue
           FROM orders
          WHERE status = 'completed' AND created_at >= ?
          GROUP BY DATE(created_at)`,
        [`${weekStart} 00:00:00`]
      ),
      // 5 đơn gần nhất (có giới hạn nhỏ, an toàn với dữ liệu lớn)
      query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5')
    ]);

  // Map trạng thái
  const statusCounts = {};
  for (const r of statusRows) statusCounts[r.status] = Number(r.c) || 0;

  // Doanh thu 7 ngày — điền đủ 7 ngày
  const trendMap = {};
  for (const r of trendRows) trendMap[String(r.d)] = Number(r.revenue) || 0;
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    trend.push({ label: key.slice(5).replace('-', '/'), value: trendMap[key] || 0 });
  }

  const detailMap = {};
  if (recentOrders.length > 0) {
    // Lấy chi tiết của chính 5 đơn gần nhất (MySQL không hỗ trợ LIMIT trong IN subquery)
    const ids = recentOrders.map((r) => r.id);
    const recentDetails = await query(
      `SELECT * FROM order_details WHERE order_id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    for (const r of recentDetails) {
      if (!detailMap[r.order_id]) detailMap[r.order_id] = [];
      detailMap[r.order_id].push(mapOrderDetailRow(r));
    }
  }
  const recentOrdersList = recentOrders.map((r) => ({
    ...mapOrderRow(r),
    items: detailMap[r.id] || []
  }));

  return {
    today: { orders: Number(todayRow[0].orders) || 0, revenue: Number(todayRow[0].revenue) || 0 },
    thisWeek: { orders: Number(weekRow[0].orders) || 0, revenue: Number(weekRow[0].revenue) || 0 },
    thisMonth: { orders: Number(monthRow[0].orders) || 0, revenue: Number(monthRow[0].revenue) || 0, cost: Number(monthCost[0].c) || 0 },
    lowStockCount: Number(lowStock[0].c) || 0,
    pendingOrders: Number(pending[0].c) || 0,
    activeCustomersMonth: Number(newCustomers[0].c) || 0,
    statusCounts,
    trend,
    recentOrders,
    topProducts: topProducts.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      qty: Number(r.qty),
      revenue: Number(r.revenue) || 0
    }))
  };
}