export async function logCash(
  conn,
  { type, category = 'manual', amount, refId = null, note = null, createdBy = null }
) {
  await conn.query(
    `INSERT INTO cash_ledger (type, category, amount, ref_id, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [type, category, Number(amount) || 0, refId, note, createdBy]
  );
}