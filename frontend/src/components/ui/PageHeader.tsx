import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  sub?: string;
  actions?: ReactNode;
}

// Tiêu đề trang chuẩn (desktop + mobile)
export default function PageHeader({ title, sub, actions }: PageHeaderProps) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}