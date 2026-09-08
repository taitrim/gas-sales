import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { ImportCheckReport, ImportConfig, ImportResult } from '../types';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

const ALL_SHEETS = [
  'Stores',
  'Suppliers',
  'Customers',
  'Users',
  'Products',
  'Imports',
  'ImportDetails',
  'Orders',
  'OrderDetails',
  'SupplierTransactions',
  'StoreInfo'
];

const DEFAULT_CONFIG: ImportConfig = { sheetId: '', auth: 'public', apiKey: '', credsPath: '' };

export default function ImportData() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ImportConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(ALL_SHEETS));
  const [dryRun, setDryRun] = useState(false);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState<ImportCheckReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const loadConfig = useCallback(() => {
    api
      .getImportConfig()
      .then((c) => setConfig({ ...DEFAULT_CONFIG, ...c }))
      .finally(() => setConfigLoaded(true));
  }, []);

  useEffect(loadConfig, [loadConfig]);

  function toggleSheet(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleSave() {
    if (!config.sheetId.trim()) {
      toast('Vui lòng nhập Spreadsheet ID.', 'err');
      return;
    }
    if (config.auth === 'apikey' && !config.apiKey.trim()) {
      toast('Vui lòng nhập Google API Key (sheet phải public).', 'err');
      return;
    }
    if (config.auth === 'service' && !config.credsPath.trim()) {
      toast('Vui lòng nhập đường dẫn file service account JSON.', 'err');
      return;
    }
    setBusy('save');
    try {
      await api.saveImportConfig(config);
      toast('Đã lưu cấu hình import.');
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy('');
    }
  }

  async function handleCheck() {
    setBusy('check');
    setReport(null);
    try {
      const r = await api.checkImportData();
      setReport(r);
      toast(`Đã kết nối Google Sheets (${r.authName}).`);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy('');
    }
  }

  async function handleImport(isDryRun: boolean) {
    setBusy(isDryRun ? 'dry' : 'import');
    setResult(null);
    try {
      const r = await api.runImport({ only: Array.from(selected), dryRun: isDryRun });
      setResult(r);
      toast(
        isDryRun
          ? `Dry-run hoàn tất: ${r.total} dòng sẽ được xử lý.`
          : `Import xong: ${r.total} dòng đã đồng bộ.`
      );
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy('');
    }
  }

  const okTables = report?.tables.filter((t) => t.ok).length ?? 0;
  const okIntegrity = report?.integrity.filter((i) => i.ok).length ?? 0;

  return (
    <div>
      <div className="page-head">
        <h1>Import dữ liệu từ Google Sheets</h1>
        <span className="muted">Dữ liệu cũ trên Google Sheets → đồng bộ vào MySQL</span>
      </div>

      {!configLoaded ? (
        <div className="empty">Đang tải cấu hình...</div>
      ) : (
        <>
          {/* ---------- Cấu hình ---------- */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div className="form-stack form-stack-single">
              <div className="form-section">
                <div className="form-section-title">
                  <span className="form-section-ic">🔗</span>
                  Cấu hình kết nối Google Sheets
                </div>
                <div className="form-section-body">
                  <div className="field full">
                    <FieldLabel tone="primary">Spreadsheet ID</FieldLabel>
                    <input
                      className="field-input"
                      value={config.sheetId}
                      onChange={(e) => setConfig({ ...config, sheetId: e.target.value })}
                      placeholder="1AbCdEfGhIjKlMnOpQrStUvXyZ..."
                    />
                    <div className="hint">
                      Lấy từ URL: https://docs.google.com/spreadsheets/d/<b>SPREADSHEET_ID</b>/edit
                    </div>
                  </div>
                  <div className="field full">
                    <FieldLabel tone="violet">Phương thức kết nối</FieldLabel>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="radio"
                          checked={config.auth === 'public'}
                          onChange={() => setConfig({ ...config, auth: 'public' })}
                          style={{ width: 'auto' }}
                        />
                        Sheet công khai <span className="hint">(không cần key — khuyến nghị)</span>
                      </label>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="radio"
                          checked={config.auth === 'apikey'}
                          onChange={() => setConfig({ ...config, auth: 'apikey' })}
                          style={{ width: 'auto' }}
                        />
                        API Key
                      </label>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="radio"
                          checked={config.auth === 'service'}
                          onChange={() => setConfig({ ...config, auth: 'service' })}
                          style={{ width: 'auto' }}
                        />
                        Service Account
                      </label>
                    </div>
                  </div>
                  {config.auth === 'public' ? (
                    <div className="field full">
                      <FieldLabel tone="success">Cách chuẩn bị (chỉ 1 bước)</FieldLabel>
                      <div className="hint">
                        Trong Google Sheets bấm nút <b>Chia sẻ</b> (góc phải) → đổi <b>"Giới hạn"</b> thành{' '}
                        <b>"Bất kỳ ai có liên kết"</b> → quyền <b>"Người xem"</b> → Lưu. Không cần tạo API key hay
                        service account.
                      </div>
                    </div>
                  ) : config.auth === 'apikey' ? (
                    <div className="field full">
                      <FieldLabel tone="amber">Google API Key</FieldLabel>
                      <input
                        className="field-input"
                        value={config.apiKey}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        placeholder="AIza..."
                      />
                    </div>
                  ) : (
                    <div className="field full">
                      <FieldLabel tone="info">Đường dẫn file service account JSON (trên máy chạy backend)</FieldLabel>
                      <input
                        className="field-input"
                        value={config.credsPath}
                        onChange={(e) => setConfig({ ...config, credsPath: e.target.value })}
                        placeholder="C:\path\to\service-account.json"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt">
              <button className="btn btn-primary" onClick={handleSave} disabled={busy === 'save'}>
                {busy === 'save' ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
              <button className="btn btn-ghost" onClick={handleCheck} disabled={!!busy} style={{ marginLeft: 8 }}>
                {busy === 'check' ? 'Đang kiểm tra...' : 'Kiểm tra dữ liệu'}
              </button>
            </div>
          </div>

          {/* ---------- Kết quả kiểm tra ---------- */}
          {report && (
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>
                2. Kết quả kiểm tra — đã kết nối bằng {report.authName}
              </h3>
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="label">Bảng khớp (sheet = DB)</div>
                  <div className="value" style={{ color: okTables === report.tables.length ? 'var(--success)' : 'var(--warning)' }}>
                    {okTables}/{report.tables.length}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="label">Kiểm tra tham chiếu OK</div>
                  <div className="value" style={{ color: okIntegrity === report.integrity.length ? 'var(--success)' : 'var(--danger)' }}>
                    {okIntegrity}/{report.integrity.length}
                  </div>
                </div>
              </div>

              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Sheet / Bảng</th>
                      <th className="right">Số dòng trên Sheet</th>
                      <th className="right">Số dòng trong DB</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.tables.map((t) => (
                      <tr key={t.sheet}>
                        <td data-label="Bảng" style={{ fontWeight: 600 }}>{t.sheet}</td>
                        <td data-label="Số dòng Sheet" className="right nowrap">
                          {t.sheetFound ? t.sheetRows : <span className="muted">không có sheet</span>}
                        </td>
                        <td data-label="Số dòng DB" className="right nowrap">{t.dbRows}</td>
                        <td data-label="Trạng thái">
                          {!t.sheetFound ? (
                            <span className="badge badge-gray">Bỏ qua</span>
                          ) : t.ok ? (
                            <span className="badge badge-green">OK — khớp</span>
                          ) : (
                            <span className="badge badge-yellow">Chưa đồng bộ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Kiểm tra tham chiếu (dữ liệu "mồ côi")</h4>
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {report.integrity.map((c, i) => (
                      <tr key={i}>
                        <td data-label="Kiểm tra">{c.label}</td>
                        <td data-label="Số lỗi" className="right nowrap">{c.count}</td>
                        <td data-label="Kết quả">
                          {c.ok ? (
                            <span className="badge badge-green">OK</span>
                          ) : (
                            <span className="badge badge-red">Có {c.count} bản ghi lỗi</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---------- Chạy import ---------- */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>3. Chạy import</h3>
            <div className="toolbar">
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Dry-run (chỉ đếm, không ghi DB)
              </label>
            </div>
            <div className="mb">
              {ALL_SHEETS.map((s) => (
                <label
                  key={s}
                  style={{
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                    marginRight: 14,
                    marginBottom: 6,
                    padding: '4px 10px',
                    background: selected.has(s) ? '#eff6ff' : '#f8fafc',
                    borderRadius: 999,
                    border: `1px solid ${selected.has(s) ? '#bfdbfe' : 'var(--border)'}`
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s)}
                    onChange={() => toggleSheet(s)}
                    style={{ width: 'auto' }}
                  />
                  {s}
                </label>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleImport(false)}
              disabled={!!busy || selected.size === 0}
            >
              {busy === 'import' ? 'Đang import...' : `Import ${selected.size} bảng`}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => handleImport(true)}
              disabled={!!busy || selected.size === 0}
              style={{ marginLeft: 8 }}
            >
              {busy === 'dry' ? 'Đang chạy dry-run...' : 'Dry-run'}
            </button>
          </div>

          {/* ---------- Kết quả import ---------- */}
          {result && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>
                Kết quả import ({result.dryRun ? 'dry-run' : 'đã ghi vào DB'}) —{' '}
                tổng {result.total} dòng
              </h3>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Sheet</th>
                      <th className="right">Số dòng</th>
                      <th className="right">Dòng thiếu ID (bỏ qua)</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.sheet}>
                        <td data-label="Sheet" style={{ fontWeight: 600 }}>{r.sheet}</td>
                        <td data-label="Số dòng" className="right nowrap">{r.rows}</td>
                        <td data-label="Thiếu ID" className="right nowrap">{r.missingIds}</td>
                        <td data-label="Ghi chú">
                          {r.error ? <span className="badge badge-red">Lỗi: {r.error}</span> : 'OK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}