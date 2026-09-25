import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, SlaBadge } from '../components/Badges';

const NEXT_STATUS = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['resolved', 'open', 'cancelled'],
  resolved: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ request: null, comments: [], audit: [] });
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = user.role === 'admin' || (user.role === 'agent' && state.request?.category === user.department);

  const load = useCallback(() => {
    requestsApi
      .get(id)
      .then((res) => setState(res.data))
      .catch(() => setError('Could not load this request.'));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(nextStatus) {
    setBusy(true);
    setError('');
    try {
      await requestsApi.update(id, { status: nextStatus });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status.');
    } finally {
      setBusy(false);
    }
  }

  async function takeRequest() {
    setBusy(true);
    try {
      await requestsApi.update(id, { assigned_agent_id: user.id });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not assign request.');
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await requestsApi.addComment(id, comment.trim());
      setComment('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not post comment.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !state.request) return <div className="alert alert-error">{error}</div>;
  if (!state.request) return <div className="page-loading">Loading…</div>;

  const r = state.request;
  const nextOptions = NEXT_STATUS[r.status] || [];

  return (
    <div>
      <Link to="/requests" className="link back-link">&larr; Back to list</Link>

      <header className="page-header page-header-row">
        <div>
          <h1>{r.title} <span className="muted">#{r.id}</span></h1>
          <p className="muted">
            {r.category} · raised by {r.employee_name} on {new Date(r.created_at).toLocaleString()}
          </p>
        </div>
        <div className="badge-row">
          <PriorityBadge priority={r.priority} />
          <StatusBadge status={r.status} />
          <SlaBadge breached={r.sla_breached} />
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-grid">
        <div className="card">
          <h3>Description</h3>
          <p className="description-text">{r.description}</p>
          <dl className="meta-list">
            <div><dt>Assigned agent</dt><dd>{r.agent_name || 'Unassigned'}</dd></div>
            <div><dt>SLA due</dt><dd>{r.sla_due_at ? new Date(r.sla_due_at).toLocaleString() : '—'}</dd></div>
            <div><dt>Last updated</dt><dd>{new Date(r.updated_at).toLocaleString()}</dd></div>
            {r.resolved_at && <div><dt>Resolved at</dt><dd>{new Date(r.resolved_at).toLocaleString()}</dd></div>}
          </dl>

          {canManage && (
            <div className="action-row">
              {!r.assigned_agent_id && user.role === 'agent' && (
                <button className="btn btn-secondary" disabled={busy} onClick={takeRequest}>Take this request</button>
              )}
              {nextOptions.map((s) => (
                <button key={s} className="btn btn-primary" disabled={busy} onClick={() => updateStatus(s)}>
                  Mark {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Activity &amp; comments</h3>
          <ul className="comment-list">
            {state.comments.map((c) => (
              <li key={c.id}>
                <div className="comment-meta"><strong>{c.author_name}</strong> ({c.author_role}) · {new Date(c.created_at).toLocaleString()}</div>
                <div>{c.body}</div>
              </li>
            ))}
            {state.comments.length === 0 && <li className="muted">No comments yet.</li>}
          </ul>

          <form onSubmit={submitComment} className="comment-form">
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" />
            <button type="submit" className="btn btn-secondary" disabled={busy || !comment.trim()}>Post comment</button>
          </form>

          <h4 className="audit-heading">Audit trail</h4>
          <ul className="audit-list">
            {state.audit.map((a) => (
              <li key={a.id}>
                <span className="audit-action">{a.action}</span>
                <span className="muted"> — {a.actor_name || 'system'} · {new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
