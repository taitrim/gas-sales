interface BadgeProps {
  children: React.ReactNode;
  tone?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple' | 'amber';
  className?: string;
}

// Badge trạng thái có dấu chấm màu
export default function Badge({ children, tone = 'gray', className = '' }: BadgeProps) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>;
}