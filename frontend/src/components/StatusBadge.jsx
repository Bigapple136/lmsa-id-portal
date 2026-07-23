const STATUS_META = {
  confirmed: { label: 'Confirmed', tone: 'green' },
  approved: { label: 'Approved', tone: 'green' },
  pending: { label: 'Pending', tone: 'gray' },
  issue: { label: 'Issue', tone: 'amber' },
  photo_issue: { label: 'Photo issue', tone: 'photo' },
  self_corrected: { label: 'Self-corrected', tone: 'blue' },
  rejected: { label: 'Rejected', tone: 'amber' },
}

export default function StatusBadge({ status, label }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', tone: 'gray' }
  return <span className={`pill pill-${meta.tone}`}>{label || meta.label}</span>
}

