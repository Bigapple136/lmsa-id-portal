// Single source of truth for the dashboard's primary navigation. Previously
// this array and its markup were duplicated verbatim between the sidebar and
// the mobile tab strip, so every change had to be made twice.
export const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'upload', label: 'Upload' },
  { id: 'layout', label: 'Layout' },
  { id: 'students', label: 'Students' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'settings', label: 'Settings' },
]

// Links out to sibling admin routes. These are navigation, not tabs, so they
// are rendered as links rather than given tab semantics.
const ADMIN_LINKS = [
  { to: '/admin/admins', label: 'Admins', adminOnly: true },
  { to: '/admin/qr-keys', label: 'QR Keys', adminOnly: false },
]

export function AdminNav({ tabs, activeTab, onSelect, userRole, onNavigate }) {
  const links = ADMIN_LINKS.filter((l) => !l.adminOnly || userRole === 'admin')

  // Roving arrow-key movement between tabs, per the WAI-ARIA tabs pattern.
  const onKeyDown = (e, index) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + tabs.length) % tabs.length
    onSelect(tabs[next].id)
    e.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  const renderTabs = (className) =>
    tabs.map((tab, i) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        id={`${className}-tab-${tab.id}`}
        aria-selected={activeTab === tab.id}
        aria-controls="admin-tabpanel"
        tabIndex={activeTab === tab.id ? 0 : -1}
        className={`${className} ${activeTab === tab.id ? 'active' : ''}`}
        onClick={() => onSelect(tab.id)}
        onKeyDown={(e) => onKeyDown(e, i)}
      >
        {className === 'admin-sidebar-item' ? (
          <span className="admin-sidebar-label">{tab.label}</span>
        ) : (
          tab.label
        )}
      </button>
    ))

  return (
    <>
      <aside className="admin-sidebar">
        <nav className="admin-sidebar-nav" aria-label="Dashboard sections">
          <div role="tablist" aria-orientation="vertical" aria-label="Dashboard sections">
            {renderTabs('admin-sidebar-item')}
          </div>
          {links.map((l) => (
            <button
              key={l.to}
              type="button"
              className="admin-sidebar-item"
              onClick={() => onNavigate(l.to)}
            >
              <span className="admin-sidebar-label">{l.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="admin-tabs">
        <div role="tablist" aria-label="Dashboard sections" className="admin-tabs-list">
          {renderTabs('admin-tab')}
        </div>
        {links.map((l) => (
          <button
            key={l.to}
            type="button"
            className="admin-tab"
            onClick={() => onNavigate(l.to)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </>
  )
}

export default AdminNav
