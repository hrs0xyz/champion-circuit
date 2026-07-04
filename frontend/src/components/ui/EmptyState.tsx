type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state__title">{title}</p>
      {description ? <p className="muted small">{description}</p> : null}
    </div>
  );
}
