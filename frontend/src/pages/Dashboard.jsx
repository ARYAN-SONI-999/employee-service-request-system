import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { dashboardApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  open: '#f59e0b',
  in_progress: '#3b82f6',
  resolved: '#10b981',
  closed: '#64748b',
  cancelled: '#94a3b8',
};
const CATEGORY_COLORS = { IT: '#6366f1', HR: '#ec4899', Facility: '#14b8a6' };

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .summary()
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load dashboard data.'));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="page-loading">Loading dashboard…</div>;

  const totalOpenish = data.byStatus
    .filter((s) => !['closed', 'cancelled'].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);
  const totalAll = data.byStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <header className="page-header">
        <h1>Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="muted">
          {user.role === 'admin' && 'Organization-wide service request overview.'}
          {user.role === 'agent' && `${user.department} department queue overview.`}
          {user.role === 'employee' && 'Overview of the requests you have raised.'}
        </p>
      </header>

      <section className="stat-grid">
        <StatCard label="Active requests" value={totalOpenish} tone="info" />
        <StatCard label="Total requests" value={totalAll} tone="neutral" />
        <StatCard label="SLA breached" value={data.slaBreached} tone={data.slaBreached > 0 ? 'danger' : 'success'} />
        <StatCard label="Avg. resolution (hrs)" value={data.avgResolutionHours ?? '—'} tone="neutral" />
      </section>

      <section className="chart-grid">
        <div className="card">
          <h3>By status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.byStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.byStatus.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#cbd5e1'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>By category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byCategory}>
              <XAxis dataKey="category" stroke="#94a3b8" />
              <YAxis allowDecimals={false} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.byCategory.map((entry) => (
                  <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>By priority</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byPriority} layout="vertical">
              <XAxis type="number" allowDecimals={false} stroke="#94a3b8" />
              <YAxis type="category" dataKey="priority" stroke="#94a3b8" width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
