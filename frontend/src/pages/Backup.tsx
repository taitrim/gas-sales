import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { BackupFile } from '../types';
import { fmtBytes, fmtDateTime } from '../format';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

export default function Backup() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<BackupFile | null>(null);
  const [deleting, setDeleting] = useState<BackupFile | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listBackups()
      .then(setBackups)
      .catch((err) => toast((err as Error).message, 'err'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(load, [load]);

  async function handleCreate() {
    setCreating(true);
    try {
      const bk = await api.backupDatabase();
      toast(`Đã tạo backup "${bk.fileName}".`);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore() {
    if (!restoring) return;
    try {
      const ok = window.confirm(
        `Khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại bằng "${restoring.fileName}". Bạn chắc chắn chứ?`
      );
      if (!ok) {
        setRestoring(null);
        return;
      }
      await api.restoreDatabase(restoring.fileName);
      toast('Đã khôi phục dữ liệu thành công.');
      setRestoring(null);
    } catch (err) {
      toast((err as Error).message, 'err');
      setRestoring(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteBackup(deleting.fileName);
      toast('Đã xóa file backup.');
      setDeleting(null);
      load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function handleDownload(b: BackupFile) {
    const token = localStorage.getItem('gas_sales_token');
    const url = `/api/backup/download/${encodeURIComponent(b.fileName)}`;
    if (token) {
      window.open(url + '?token=' + encodeURIComponent(token), '_blank');
    } else {
      window.open(url, '_blank');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Sao lưu dữ liệu</h1>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Đang sao lưu...' : '📦 Sao lưu ngay'}
        </button>
      </div>

      <div className="toolbar">
        <span className="muted">
          Sao lưu toàn bộ cơ sở dữ liệu bằng mysqldump. File lưu tại máy chủ và có thể tải về.
        </span>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : backups.length === 0 ? (
        <div className="empty">Chưa có bản sao lưu nào.</div>
      ) : (
        <div className="order-cards">
          {backups.map((b) => (
            <div className="order-card" key={b.fileName}>
              <div className="oc-top">
                <div className="oc-id" title={b.fileName}>{b.fileName}</div>
                <div className="oc-badges">
                  <span className="badge badge-blue">{fmtBytes(b.size)}</span>
                </div>
              </div>

              <div className="oc-body">
                <div className="oc-customer">
                  <div className="oc-avatar oc-avatar-flat">💾</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="oc-cust-name">{b.fileName}</div>
                    <div className="oc-cust-phone">{fmtDateTime(b.createdAt)}</div>
                  </div>
                </div>

                <div className="oc-total">
                  <span className="oc-total-label">Dung lượng</span>
                  <span className="oc-total-val money-primary">{fmtBytes(b.size)}</span>
                </div>
              </div>

              <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn-link" onClick={() => handleDownload(b)}>
                  Tải về
                </button>
                <button className="btn-link" onClick={() => setRestoring(b)}>
                  Khôi phục
                </button>
                <button className="btn-link danger" onClick={() => setDeleting(b)}>
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {restoring && (
        <ConfirmDialog
          title="Khôi phục dữ liệu"
          message={`Khôi phục từ "${restoring.fileName}"? Toàn bộ dữ liệu hiện tại sẽ bị thay thế.`}
          onConfirm={handleRestore}
          onCancel={() => setRestoring(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa file backup"
          message={`Xóa "${deleting.fileName}"? Hành động này không thể hoàn tác.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}