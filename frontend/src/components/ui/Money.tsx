import type { ReactNode } from 'react';

interface MoneyProps {
  value: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'in' | 'out' | 'debt' | 'primary' | 'default' | 'faint';
  showSign?: boolean;
}

// Hiển thị tiền tệ với màu phân biệt ngữ nghĩa
export default function Money({ value, className = '', size = 'md', color = 'default', showSign = false }: MoneyProps) {
  const fmt = new Intl.NumberFormat('vi-VN').format(Math.round(value || 0));
  const sign = showSign ? (value >= 0 ? '+ ' : '- ') : '';
  const cls = [
    className,
    size === 'lg' ? 'money-lg' : '',
    size === 'sm' ? 'money-sm' : '',
    color === 'in' ? 'money-in' : '',
    color === 'out' ? 'money-out' : '',
    color === 'debt' ? 'money-debt' : '',
    color === 'primary' ? 'money-primary' : '',
    color === 'faint' ? 'money-faint' : ''
  ]
    .filter(Boolean)
    .join(' ');
  return <span className={cls}>{sign}{fmt}đ</span>;
}

// Wrapper cho nhãn kèm icon
export function LabelWithIcon({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="field-label-pill">
      <span>{icon}</span>
      {children}
    </span>
  );
}