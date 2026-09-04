import { LIBERIA_COUNTIES, YEARS } from './constants'
import { useDashboard } from './DashboardContext'

export default function UploadTab() {
  const {
    activeTemplateBack,
    activeTemplateFront,
    csvFile,
    downloading,
    fields,
    handleCSVUpload,
    handleDownload,
    handleFileZoneKeyDown,
    handleManualAdd,
    handleTemplateUpload,
    manualForm,
    manualMsg,
    manualPhoto,
    manualSig,
    manualSubmitting,
    openFileInput,
    setCsvFile,
    setManualForm,
    setManualMsg,
    setManualPhoto,
    setManualSig,
    setTemplateFileBack,
    setTemplateFileFront,
    setUploadMode,
    setUploadMsg,
    setZipFile,
    templateFileBack,
    templateFileFront,
    uploadMode,
    uploadMsg,
    uploading,
    zipFile,
  } = useDashboard()

  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ── Card: Downloads ── */}
              <div className="chart-card">
                <div className="chart-card-title">Downloads</div>
                <div className="chart-card-sub">
                  Get the pre-configured Excel file to fill in student data, and the pre-built
                  image folder to organise your photos before uploading.
                </div>
                <div className="download-row">
                  <button
                    className="download-btn"
                    onClick={() => handleDownload('download-excel', 'LMSA_Student_Template.xlsx')}
                    disabled={downloading['download-excel']}
                  >
                    <div className="download-icon" aria-hidden="true">📊</div>
                    <div>
                      <div className="download-title">
                        {downloading['download-excel'] ? 'Downloading...' : 'Student data template'}
                      </div>
                      <div className="download-sub">Excel · pre-formatted columns</div>
                    </div>
                  </button>
                  <button
                    className="download-btn"
                    onClick={() =>
                      handleDownload('download-image-folder', 'LMSA_Image_Upload_Folder.zip')
                    }
                    disabled={downloading['download-image-folder']}
                  >
                    <div className="download-icon" aria-hidden="true">📁</div>
                    <div>
                      <div className="download-title">
                        {downloading['download-image-folder']
                          ? 'Downloading...'
                          : 'Image folder package'}
                      </div>
                      <div className="download-sub">ZIP · year subfolders + README</div>
                    </div>
                  </button>
                </div>
              </div>
  
              {/* ── Card: Card Templates ── */}
              <div className="chart-card">
                <div className="chart-card-title">ID Card Templates <span className="new-badge">Front & Back</span></div>
                <div className="chart-card-sub">
                  Upload separate background images for the front and back of the ID card. Each side can have its own design.
                </div>
  
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Front Template */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
                      Front Template
                    </div>
                    {activeTemplateFront ? (
                      <div style={{ marginBottom: '10px' }}>
                        <img
                          src={activeTemplateFront.file_url}
                          alt="Front template"
                          style={{
                            width: '100%',
                            height: '120px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            marginBottom: '8px',
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{activeTemplateFront.file_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>CR-80 · {new Date(activeTemplateFront.uploaded_at).toLocaleDateString()}</div>
                          </div>
                          <span className="pill pill-green">Active</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>No template uploaded</div>
                    )}
                    <div
                      className="upload-zone"
                      role="button"
                      tabIndex={0}
                      aria-label="Choose front card template image"
                      style={{ padding: '12px' }}
                      onClick={() => openFileInput('template-input-front')}
                      onKeyDown={(e) => handleFileZoneKeyDown(e, 'template-input-front')}
                    >
                      <input
                        id="template-input-front"
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        hidden
                        onChange={(e) => {
                          setTemplateFileFront(e.target.files[0])
                          setUploadMsg(null)
                        }}
                      />
                      {templateFileFront ? (
                        <p className="upload-selected" style={{ fontSize: '12px' }}>{templateFileFront.name}</p>
                      ) : (
                        <>
                          <p className="upload-icon" aria-hidden="true" style={{ fontSize: '18px', marginBottom: '4px' }}>⬆</p>
                          <p className="upload-text" style={{ fontSize: '12px' }}>
                            Drop or <span className="upload-link">browse</span>
                          </p>
                          <p className="upload-hint" style={{ fontSize: '10px' }}>PNG/JPG · 1012×638 px</p>
                        </>
                      )}
                    </div>
                    {templateFileFront && (
                      <button className="btn-gold-full" onClick={() => handleTemplateUpload('front')} disabled={uploading} style={{ marginTop: '8px', width: '100%', fontSize: '12px', padding: '8px' }}>
                        {uploading ? 'Uploading...' : 'Upload Front'}
                      </button>
                    )}
                  </div>
  
                  {/* Back Template */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
                      Back Template
                    </div>
                    {activeTemplateBack ? (
                      <div style={{ marginBottom: '10px' }}>
                        <img
                          src={activeTemplateBack.file_url}
                          alt="Back template"
                          style={{
                            width: '100%',
                            height: '120px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            marginBottom: '8px',
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{activeTemplateBack.file_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>CR-80 · {new Date(activeTemplateBack.uploaded_at).toLocaleDateString()}</div>
                          </div>
                          <span className="pill pill-green">Active</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>No template uploaded</div>
                    )}
                    <div
                      className="upload-zone"
                      role="button"
                      tabIndex={0}
                      aria-label="Choose back card template image"
                      style={{ padding: '12px' }}
                      onClick={() => openFileInput('template-input-back')}
                      onKeyDown={(e) => handleFileZoneKeyDown(e, 'template-input-back')}
                    >
                      <input
                        id="template-input-back"
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        hidden
                        onChange={(e) => {
                          setTemplateFileBack(e.target.files[0])
                          setUploadMsg(null)
                        }}
                      />
                      {templateFileBack ? (
                        <p className="upload-selected" style={{ fontSize: '12px' }}>{templateFileBack.name}</p>
                      ) : (
                        <>
                          <p className="upload-icon" aria-hidden="true" style={{ fontSize: '18px', marginBottom: '4px' }}>⬆</p>
                          <p className="upload-text" style={{ fontSize: '12px' }}>
                            Drop or <span className="upload-link">browse</span>
                          </p>
                          <p className="upload-hint" style={{ fontSize: '10px' }}>PNG/JPG · 1012×638 px</p>
                        </>
                      )}
                    </div>
                    {templateFileBack && (
                      <button className="btn-gold-full" onClick={() => handleTemplateUpload('back')} disabled={uploading} style={{ marginTop: '8px', width: '100%', fontSize: '12px', padding: '8px' }}>
                        {uploading ? 'Uploading...' : 'Upload Back'}
                      </button>
                    )}
                  </div>
                </div>
  
                {uploadMsg && (
                  <div
                    className={uploadMsg.ok ? 'success-box' : 'error-box'}
                    style={{ marginTop: '12px' }}
                  >
                    {uploadMsg.text}
                  </div>
                )}
              </div>
  
              {/* ── Card: Add Students ── */}
              <div className="chart-card">
                <div className="chart-card-title">Add Students</div>
                <div className="chart-card-sub">
                  Upload a CSV batch or add students one at a time.
                </div>
              <div className="mode-toggle">
                <button
                  className={`mode-btn ${uploadMode === 'csv' ? 'active' : ''}`}
                  onClick={() => {
                    setUploadMode('csv')
                    setUploadMsg(null)
                  }}
                >
                  CSV batch upload
                </button>
                <button
                  className={`mode-btn ${uploadMode === 'manual' ? 'active' : ''}`}
                  onClick={() => {
                    setUploadMode('manual')
                    setManualMsg(null)
                  }}
                >
                  Add manually
                </button>
              </div>
  
              {uploadMode === 'csv' && (
                <div>
                  <p className="section-desc">
                    Fill in the Excel template above, save as CSV, then upload it here. Optionally
                    attach the image folder ZIP.
                  </p>
                  <div
                    className="upload-zone"
                    role="button"
                    tabIndex={0}
                    aria-label="Choose student CSV file"
                    style={{ marginBottom: '8px' }}
                    onClick={() => openFileInput('csv-input')}
                    onKeyDown={(e) => handleFileZoneKeyDown(e, 'csv-input')}
                  >
                    <input
                      id="csv-input"
                      type="file"
                      accept=".csv"
                      hidden
                      onChange={(e) => {
                        setCsvFile(e.target.files[0])
                        setUploadMsg(null)
                      }}
                    />
                    {csvFile ? (
                      <p className="upload-selected">{csvFile.name}</p>
                    ) : (
                      <>
                        <p className="upload-icon" aria-hidden="true">⬆</p>
                        <p className="upload-text">
                          Drop CSV or <span className="upload-link">browse</span>
                        </p>
                        <p className="upload-hint">Save your Excel file as CSV before uploading</p>
                      </>
                    )}
                  </div>
                  <div
                    className="upload-zone"
                    role="button"
                    tabIndex={0}
                    aria-label="Choose optional photo ZIP file"
                    style={{ marginBottom: '10px', padding: '12px' }}
                    onClick={() => openFileInput('zip-input')}
                    onKeyDown={(e) => handleFileZoneKeyDown(e, 'zip-input')}
                  >
                    <input
                      id="zip-input"
                      type="file"
                      accept=".zip"
                      hidden
                      onChange={(e) => {
                        setZipFile(e.target.files[0])
                        setUploadMsg(null)
                      }}
                    />
                    {zipFile ? (
                      <p className="upload-selected">{zipFile.name}</p>
                    ) : (
                      <p className="upload-text">
                        Drop image folder ZIP (optional) · <span className="upload-link">browse</span>
                      </p>
                    )}
                  </div>
                  {csvFile && (
                    <button className="btn-gold-full" onClick={handleCSVUpload} disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Upload CSV'}
                      {zipFile ? ' + Photos' : ''}
                    </button>
                  )}
                  {uploadMsg && (
                    <div
                      className={uploadMsg.ok ? 'success-box' : 'error-box'}
                      style={{ marginTop: '10px' }}
                    >
                      {uploadMsg.text}
                    </div>
                  )}
                </div>
              )}
  
              {uploadMode === 'manual' && (
                <form onSubmit={handleManualAdd}>
                  <div className="manual-form">
                    <div className="field-group">
                      <label className="field-label" htmlFor="manual-full-name">Full Name</label>
                      <input
                        id="manual-full-name"
                        className="field-input"
                        placeholder="e.g. Josephine K. Freeman"
                        value={manualForm.full_name}
                        onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="manual-student-id">Student ID Number</label>
                      <input
                        id="manual-student-id"
                        className="field-input"
                        placeholder="e.g. 123456"
                        value={manualForm.student_id}
                        onChange={(e) => setManualForm({ ...manualForm, student_id: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="manual-year-level">Year / Level</label>
                      <select
                        id="manual-year-level"
                        className="field-input"
                        value={manualForm.year_level}
                        onChange={(e) => setManualForm({ ...manualForm, year_level: e.target.value })}
                      >
                        {YEARS.map((y) => (
                          <option key={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    {fields?.position?.enabled && (
                      <div className="field-group">
                        <label className="field-label" htmlFor="manual-position">Position</label>
                        <input
                          id="manual-position"
                          className="field-input"
                          placeholder="e.g. Member"
                          value={manualForm.position}
                          onChange={(e) => setManualForm({ ...manualForm, position: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="field-group">
                      <label className="field-label" htmlFor="manual-photo-input">Student Photo</label>
                      <div
                        className="upload-zone"
                        role="button"
                        tabIndex={0}
                        aria-label="Choose student photo"
                        style={{ padding: '12px' }}
                        onClick={() => openFileInput('manual-photo-input')}
                        onKeyDown={(e) => handleFileZoneKeyDown(e, 'manual-photo-input')}
                      >
                        <input
                          id="manual-photo-input"
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          hidden
                          onChange={(e) => {
                            if (e.target.files[0]) setManualPhoto(e.target.files[0])
                          }}
                        />
                        {manualPhoto ? (
                          <p className="upload-selected">{manualPhoto.name}</p>
                        ) : (
                          <p className="upload-text">
                            Upload photo (optional) · <span className="upload-link">browse</span>
                          </p>
                        )}
                      </div>
                    </div>
                    {fields?.signature?.enabled && (
                      <div className="field-group">
                        <label className="field-label" htmlFor="manual-sig-input">Student Signature</label>
                        <div
                          className="upload-zone"
                          role="button"
                          tabIndex={0}
                          aria-label="Choose student signature"
                          style={{ padding: '12px' }}
                          onClick={() => openFileInput('manual-sig-input')}
                          onKeyDown={(e) => handleFileZoneKeyDown(e, 'manual-sig-input')}
                        >
                          <input
                            id="manual-sig-input"
                            type="file"
                            accept=".png"
                            hidden
                            onChange={(e) => setManualSig(e.target.files[0])}
                          />
                          {manualSig ? (
                            <p className="upload-selected">{manualSig.name}</p>
                          ) : (
                            <p className="upload-text">
                              PNG · transparent background ·{' '}
                              <span className="upload-link">browse</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
  
                    {/* QR-encoded fields */}
                    <div
                      style={{
                        borderTop: '0.5px solid var(--border)',
                        paddingTop: '12px',
                        marginTop: '4px',
                      }}
                    >
                      <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                        QR-encoded details — stored but not printed on card face
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-programme">Programme</label>
                          <input
                            id="manual-programme"
                            className="field-input"
                            placeholder="e.g. MBBS, Pharm.D"
                            value={manualForm.programme}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, programme: e.target.value })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-blood-type">Blood Type</label>
                          <input
                            id="manual-blood-type"
                            className="field-input"
                            placeholder="e.g. O+"
                            value={manualForm.blood_type}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, blood_type: e.target.value })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-student-email">Student Email</label>
                          <input
                            id="manual-student-email"
                            className="field-input"
                            type="email"
                            placeholder="student@email.com"
                            value={manualForm.student_email}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, student_email: e.target.value })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-emergency-contact-name">Emergency Contact Name</label>
                          <input
                            id="manual-emergency-contact-name"
                            className="field-input"
                            placeholder="Full name"
                            value={manualForm.emergency_contact_name}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, emergency_contact_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-emergency-contact-phone">Emergency Contact Phone</label>
                          <input
                            id="manual-emergency-contact-phone"
                            className="field-input"
                            placeholder="+231 xxx xxxx"
                            value={manualForm.emergency_contact_phone}
                            onChange={(e) =>
                              setManualForm({
                                ...manualForm,
                                emergency_contact_phone: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-date-of-birth">Date of Birth</label>
                          <input
                            id="manual-date-of-birth"
                            className="field-input"
                            type="date"
                            value={manualForm.date_of_birth}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, date_of_birth: e.target.value })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-nationality">Nationality</label>
                          <input
                            id="manual-nationality"
                            className="field-input"
                            placeholder="Liberian"
                            value={manualForm.nationality}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, nationality: e.target.value })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-county-of-origin">County of Origin</label>
                          <input
                            id="manual-county-of-origin"
                            className="field-input"
                            list="liberia-counties-manual"
                            placeholder="e.g. Montserrado"
                            value={manualForm.county_of_origin}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, county_of_origin: e.target.value })
                            }
                          />
                          <datalist id="liberia-counties-manual">
                            {LIBERIA_COUNTIES.map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                        </div>
                        <div className="field-group">
                          <label className="field-label" htmlFor="manual-current-address">Current Address</label>
                          <input
                            id="manual-current-address"
                            className="field-input"
                            placeholder="e.g. 123 Broad Street, Monrovia"
                            value={manualForm.current_address}
                            onChange={(e) =>
                              setManualForm({ ...manualForm, current_address: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
  
                    <div className="btn-row">
                      <button className="btn-gold" type="submit" disabled={manualSubmitting}>
                        {manualSubmitting ? 'Adding...' : 'Add Student'}
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={() => {
                          setManualForm({
                            student_id: '',
                            full_name: '',
                            year_level: '1st Year',
                            position: '',
                            programme: '',
                            blood_type: '',
                            student_email: '',
                            emergency_contact_name: '',
                            emergency_contact_phone: '',
                            date_of_birth: '',
                            nationality: '',
                            county_of_origin: '',
                            current_address: '',
                          })
                          setManualPhoto(null)
                          setManualSig(null)
                          setManualMsg(null)
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {manualMsg && (
                    <div
                      className={manualMsg.ok ? 'success-box' : 'error-box'}
                      style={{ marginTop: '10px' }}
                    >
                      {manualMsg.text}
                    </div>
                  )}
                </form>
              )}
              </div>
            </div>
  )
}
