import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api, ApiError } from '../api';
import FieldLabel from '../components/ui/FieldLabel';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    if (user) navigate('/', { replace: true });
    api
      .checkSystemStatus()
      .then((s) => setHasAdmin(s.hasAdmin))
      .catch(() => setHasAdmin(true));
    api.getStoreInfo().then((info) => setStoreName(info['storeName'] || '')).catch(() => {});
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (!hasAdmin) {
        await api.register({
          username,
          password,
          fullName: fullName || 'Quản trị viên',
          isAdminSetup: true
        });
      }
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">G</div>
        <h1>{storeName || 'GAS Sales Pro'}</h1>
        <div className="sub">
          {hasAdmin === false
            ? 'Chưa có tài khoản quản trị. Hãy tạo tài khoản admin đầu tiên.'
            : 'Đăng nhập để quản lý bán hàng'}
        </div>
        {error && <div className="error-banner">{error}</div>}
        {hasAdmin === false && (
          <div className="field mb">
            <FieldLabel tone="primary">Họ tên</FieldLabel>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tên quản trị viên"
            />
          </div>
        )}
        <div className="field mb">
          <FieldLabel tone="info">Tên đăng nhập</FieldLabel>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            required
          />
        </div>
        <div className="field mb">
          <FieldLabel tone="danger">Mật khẩu</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Đang xử lý...' : hasAdmin === false ? 'Tạo tài khoản & đăng nhập' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}