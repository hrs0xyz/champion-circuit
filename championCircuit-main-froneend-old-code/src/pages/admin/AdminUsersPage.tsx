export function AdminUsersPage() {
  return (
    <div className="admin-page">
      <h1>Users &amp; teams</h1>
      <p className="muted">
        Full user/team admin (edit IGN, reassign leaders, delete players) requires backend APIs. This panel is reserved
        for that integration. No user data is exposed here in the local prototype.
      </p>
    </div>
  );
}
