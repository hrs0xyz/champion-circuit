import { Outlet, useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../components/ui/Sidebar';
import { useAuth } from '../context/AuthContext';

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <header className="admin-topbar">
          <p className="admin-topbar__user">{user?.email ?? 'Admin'}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              signOut();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
