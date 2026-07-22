export default function Table({ headers, rows, emptyMessage = 'No data found.', className = '' }) {
  if (!rows || rows.length === 0) {
    return <div className="submission-empty" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>{emptyMessage}</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 'var(--font-semibold)', color: 'var(--muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
              onMouseLeave={(e) => e.currentTarget.style.background = ''}
            >
              {headers.map((h, ci) => (
                <td key={ci} style={{ padding: '10px 12px', color: 'var(--text)' }}>
                  {h.render ? h.render(row, ri) : row[h.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
