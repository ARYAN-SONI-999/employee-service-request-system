import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestsApi } from '../api/client';

const CATEGORIES = ['IT', 'HR', 'Facility'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export default function NewRequest() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ category: 'IT', title: '', description: '', priority: 'medium' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await requestsApi.create(form);
      navigate(`/requests/${data.request.id}`);
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details ? details.map((d) => d.message).join(' ') : err.response?.data?.error || 'Could not submit request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>Raise a new request</h1>
        <p className="muted">Tell us what's going on — the right team will pick it up based on category and priority.</p>
      </header>

      <div className="card card-form">
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="alert alert-error">{error}</div>}

          <label>
            Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label>
            Title
            <input
              required
              minLength={5}
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Short summary, e.g. 'Laptop will not boot'"
            />
          </label>

          <label>
            Description
            <textarea
              required
              minLength={10}
              rows={6}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What happened, when it started, and anything you've already tried."
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  );
}
