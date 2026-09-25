import { useEffect, useState } from 'react';
import { usersApi } from '../api/client';

const ROLES = ['employee', 'agent', 'admin'];
const DEPARTMENTS = ['IT', 'HR', 'Facility'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent', department: 'IT' });

  function load() {
    usersApi.list().then((res) => setUsers(res.data.users)).catch(() => setError('Could not load users.'));
  }
  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await usersApi.create({ ...form, department: form.role === 'employee' ? null : form.department });
      setForm({ name: '', email: '', password: '', role: 'agent', department: 'IT' });
      load();
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details ? details.map((d) => d.message).join(' ') : err.response?.data?.error || 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u) {
    await usersApi.setActive(u.id, !u.is_active);
    load();
  }

  return (
    <div>
      <header className="page-header">
        <h1>Manage users</h1>
        <p className="muted">Provision agent and admin accounts, or deactivate access.</p>
      </header>

      <div className="detail-grid">
        <div className="card card-form">
          <h3>Add user</h3>
          <form onSubmit={handleCreate} className="form">
            {error && <div className="alert alert-error">{error}</div>}
            <label>Name <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Email <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Password <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            {form.role !== 'employee' && (
              <label>
                Department
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
          </form>
        </div>

        <div className="card">
          <h3>All users</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.department || '—'}</td>
                    <td>{u.is_active ? <span className="badge badge-status-resolved">Active</span> : <span className="badge badge-status-cancelled">Inactive</span>}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
