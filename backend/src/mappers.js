import { parseJSON, toBool } from './utils.js';

export function mapUserRow(r) {
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    storeId: r.store_id,
    permissions: parseJSON(r.permissions, null),
    active: toBool(r.active),
    createdAt: r.created_at,
    approve: toBool(r.approve)
  };
}

export function mapProductRow(r) {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    image: r.image,
    category: r.category,
    supplierId: r.supplier_id,
    importPrice: Number(r.import_price),
    retailPrice: Number(r.retail_price),
    wholesalePrice: Number(r.wholesale_price),
    stock: Number(r.stock),
    unit: r.unit,
    pricingTiers: parseJSON(r.pricing_tiers_json, []),
    isCombo: toBool(r.is_combo)
  };
}

export function mapSupplierRow(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    address: r.address,
    taxCode: r.tax_code,
    bankInfo: r.bank_info,
    note: r.note
  };
}

export function mapCustomerRow(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    source: r.source || '',
    totalSpent: Number(r.total_spent),
    totalDebt: Number(r.total_debt),
    creditLimit: Number(r.credit_limit),
    points: Number(r.points),
    paymentTermsDays: Number(r.payment_terms_days),
    lastPurchaseDate: r.last_purchase_date,
    notes: r.notes
  };
}

export function mapStoreRow(r) {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    phone: r.phone,
    managerId: r.manager_id,
    isActive: toBool(r.is_active)
  };
}

export function mapOrderRow(r) {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    phone: r.phone,
    address: r.address,
    orderType: r.order_type,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    taxRate: Number(r.tax_rate),
    taxAmount: Number(r.tax_amount),
    shippingFee: Number(r.shipping_fee),
    surcharge: Number(r.surcharge),
    totalAmount: Number(r.total_amount),
    pointsEarned: Number(r.points_earned),
    pointsUsed: Number(r.points_used),
    pointsValue: Number(r.points_value),
    isPreorder: r.is_preorder ? true : false,
    paymentMethod: r.payment_method,
    status: r.status,
    paymentStatus: r.payment_status,
    shippingMethod: r.shipping_method,
    carrier: r.carrier,
    dropshipSupplierId: r.dropship_supplier_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
    storeId: r.store_id,
    note: r.note,
    deliveryDate: r.delivery_date,
    items: []
  };
}

export function mapOrderDetailRow(r) {
  return {
    productId: r.product_id,
    variantId: r.variant_id || null,
    sku: r.sku,
    productName: r.product_name,
    quantity: Number(r.quantity),
    price: Number(r.price),
    discount: Number(r.discount),
    subtotal: Number(r.subtotal),
    costPrice: Number(r.cost_price)
  };
}

export function mapImportRow(r) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    totalAmount: Number(r.total_amount),
    createdBy: r.created_by,
    createdAt: r.created_at,
    shippingFee: Number(r.shipping_fee),
    carrier: r.carrier,
    paymentStatus: r.payment_status,
    paidAmount: Number(r.paid_amount),
    remainingAmount: Number(r.remaining_amount),
    storeId: r.store_id,
    items: []
  };
}

export function mapImportDetailRow(r) {
  return {
    productId: r.product_id,
    sku: r.sku,
    productName: r.product_name,
    quantity: Number(r.quantity),
    importPrice: Number(r.import_price)
  };
}