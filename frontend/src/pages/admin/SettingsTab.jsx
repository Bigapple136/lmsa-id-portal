import ActivityLogSection from './ActivityLogSection'
import { FIELD_META } from './constants'
import FieldToggleGroup from '../../components/FieldToggleGroup'
import RenewCohortSection from './RenewCohortSection'
import SettingsCard from '../../components/SettingsCard'
import { adminFetch } from '../../lib/api'
import { useDashboard } from './DashboardContext'

export default function SettingsTab() {
  const {
    downloading,
    fields,
    fieldsMsg,
    fieldsSaving,
    handleToggleSubmissionForm,
    qrFields,
    qrFieldsMsg,
    qrFieldsSaving,
    saveFields,
    saveQrFields,
    setDownloading,
    setSubmissionMsg,
    settingsActive,
    submissionFormEnabled,
    toast,
    toggleField,
    toggleQrField,
    userRole,
  } = useDashboard()

  return (
  <div className="settings-view">
              {(() => {
                const sections = [
                  { id: 'fields', label: 'Card Fields' },
                  { id: 'qr', label: 'QR Code' },
                  { id: 'form', label: 'Form' },
                  ...(userRole === 'admin'
                    ? [
                        { id: 'lifecycle', label: 'Lifecycle' },
                        { id: 'activity', label: 'Activity' },
                        { id: 'system', label: 'System' },
                      ]
                    : []),
                ]
                const go = (id) => {
                  const el = document.getElementById(id)
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                return (
                  <div className="settings-nav">
                    {sections.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`settings-nav-pill${settingsActive === s.id ? ' active' : ''}`}
                        onClick={() => go(s.id)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )
              })()}
  
              <SettingsCard
                id="fields"
                icon="🗂️"
                title="Card field settings"
                badge="Template config"
                desc="Toggle which fields appear on the ID card. This also controls the columns in the downloadable Excel template and the structure of the image folder."
              >
                {fields ? (
                  <FieldToggleGroup
                    items={Object.entries(FIELD_META).map(([key, meta]) => ({
                      key,
                      label: meta.label,
                      enabled: !!fields[key]?.enabled,
                      locked: meta.locked,
                    }))}
                    onToggle={toggleField}
                    footer={
                      <>
                        <button
                          className="btn-gold"
                          onClick={saveFields}
                          disabled={fieldsSaving}
                          style={{ padding: '7px 16px', fontSize: '13px' }}
                        >
                          {fieldsSaving ? 'Saving...' : 'Save field settings'}
                        </button>
                        {fieldsMsg && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: fieldsMsg.ok ? 'var(--success-text)' : 'var(--error-text)',
                            }}
                          >
                            {fieldsMsg.text}
                          </span>
                        )}
                      </>
                    }
                  />
                ) : (
                  <div className="skeleton skeleton-card" />
                )}
              </SettingsCard>
  
              <SettingsCard
                id="qr"
                icon="🔳"
                title="QR code fields"
                badge="QR"
                desc="Toggle which extra fields are encoded into the QR code. Enabled fields are included in the QR payload and appear on the QR verification page."
              >
                {qrFields ? (
                  <FieldToggleGroup
                    items={Object.entries(qrFields).map(([key, meta]) => ({
                      key,
                      label: meta.label,
                      enabled: !!meta.enabled,
                    }))}
                    onToggle={toggleQrField}
                    footer={
                      <>
                        <button
                          className="btn-gold"
                          onClick={saveQrFields}
                          disabled={qrFieldsSaving}
                          style={{ padding: '7px 16px', fontSize: '13px' }}
                        >
                          {qrFieldsSaving ? 'Saving...' : 'Save QR fields'}
                        </button>
                        {qrFieldsMsg && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: qrFieldsMsg.ok ? 'var(--success-text)' : 'var(--error-text)',
                            }}
                          >
                            {qrFieldsMsg.text}
                          </span>
                        )}
                      </>
                    }
                  />
                ) : (
                  <div className="skeleton skeleton-card" />
                )}
              </SettingsCard>
  
              <SettingsCard
                id="form"
                icon="📝"
                title="Submission form status"
                desc="Control whether students can submit their details through the public form."
              >
                <div
                  style={{
                    background: 'var(--white)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>Form Status</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        {submissionFormEnabled
                          ? 'Students can submit their details'
                          : 'Form is closed to submissions'}
                      </div>
                    </div>
                    <button
                      className={`btn-${submissionFormEnabled ? 'outline' : 'gold'}`}
                      onClick={handleToggleSubmissionForm}
                      style={{ fontSize: '12px', padding: '7px 14px' }}
                    >
                      {submissionFormEnabled ? 'Disable Form' : 'Enable Form'}
                    </button>
                  </div>
                  {submissionFormEnabled && (
                    <div
                      style={{
                        background: 'var(--bg)',
                        borderRadius: 'var(--radius)',
                        padding: '10px 12px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>
                        Share this link with students:
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <code
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: 'var(--white)',
                            border: '0.5px solid var(--border)',
                            borderRadius: '4px',
                            fontSize: '12px',
                            wordBreak: 'break-all',
                          }}
                        >
                          {window.location.origin}/submit
                        </code>
                        <button
                          className="btn-gold"
                          style={{ fontSize: '11px', padding: '5px 10px', whiteSpace: 'nowrap' }}
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/submit`)
                            setSubmissionMsg({ ok: true, text: 'Link copied!' })
                            setTimeout(() => setSubmissionMsg(null), 2000)
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </SettingsCard>
  
              {userRole === 'admin' && (
                <SettingsCard
                  id="lifecycle"
                  icon="🔄"
                  title="Card expiry / renewal"
                  admin
                  desc="Renew all cards for a given year level by setting a new expiry date. Confirmation status is left untouched; students still confirm their own card individually."
                >
                  <RenewCohortSection userRole={userRole} />
                </SettingsCard>
              )}
  
              {userRole === 'admin' && (
                <SettingsCard id="activity" icon="📊" title="Recent admin activity" admin>
                  <ActivityLogSection />
                </SettingsCard>
              )}
  
              {userRole === 'admin' && (
                <SettingsCard
                  id="system"
                  icon="💾"
                  title="System backup"
                  admin
                  desc="Download a full backup of all database records and uploaded files (photos, signatures, QR codes, templates). The backup is delivered as a ZIP file."
                >
                  <button
                    className="btn-gold"
                    onClick={async () => {
                      try {
                        setDownloading((prev) => ({ ...prev, backup: true }))
                        const res = await adminFetch('/api/backup')
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}))
                          toast.error(body.error || 'Backup failed.')
                          return
                        }
                        const blob = await res.blob()
                        const disposition = res.headers.get('Content-Disposition') || ''
                        const match = disposition.match(/filename="?(.+?)"?$/)
                        const filename = match ? match[1] : 'lmsa-backup.zip'
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = filename
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        URL.revokeObjectURL(url)
                      } catch {
                        toast.error('Backup failed. Please try again.')
                      } finally {
                        setDownloading((prev) => ({ ...prev, backup: false }))
                      }
                    }}
                    disabled={downloading.backup}
                    style={{ fontSize: '13px', padding: '9px 18px' }}
                  >
                    {downloading.backup ? 'Generating backup...' : 'Download Full Backup'}
                  </button>
                </SettingsCard>
              )}
            </div>
  )
}
