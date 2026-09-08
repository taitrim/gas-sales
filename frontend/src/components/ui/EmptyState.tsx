interface EmptyStateProps {
  icon?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}

// Trạng thái rỗng đẹp, tái sử dụng mọi trang
export default function EmptyState({ icon = '📭', title, sub, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="es-icon">{icon}</div>
      <div className="es-title">{title}</div>
      {sub && <div className="es-sub">{sub}</div>}
      {action && <div className="es-action">{action}</div>}
    </div>
  );
}