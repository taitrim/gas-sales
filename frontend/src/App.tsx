import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Imports from './pages/Imports';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Finance from './pages/Finance';
import Pos from './pages/Pos';
import Expenses from './pages/Expenses';
import Cash from './pages/Cash';
import Stores from './pages/Stores';
import Users from './pages/Users';
import ImportData from './pages/ImportData';
import Settings from './pages/Settings';
import Debts from './pages/Debts';
import Returns from './pages/Returns';
import Promotions from './pages/Promotions';
import StockAdjustments from './pages/StockAdjustments';
import StockTransfers from './pages/StockTransfers';
import Audit from './pages/Audit';
import Backup from './pages/Backup';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<Pos />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/products" element={<Products />} />
        <Route path="/imports" element={<Imports />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/stock-adjustments" element={<StockAdjustments />} />
        <Route path="/stock-transfers" element={<StockTransfers />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/cash" element={<Cash />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/users" element={<Users />} />
        <Route path="/import-data" element={<ImportData />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}