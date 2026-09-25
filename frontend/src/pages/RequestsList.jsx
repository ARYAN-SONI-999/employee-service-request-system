import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, SlaBadge } from '../components/Badges';

const STATUSES = ['', 'open', 'in_progress', 'resolved', 'closed', 'cancelled'];

export default function RequestsList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    requestsApi
      .list(status ? { status } : {})
      .then((res) => setRequests(res.data.requests))
      .catch(() => setError('Could not load requests.'))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div>
      <header className="page-header page-header-row">
        <div>
          <h1>{user.role === 'employee' ? 'My requests' : 'Requests queue'}</h1>
          <p className="muted">
            {user.role === 'agent' && `Showing ${user.department} department requests.`}
            {user.role === 'admin' && 'Showing every request across the organization.'}
            {user.role === 'employee' && 'Requests you have raised, and their current status.'}
          </p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-select">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>
          ))}
        </select>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="page-loading">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">No requests found.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                {user.role !== 'employee' && <th>Employee</th>}
                <th>Priority</th>
                <th>Status</th>
                <th>SLA due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td className="title-cell">{r.title}</td>
                  <td>{r.category}</td>
                  {user.role !== 'employee' && <td>{r.employee_name}</td>}
                  <td><PriorityBadge priority={r.priority} /></td>
                  <td><StatusBadge status={r.status} /> <SlaBadge breached={r.sla_breached} /></td>
                  <td>{r.sla_due_at ? new Date(r.sla_due_at).toLocaleString() : '—'}</td>
                  <td><Link className="link" to={`/requests/${r.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
