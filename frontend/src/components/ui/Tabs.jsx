export default function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`admin-tabs ${className}`} style={{ display: 'flex' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
