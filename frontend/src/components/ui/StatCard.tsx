import type { ReactNode } from 'react';

interface StatCardProps {
  icon: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate';
}

// Thẻ thống kê tái sử dụng (Dashboard, Reports, Finance, Debts...)
export default function StatCard({ icon, label, value, sub, tone = 'blue' }: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  );
}