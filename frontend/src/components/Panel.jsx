import { useId } from 'react'

export default function Panel({
  icon,
  title,
  right,
  children,
  collapsible,
  open = true,
  onToggle,
}) {
  const panelId = useId()
  const clickable = collapsible && !!onToggle
  const Head = clickable ? 'button' : 'div'
  const bodyId = `${panelId}-body`

  return (
    <section className="panel">
      <Head
        type={clickable ? 'button' : undefined}
        className={`panel-head${clickable ? ' panel-head--btn' : ''}`}
        onClick={clickable ? onToggle : undefined}
        aria-expanded={clickable ? open : undefined}
        aria-controls={clickable ? bodyId : undefined}
      >
        {icon && (
          <span className="panel-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="panel-title">{title}</span>
        {right}
        {clickable && (
          <span className={`panel-chevron${open ? ' open' : ''}`} aria-hidden="true">
            ▾
          </span>
        )}
      </Head>
      {(!collapsible || open) && (
        <div id={bodyId} className="panel-body">
          {children}
        </div>
      )}
    </section>
  )
}
