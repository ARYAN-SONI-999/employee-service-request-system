import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SD</span>
          <span className="brand-name">ServiceDesk</span>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
          {(user.role === 'employee' || user.role === 'admin') && (
            <NavLink to="/new-request" className={({ isActive }) => (isActive ? 'active' : '')}>New Request</NavLink>
          )}
          <NavLink to="/requests" className={({ isActive }) => (isActive ? 'active' : '')}>
            {user.role === 'employee' ? 'My Requests' : 'Requests Queue'}
          </NavLink>
          {user.role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>Manage Users</NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{user.name.charAt(0)}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role}{user.department ? ` · ${user.department}` : ''}</div>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
