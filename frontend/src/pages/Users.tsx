import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { PermissionDef, User } from '../types';
import { fmtDateTime } from '../format';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { usePaginatedList } from '../hooks/usePaginatedList';
import Select from '../components/ui/Select';
import FieldLabel from '../components/ui/FieldLabel';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth';

export default function Users() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [deleting, setDeleting] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [role, setRole] = useState('staff');
  const [storeId, setStoreId] = useState('');
  const [fullName, setFullName] = useState('');
  const [permUser, setPermUser] = useState<User | null>(null);
  const [permDefs, setPermDefs] = useState<PermissionDef[]>([]);
  const [permSel, setPermSel] = useState<Set<string>>(new Set());
  const [savingPerm, setSavingPerm] = useState(false);

  const loadPermDefs = useCallback(() => {
    api
      .getPermissionsList()
      .then(setPermDefs)
      .catch(() => {});
  }, []);

  useEffect(loadPermDefs, [loadPermDefs]);

  function openPerms(u: User) {
    setPermUser(u);
    setPermSel(new Set(u.permissions || []));
  }

  function togglePerm(key: string) {
    setPermSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSavePerms() {
    if (!permUser) return;
    setSavingPerm(true);
    try {
      await api.saveUserPermissions(permUser.id, Array.from(permSel));
      toast(`Đã lưu quyền cho ${permUser.username}.`);
      setPermUser(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSavingPerm(false);
    }
  }

  const {
    items: users,
    total,
    page,
    setPage,
    search,
    setSearch,
    loading,
    reload
  } = usePaginatedList<User>({
    fetcher: (p) => api.listUsers({ page: p.page, pageSize: p.pageSize, search: p.search })
  });

  async function toggleApprove(u: User) {
    try {
      await api.approveUser(u.id, !u.approve);
      toast(u.approve ? `Đã gỡ duyệt ${u.username}` : `Đã duyệt ${u.username}`);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function openEdit(u: User) {
    setEditing(u);
    setRole(u.role);
    setStoreId(u.storeId || '');
    setFullName(u.fullName || '');
  }

  async function handleEdit() {
    if (!editing) return;
    try {
      await api.updateUser({ id: editing.id, role, storeId, fullName });
      toast('Đã cập nhật người dùng.');
      setEditing(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleReset() {
    if (!resetting || newPassword.length < 4) {
      toast('Mật khẩu mới phải có ít nhất 4 ký tự.', 'err');
      return;
    }
    try {
      await api.resetPassword(resetting.id, newPassword);
      toast('Đã đặt lại mật khẩu.');
      setResetting(null);
      setNewPassword('');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteUser(deleting.id);
      toast('Đã xóa người dùng.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Người dùng</h1>
      </div>

      <div className="orders-toolbar">
        <div className="ot-row ot-search">
          <input
            type="search"
            placeholder="Tìm tên đăng nhập, họ tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted toolbar-count">{total} người dùng</span>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : users.length === 0 ? (
        <div className="empty">Không có người dùng nào.</div>
      ) : (
        <>
          <div className="order-cards">
            {users.map((u) => (
              <div className="order-card" key={u.id}>
                <div className="oc-top">
                  <div className="oc-id">{u.username}</div>
                  <div className="oc-badges">
                    <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Nhân viên'}
                    </span>
                    <button
                      className={`badge ${u.approve ? 'badge-green' : 'badge-yellow'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => toggleApprove(u)}
                      disabled={u.id === me?.id}
                    >
                      {u.approve ? 'Đã duyệt' : 'Chờ duyệt'}
                    </button>
                  </div>
                </div>

                <div className="oc-body">
                  <div className="oc-customer">
                    <div className="oc-avatar oc-avatar-flat">👤</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="oc-cust-name">{u.fullName || u.username}</div>
                      <div className="oc-cust-phone">{u.storeId ? `Cửa hàng: ${u.storeId}` : 'Chưa gán cửa hàng'}</div>
                    </div>
                  </div>

                  <div className="oc-meta">
                    <div className="oc-cell">
                      <span className="ic">📅</span>
                      <span>
                        Tạo lúc: <b>{fmtDateTime(u.createdAt)}</b>
                      </span>
                    </div>
                  </div>

                  {u.id === me?.id && (
                    <div className="oc-total">
                      <span className="oc-total-label">Bạn</span>
                      <span className="oc-total-val" style={{ color: 'var(--primary)' }}>👤</span>
                    </div>
                  )}
                </div>

                <div className="oc-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-link" onClick={() => openEdit(u)}>
                    Sửa
                  </button>
                  <button className="btn-link" onClick={() => setResetting(u)}>
                    Đặt lại MK
                  </button>
                  <button className="btn-link" onClick={() => openPerms(u)}>
                    Phân quyền
                  </button>
                  <button
                    className="btn-link danger"
                    onClick={() => setDeleting(u)}
                    disabled={u.id === me?.id}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
        </>
      )}

      {editing && (
        <Modal
          title="Sửa người dùng"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleEdit}>
                Lưu
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">👤</span>
                Thông tin tài khoản
              </div>
              <div className="form-section-body">
                <div className="field">
                  <FieldLabel tone="primary" req>
                    Họ tên
                  </FieldLabel>
                  <input className="field-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="field">
                  <FieldLabel tone="violet">Vai trò</FieldLabel>
                  <Select
                    value={role}
                    options={[
                      { value: 'staff', label: 'Nhân viên' },
                      { value: 'admin', label: 'Admin' }
                    ]}
                    onChange={(v) => setRole(v)}
                  />
                </div>
                <div className="field">
                  <FieldLabel tone="muted">ID cửa hàng</FieldLabel>
                  <input className="field-input" value={storeId} onChange={(e) => setStoreId(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {resetting && (
        <Modal
          title={`Đặt lại mật khẩu — ${resetting.username}`}
          onClose={() => setResetting(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setResetting(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleReset}>
                Đặt lại
              </button>
            </>
          }
        >
          <div className="form-stack form-stack-single">
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-section-ic">🔑</span>
                Mật khẩu mới
              </div>
              <div className="form-section-body">
                <div className="field full">
                  <FieldLabel tone="danger" req>Mật khẩu mới</FieldLabel>
                  <input
                    className="field-input"
                    type="password"
                    placeholder="Nhập mật khẩu (tối thiểu 4 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {permUser && (
        <Modal
          title={`Phân quyền — ${permUser.username}`}
          onClose={() => setPermUser(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setPermUser(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleSavePerms} disabled={savingPerm}>
                {savingPerm ? 'Đang lưu...' : 'Lưu quyền'}
              </button>
            </>
          }
        >
          {permUser.role === 'admin' ? (
            <div className="muted">Quản trị viên luôn có toàn quyền, không cần phân quyền.</div>
          ) : (
            <div className="perm-grid">
              {permDefs.map((p) => (
                <label key={p.key} className="perm-item">
                  <input
                    type="checkbox"
                    checked={permSel.has(p.key)}
                    onChange={() => togglePerm(p.key)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          )}
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa người dùng"
          message={`Bạn có chắc muốn xóa người dùng "${deleting.username}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}