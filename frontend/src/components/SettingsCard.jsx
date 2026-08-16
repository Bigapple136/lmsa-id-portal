export default function SettingsCard({ id, icon, title, badge, desc, admin, children }) {
  return (
    <section id={id} className={`settings-card${admin ? ' settings-card--admin' : ''}`}>
      <header className="settings-card-head">
        {icon && <span className="settings-card-icon" aria-hidden="true">{icon}</span>}
        <div className="settings-card-headtext">
          <div className="settings-card-title">
            {title}
            {badge && <span className="settings-card-badge">{badge}</span>}
          </div>
          {desc && <p className="settings-card-desc">{desc}</p>}
        </div>
      </header>
      <div className="settings-card-body">{children}</div>
    </section>
  )
}
