const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }) {
  return <span className={`badge badge-status-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function PriorityBadge({ priority }) {
  return <span className={`badge badge-priority-${priority}`}>{priority}</span>;
}

export function SlaBadge({ breached }) {
  if (!breached) return null;
  return <span className="badge badge-breach">SLA breached</span>;
}
