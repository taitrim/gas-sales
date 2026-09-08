import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AuditLog } from '../types';
import { fmtDateTime } from '../format';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';

const PAGE_SIZE = 50;

export default function Audit() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({ page, pageSize: PAGE_SIZE, action: actionFilter || undefined });
      setRows(data.rows);
      setTotal(data.total);
      setActions([...new Set(data.rows.map((r) => r.action))].sort());
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Nhật ký hoạt động</h1>
        <button className="btn btn-primary" onClick={load}>
          ⟳ Làm mới
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-filters">
          <Select
            value={actionFilter}
            placeholder="Tất cả hành động"
            options={actions.map((a) => ({ value: a, label: a }))}
            onChange={(v) => {
              setPage(1);
              setActionFilter(v);
            }}
          />
          <span className="muted toolbar-count">{total} bản ghi</span>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : rows.length === 0 ? (
        <div className="empty">Không có bản ghi.</div>
      ) : (
        <>
          <div className="order-cards">
            {rows.map((r) => (
              <div className="order-card" key={r.id}>
                <div className="oc-top">
                  <div className="oc-id">{fmtDateTime(r.createdAt)}</div>
                  <div className="oc-badges">
                    <span className="badge badge-blue">{r.action}</span>
                  </div>
                </div>

                <div className="oc-body">
                  <div className="oc-customer">
                    <div className="oc-avatar oc-avatar-flat">👤</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="oc-cust-name">{r.username || '—'}</div>
                      <div className="oc-cust-phone">IP: {r.ip || '—'}</div>
                    </div>
                  </div>

                  <div className="oc-total">
                    <span className="oc-total-label">Hành động</span>
                    <span className="oc-total-val" style={{ fontSize: 13 }}>{r.id}</span>
                  </div>
                </div>

                <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-link" onClick={() => setDetail(r)}>
                    Chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}

      {detail && (
        <Modal title="Chi tiết nhật ký" onClose={() => setDetail(null)} maxWidth={620}>
          <div className="stats-grid" style={{ marginBottom: 14 }}>
            <div className="stat-card tone-sky">
              <div className="stat-icon">📜</div>
              <div className="stat-body">
                <div className="label">Hành động</div>
                <div className="value" style={{ fontSize: 16 }}>{detail.action}</div>
              </div>
            </div>
            <div className="stat-card tone-slate">
              <div className="stat-icon">👤</div>
              <div className="stat-body">
                <div className="label">Người dùng</div>
                <div className="value" style={{ fontSize: 16 }}>{detail.username || '—'}</div>
              </div>
            </div>
          </div>
          <div className="field">
            <FieldLabel tone="info">Thời gian</FieldLabel>
            <input className="field-input" readOnly value={fmtDateTime(detail.createdAt)} />
          </div>
          <div className="field">
            <FieldLabel tone="muted">Dữ liệu (JSON)</FieldLabel>
            <pre style={{ background: 'var(--bg-soft)', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
              {detail.detail ? JSON.stringify(JSON.parse(detail.detail), null, 2) : '—'}
            </pre>
          </div>
        </Modal>
      )}
    </div>
  );
}